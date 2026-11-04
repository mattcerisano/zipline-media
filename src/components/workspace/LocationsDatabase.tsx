'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Plus,
  MapPin,
  Star,
  Activity,
  Car,
  FileText,
  Trash2,
  X,
  List,
  Map as MapIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EscapeToClose, Portal } from '@/components/workspace/Overlay';
import LocationsMap, { markStyle } from '@/components/workspace/LocationsMap';
import { supabase } from '@/lib/supabase';
import { saved } from '@/lib/saved';
import { authHeader } from '@/lib/api-client';
import { placeText, type StoredPlace } from '@/lib/geocode';
import {
  COORDINATE_COLUMNS,
  MAP_JOB_COLUMNS,
  groupPins,
  isMappedProduction,
  pinKey,
  placeYears,
  productionPlace,
  scoutPlace,
  type MapJob,
  type MapPlace,
  type PlaceKind,
} from '@/lib/map-places';
import { toast, confirmAction } from '@/components/Feedback';

interface ScoutingLocation extends StoredPlace {
  id: string;
  name: string;
  address: string;
  permit_details: string;
  power_specs: string;
  parking_capacity: string;
  rating: number; // 1 to 5 stars
  created_at?: string;
}

const LOCAL_KEY = 'studio_locations_local';
/** The placeholder locations the old browser-only mode seeded. */
const DEMO_IDS = new Set(['loc-1', 'loc-2', 'loc-3']);
/** Map or list, remembered per device. */
const VIEW_KEY = 'studio_locations_view';

// One-time move of locations someone typed while the tab was browser-only.
// The demo locations it seeded are dropped; anything else is saved to the
// shared table, and the browser copy is cleared once that works.
async function carryOverLocalLocations(): Promise<ScoutingLocation[]> {
  let raw: string | null = null;
  let local: ScoutingLocation[] = [];
  try {
    raw = localStorage.getItem(LOCAL_KEY);
    // Claim the copy before the first await, so a second load running at the
    // same time (React's development double-mount, or the tab opened twice)
    // finds nothing and can't upload it again. Put back below if this fails.
    localStorage.removeItem(LOCAL_KEY);
    local = JSON.parse(raw || '[]');
  } catch { /* unreadable — nothing to keep */ }
  const real = Array.isArray(local) ? local.filter(l => !DEMO_IDS.has(l.id) && l.name && l.address) : [];
  if (real.length === 0) return [];
  const res = await saved(
    supabase.from('locations').insert(real.map(l => ({
      name: l.name,
      address: l.address,
      permit_details: l.permit_details,
      power_specs: l.power_specs,
      parking_capacity: l.parking_capacity,
      rating: l.rating || 5,
    }))).select(),
    'move the locations saved on this device to the shared list',
  );
  if (!res) {
    try { if (raw) localStorage.setItem(LOCAL_KEY, raw); } catch { /* ignore */ }
    return [];
  }
  return (res.data || []) as ScoutingLocation[];
}

/**
 * Productions for the map. `coords` is false before the coordinates
 * migration has run: the columns don't exist yet, so the map has no pins but
 * the tab still works.
 */
async function loadMapJobs(): Promise<{ jobs: MapJob[]; coords: boolean } | null> {
  const withCoords = await supabase.from('jobs').select(`${MAP_JOB_COLUMNS}, ${COORDINATE_COLUMNS}`);
  if (!withCoords.error) return { jobs: (withCoords.data || []) as unknown as MapJob[], coords: true };
  const plain = await supabase.from('jobs').select(MAP_JOB_COLUMNS);
  if (plain.error) {
    console.error('Failed to load productions for the map:', plain.error);
    return null;
  }
  return { jobs: (plain.data || []) as unknown as MapJob[], coords: false };
}

interface Placed {
  table: 'jobs' | 'locations';
  id: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_address: string;
}

interface PlaceResult {
  placed?: Placed[];
  notFound?: number;
  remaining?: number;
  error?: string;
}

/** Asks the server to look up addresses that have no coordinates yet (see /api/geocode). */
async function requestPlacing(all: boolean): Promise<PlaceResult> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ all }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.message || data.error || `The server answered ${res.status}.` };
    return data as PlaceResult;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function withPlacement<T extends StoredPlace & { id: string }>(rows: T[], placed: Map<string, Placed>): T[] {
  return rows.map(row => {
    const p = placed.get(row.id);
    return p ? { ...row, latitude: p.latitude, longitude: p.longitude, geocoded_address: p.geocoded_address } : row;
  });
}

function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex bg-white/[0.04] border border-white/10 p-0.5 rounded-lg shrink-0">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center justify-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            value === o.value ? 'bg-white/[0.12] text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export default function LocationsDatabase({ onOpenProduction, isAdmin = false }: {
  /** Opens a production on the Slate. */
  onOpenProduction?: (jobId: string) => void;
  /** Admins get the one-time "place everything" backfill. */
  isAdmin?: boolean;
}) {
  const [locations, setLocations] = useState<ScoutingLocation[]>([]);
  const [jobs, setJobs] = useState<MapJob[]>([]);
  /** Whether the coordinate columns exist; null until the first load. */
  const [coordsReady, setCoordsReady] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [view, setView] = useState<'map' | 'list'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'map'; } catch { return 'map'; }
  });
  const [typeFilter, setTypeFilter] = useState<'all' | PlaceKind>('all');
  const [yearFilter, setYearFilter] = useState<'all' | number>('all');
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  /** A location card the map asked to show. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** Rows still to place while the admin backfill runs. */
  const [placingLeft, setPlacingLeft] = useState<number | null>(null);

  // Form states for new location modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPermits, setNewPermits] = useState('');
  const [newPower, setNewPower] = useState('');
  const [newParking, setNewParking] = useState('');
  const [newRating, setNewRating] = useState(5);

  // Locations live in the shared table only. This tab used to fall back to
  // this browser's storage — seeded with three made-up demo locations —
  // whenever the table was empty, and saving to the table never worked (the
  // made-up `loc_…` ids aren't valid ids), so the table stayed empty and every
  // scout anyone logged stayed on the one device it was typed on.
  // Runs once on mount, while isLoading is still its initial true.
  const fetchLocations = async () => {
    const [{ data, error }, mapJobs] = await Promise.all([
      supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false }),
      loadMapJobs(),
    ]);
    if (mapJobs) {
      setJobs(mapJobs.jobs);
      setCoordsReady(mapJobs.coords);
    }
    if (error) {
      console.error('Failed to load locations:', error);
      toast("Couldn't load the locations. Check your connection and reload.", 'error');
      setIsLoading(false);
      return;
    }
    setLocations([...(await carryOverLocalLocations()), ...((data || []) as ScoutingLocation[])]);
    setIsLoading(false);
  };

  useEffect(() => { void (async () => { await fetchLocations(); })(); }, []);

  const changeView = (next: 'map' | 'list') => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* private mode — just don't remember */ }
  };

  const applyPlaced = useCallback((placed: Placed[]) => {
    const byTable = (table: Placed['table']) => new Map(placed.filter(p => p.table === table).map(p => [p.id, p]));
    const jobRows = byTable('jobs');
    const locationRows = byTable('locations');
    if (jobRows.size) setJobs(prev => withPlacement(prev, jobRows));
    if (locationRows.size) setLocations(prev => withPlacement(prev, locationRows));
  }, []);

  // Everything the map can show, filtered or not.
  const places = useMemo<MapPlace[]>(() => [
    ...jobs.filter(isMappedProduction).map(productionPlace),
    ...locations.map(scoutPlace),
  ], [jobs, locations]);
  const pendingCount = useMemo(() => places.filter(p => p.missing === 'pending').length, [places]);

  // Addresses saved since the map last opened — a new production on the
  // Slate, an edited address — are looked up now, once each. The server
  // stores the result, so later visits don't look them up again.
  const autoPlaced = useRef(false);
  useEffect(() => {
    if (isLoading || coordsReady !== true || pendingCount === 0 || autoPlaced.current) return;
    autoPlaced.current = true;
    void requestPlacing(false).then(res => {
      if (res.placed?.length) applyPlaced(res.placed);
      if (res.error) console.warn("Couldn't place new addresses on the map:", res.error);
    });
  }, [isLoading, coordsReady, pendingCount, applyPlaced]);

  // The admin's one-time backfill: every production and scout saved before
  // the map existed, in steps of a hundred addresses.
  const placeEverything = async () => {
    let total = 0;
    let notFound = 0;
    let last = Infinity;
    setPlacingLeft(pendingCount);
    try {
      for (;;) {
        const res = await requestPlacing(true);
        if (res.placed?.length) applyPlaced(res.placed);
        total += (res.placed?.length || 0) - (res.notFound || 0);
        notFound += res.notFound || 0;
        if (res.error) {
          toast(`Couldn't place everything: ${res.error}`, 'error');
          return;
        }
        const remaining = res.remaining ?? 0;
        // No progress means the rest are failing — stop rather than loop.
        if (remaining === 0 || remaining >= last) break;
        last = remaining;
        setPlacingLeft(remaining);
      }
      toast(
        `Placed ${total} on the map.` +
        (notFound ? ` Google couldn't find ${notFound} address${notFound === 1 ? '' : 'es'}.` : ''),
        'success',
      );
    } finally {
      setPlacingLeft(null);
    }
  };

  // Add a location
  const handleAddLocation = async () => {
    if (!newName.trim() || !newAddress.trim() || isSaving) return;
    setIsSaving(true);

    // Looked up once, as it's saved. A lookup that fails outright leaves the
    // row unplaced, and the next visit to the map places it.
    const text = placeText(newAddress);
    let coordinates: StoredPlace = {};
    if (text && coordsReady) {
      try {
        const geo = await fetch(`/api/geocode?strict=1&address=${encodeURIComponent(text)}`, { headers: await authHeader() });
        if (geo.ok) {
          const { lat, lng } = await geo.json();
          coordinates = { latitude: lat, longitude: lng, geocoded_address: text };
        } else if (geo.status === 404) {
          coordinates = { latitude: null, longitude: null, geocoded_address: text };
        }
      } catch { /* offline — placed on a later visit */ }
    }

    const res = await saved(
      supabase
        .from('locations')
        .insert({
          name: newName.trim(),
          address: newAddress.trim(),
          permit_details: newPermits.trim() || 'No permits logged.',
          power_specs: newPower.trim() || 'No power specs logged.',
          parking_capacity: newParking.trim() || 'No parking specs logged.',
          rating: newRating,
          ...coordinates,
        })
        .select()
        .single(),
      'save the location',
    );
    setIsSaving(false);
    // Refused: leave the form open and filled in so nothing is lost.
    if (!res?.data) return;
    const added = res.data as ScoutingLocation;
    setLocations(prev => [added, ...prev]);
    if (coordinates.geocoded_address && coordinates.latitude == null) {
      toast("Saved. Google couldn't find that address, so it isn't on the map.", 'success');
    }
    const point = scoutPlace(added).point;
    if (point) setSelectedPin(pinKey(point));

    // Reset form states
    setNewName('');
    setNewAddress('');
    setNewPermits('');
    setNewPower('');
    setNewParking('');
    setNewRating(5);
    setIsModalOpen(false);
  };

  // Delete a location
  const handleDeleteLocation = async (id: string) => {
    if (!(await confirmAction({ message: 'Delete this location?', danger: true, confirmLabel: 'Delete' }))) return;
    const before = locations;
    setLocations(prev => prev.filter(l => l.id !== id));
    if (!(await saved(supabase.from('locations').delete().eq('id', id), 'delete the location'))) setLocations(before);
  };

  const openPlace = (place: MapPlace) => {
    if (place.kind === 'production') {
      onOpenProduction?.(place.id);
      return;
    }
    setRatingFilter(null);
    setHighlightId(place.id);
    changeView('list');
  };

  // Bring the card the map pointed at into view, then let the outline fade.
  useEffect(() => {
    if (!highlightId || view !== 'list' || isLoading) return;
    document.getElementById(`location-card-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightId, view, isLoading]);

  const query = searchQuery.trim().toLowerCase();

  // Filter locations
  const filteredLocations = locations.filter(loc => {
    const matchesSearch =
      loc.name.toLowerCase().includes(query) ||
      loc.address.toLowerCase().includes(query) ||
      loc.permit_details.toLowerCase().includes(query);

    const matchesRating = ratingFilter === null || loc.rating === ratingFilter;

    return matchesSearch && matchesRating;
  });

  const years = useMemo(() => placeYears(places), [places]);
  const mapPlaces = useMemo(() => places.filter(p =>
    (typeFilter === 'all' || p.kind === typeFilter) &&
    (yearFilter === 'all' || p.year === yearFilter) &&
    (!query || [p.title, p.where, p.client].some(s => s?.toLowerCase().includes(query)))
  ), [places, typeFilter, yearFilter, query]);
  const pins = useMemo(() => groupPins(mapPlaces), [mapPlaces]);
  const counts = useMemo(() => ({
    onMap: mapPlaces.filter(p => p.point).length,
    noAddress: mapPlaces.filter(p => p.missing === 'no_address').length,
    notFound: mapPlaces.filter(p => p.missing === 'not_found').length,
  }), [mapPlaces]);

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden p-4 md:p-6">
      {/* Header. On phones the page header already names the tab, so only
          the toolbar shows. */}
      <div className="hidden md:flex items-start justify-between gap-4 mb-4 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent" /> Locations
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Every place the studio has shot or scouted, with permits, power and parking for each scout.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 bg-accent hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add location
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3 md:mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Segmented
            label="View"
            value={view}
            onChange={changeView}
            options={[
              { value: 'map', label: 'Map', icon: <MapIcon className="w-3.5 h-3.5" /> },
              { value: 'list', label: 'List', icon: <List className="w-3.5 h-3.5" /> },
            ]}
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="md:hidden ml-auto shrink-0 bg-accent text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
          <input
            type="text"
            aria-label="Search locations"
            placeholder={view === 'map' ? 'Search places, productions, clients…' : 'Search by name, address or permit notes…'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedPin(null); }}
            className="w-full bg-white/[0.04] border border-white/10 pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-accent placeholder:text-white/30"
          />
        </div>

        {view === 'map' ? (
          <div className="flex items-center gap-2">
            <Segmented
              label="Show"
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setSelectedPin(null); }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'production', label: 'Productions', icon: <span aria-hidden style={markStyle('production', 0.7)} /> },
                { value: 'scout', label: 'Scouts', icon: <span aria-hidden style={markStyle('scout', 0.7)} /> },
              ]}
            />
            <select
              aria-label="Year"
              value={String(yearFilter)}
              onChange={(e) => { setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)); setSelectedPin(null); }}
              className="min-w-0 flex-1 md:flex-none bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-accent cursor-pointer"
            >
              <option value="all" className="bg-zinc-900">All years</option>
              {years.map(y => <option key={y} value={y} className="bg-zinc-900">{y}</option>)}
            </select>
          </div>
        ) : (
          <Segmented
            label="Rating"
            value={ratingFilter === null ? 'all' : String(ratingFilter)}
            onChange={(v) => setRatingFilter(v === 'all' ? null : Number(v))}
            options={[
              { value: 'all', label: 'Any rating' },
              ...[5, 4, 3].map(stars => ({
                value: String(stars),
                label: String(stars),
                icon: <Star className="w-3 h-3 fill-current text-yellow-500" />,
              })),
            ]}
          />
        )}
      </div>

      {view === 'map' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <LocationsMap
            pins={pins}
            selectedKey={selectedPin}
            onSelect={setSelectedPin}
            onOpenPlace={openPlace}
          />
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-2 text-xs text-white/45 shrink-0">
            {isLoading ? (
              <span>Loading places…</span>
            ) : coordsReady === false ? (
              <span>
                {isAdmin
                  ? 'Pins appear once 20261020210931_location_coordinates.sql has been run in Supabase.'
                  : 'Pins appear once an admin finishes setting up the map.'}
              </span>
            ) : (
              <>
                <span>{counts.onMap} on the map</span>
                {counts.noAddress > 0 && <span>· {counts.noAddress} with no address</span>}
                {counts.notFound > 0 && <span>· {counts.notFound} Google couldn’t find</span>}
                {pendingCount > 0 && (
                  isAdmin ? (
                    <button
                      type="button"
                      onClick={placeEverything}
                      disabled={placingLeft !== null}
                      className="ml-1 px-2 py-0.5 rounded-md border border-accent/40 text-accent font-medium hover:bg-accent/10 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {placingLeft !== null ? `Placing… ${placingLeft} left` : `Place ${pendingCount} more on the map`}
                    </button>
                  ) : (
                    <span>· {pendingCount} not placed yet</span>
                  )
                )}
              </>
            )}
          </div>
        </div>
      ) : (
      /* LOCATIONS LIST GRID */
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-2">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading locations…</span>
          </div>
        ) : filteredLocations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map(loc => (
              <div
                key={loc.id}
                id={`location-card-${loc.id}`}
                className={`bg-zinc-900/30 border rounded-3xl p-6 flex flex-col gap-4 group transition-all relative overflow-hidden ${
                  highlightId === loc.id ? 'border-accent ring-2 ring-accent/40' : 'border-white/10 hover:border-accent/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold tracking-tight truncate text-white">{loc.name}</h3>
                    <p className="text-[10px] text-white/40 font-medium truncate flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-accent shrink-0" /> {loc.address}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-yellow-500 shrink-0">
                    {Array.from({ length: loc.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </div>

                {/* Logistics breakdown grid */}
                <div className="space-y-3 flex-1">
                  {/* Permits */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30">Permits & Clearances</p>
                      <p className="text-xs text-white/70 leading-relaxed mt-0.5">{loc.permit_details}</p>
                    </div>
                  </div>

                  {/* Power distribution */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30">Power Grid Specs</p>
                      <p className="text-xs text-white/70 leading-relaxed mt-0.5">{loc.power_specs}</p>
                    </div>
                  </div>

                  {/* Parking */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Car className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30">Parking Capacity</p>
                      <p className="text-xs text-white/70 leading-relaxed mt-0.5">{loc.parking_capacity}</p>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-white/5 pt-4 flex justify-end">
                  <button
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="p-2 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/20 rounded-xl text-red-400/60 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer flex items-center gap-1.5 text-[11px] md:text-[9px] font-black uppercase tracking-widest"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Scout
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-white/30 space-y-4">
            <MapPin className="w-12 h-12 text-white/10 mx-auto" />
            <h3 className="text-sm font-semibold">No matching locations</h3>
            <p className="text-xs text-white/25 max-w-xs mx-auto">Add a location, or clear the search and rating filter.</p>
          </div>
        )}
      </div>
      )}

      {/* ═══════════════════════ ADD SCOUT MODAL ═══════════════════════ */}
      <Portal>
      <AnimatePresence>
        {isModalOpen && (
          <div
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <EscapeToClose onClose={() => setIsModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-white cursor-default relative overflow-y-auto max-h-[90vh]"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/55 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold tracking-tight text-white mb-6">Log a location scout</h2>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Location Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Waterfront Brick Warehouse"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Physical Address</label>
                  <input
                    type="text"
                    required
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="e.g. 100 Main St, Brooklyn, NY"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Permits */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Permit Guidelines</label>
                  <textarea
                    value={newPermits}
                    onChange={(e) => setNewPermits(e.target.value)}
                    placeholder="e.g. City park permit required; sound restrictions apply."
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30 h-20 resize-none"
                  />
                </div>

                {/* Power Specs */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Power Outlets & Distribution</label>
                  <input
                    type="text"
                    value={newPower}
                    onChange={(e) => setNewPower(e.target.value)}
                    placeholder="e.g. 3-Phase 100A tie-in, 6 wall circuits"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Parking Capacity */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Parking Clearance / Capacity</label>
                  <input
                    type="text"
                    value={newParking}
                    onChange={(e) => setNewParking(e.target.value)}
                    placeholder="e.g. 15 designated spots; fits 2 cube trucks"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(stars => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setNewRating(stars)}
                        className="p-2 bg-black/40 hover:bg-white/5 rounded-lg text-yellow-500 transition-all cursor-pointer"
                      >
                        <Star className={`w-6 h-6 ${newRating >= stars ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    disabled={!newName.trim() || !newAddress.trim() || isSaving}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-semibold text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSaving ? 'Saving…' : 'Save Location'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </Portal>
    </div>
  );
}
