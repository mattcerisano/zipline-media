'use client';

import React, { useState, useEffect } from 'react';
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
  SlidersHorizontal,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface ScoutingLocation {
  id: string;
  name: string;
  address: string;
  permit_details: string;
  power_specs: string;
  parking_capacity: string;
  rating: number; // 1 to 5 stars
  created_at?: string;
}

export default function LocationsDatabase() {
  const [locations, setLocations] = useState<ScoutingLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Form states for new location modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPermits, setNewPermits] = useState('');
  const [newPower, setNewPower] = useState('');
  const [newParking, setNewParking] = useState('');
  const [newRating, setNewRating] = useState(5);

  useEffect(() => {
    fetchLocations();
  }, []);

  // Fetch from Supabase or LocalStorage fallback
  const fetchLocations = async () => {
    setIsLoading(true);
    let loaded: ScoutingLocation[] = [];
    let fallback = false;

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      loaded = data || [];
    } catch (err) {
      console.warn('Locations table not found in Supabase. Falling back to local storage.');
      fallback = true;
    }

    if (fallback || loaded.length === 0) {
      setUseLocalStorage(true);
      const local = localStorage.getItem('studio_locations_local');
      if (local) {
        try {
          loaded = JSON.parse(local);
        } catch (e) {
          loaded = [];
        }
      } else {
        // High fidelity mock database
        loaded = [
          {
            id: 'loc-1',
            name: 'Industrial Loft Studio',
            address: '462 1st Ave, New York, NY 10016',
            permit_details: 'Standard indoor filming permit. Noise restrictions after 10 PM.',
            power_specs: 'Three phase 200A service. Standard Edison outlets throughout.',
            parking_capacity: '12 dedicated van spaces in rear lot.',
            rating: 5
          },
          {
            id: 'loc-2',
            name: 'Downtown Plaza Plaza',
            address: '308 W 46th St, New York, NY 10036',
            permit_details: 'City street permit required. Must coordinate with Mayor\'s Office of Film.',
            power_specs: 'Generator required for heavy fixtures. No tie-ins available.',
            parking_capacity: 'Street parking only. Nearby commercial garages available.',
            rating: 4
          },
          {
            id: 'loc-3',
            name: 'Greenpoint Waterfront Park',
            address: 'Kent St, Brooklyn, NY 11222',
            permit_details: 'Parks department filming permit required. Requires 10 days advance filing.',
            power_specs: 'No public power grids. Twin-pack generator recommended.',
            parking_capacity: 'Large gravel lot fits up to 6 production trucks.',
            rating: 5
          }
        ];
        localStorage.setItem('studio_locations_local', JSON.stringify(loaded));
      }
    }

    setLocations(loaded);
    setIsLoading(false);
  };

  // Add a location
  const handleAddLocation = async () => {
    if (!newName.trim() || !newAddress.trim()) return;

    const newLoc: ScoutingLocation = {
      id: 'loc_' + Date.now(),
      name: newName.trim(),
      address: newAddress.trim(),
      permit_details: newPermits.trim() || 'No permits logged.',
      power_specs: newPower.trim() || 'No power specs logged.',
      parking_capacity: newParking.trim() || 'No parking specs logged.',
      rating: newRating
    };

    const updated = [newLoc, ...locations];
    setLocations(updated);

    if (useLocalStorage) {
      localStorage.setItem('studio_locations_local', JSON.stringify(updated));
    } else {
      try {
        await supabase
          .from('locations')
          .insert(newLoc);
      } catch (err) {
        console.error('Failed to insert location into Supabase:', err);
        localStorage.setItem('studio_locations_local', JSON.stringify(updated));
      }
    }

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
    if (!confirm('Are you sure you want to delete this location?')) return;

    const updated = locations.filter(l => l.id !== id);
    setLocations(updated);

    if (useLocalStorage) {
      localStorage.setItem('studio_locations_local', JSON.stringify(updated));
    } else {
      try {
        await supabase
          .from('locations')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.error('Failed to delete location from Supabase:', err);
      }
    }
  };

  // Filter locations
  const filteredLocations = locations.filter(loc => {
    const matchesSearch = 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.permit_details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRating = ratingFilter === null || loc.rating === ratingFilter;

    return matchesSearch && matchesRating;
  });

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden p-6">
      {/* HEADER ACTION BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-accent" /> Location Scouting Database
          </h1>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-0.5">
            Log permit rules, power distribution, and parking clearances per location
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-accent hover:bg-white hover:text-black text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/15 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Location Scout
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
          <input 
            type="text"
            placeholder="Search locations by name, address, or permit notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/40 border border-white/10 pl-10 pr-4 py-3 rounded-xl text-xs font-semibold outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-white/40" />
          <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40">Rating:</span>
          <div className="flex bg-zinc-900/40 border border-white/10 p-1 rounded-xl gap-1">
            <button
              onClick={() => setRatingFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                ratingFilter === null ? 'bg-accent text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              All
            </button>
            {[5, 4, 3].map(stars => (
              <button
                key={stars}
                onClick={() => setRatingFilter(stars)}
                className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                  ratingFilter === stars ? 'bg-accent text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {stars} <Star className="w-3 h-3 fill-current" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LOCATIONS LIST GRID */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-2">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-bold tracking-wider">Scouting library…</span>
          </div>
        ) : filteredLocations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map(loc => (
              <div 
                key={loc.id}
                className="bg-zinc-900/30 border border-white/10 hover:border-accent/30 rounded-3xl p-6 flex flex-col gap-4 group transition-all relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold tracking-tight truncate text-white uppercase">{loc.name}</h3>
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
                    className="p-2 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/20 rounded-xl text-red-400/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1.5 text-[11px] md:text-[9px] font-black uppercase tracking-widest"
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
            <h3 className="text-sm font-semibold uppercase tracking-wider">No matching locations found</h3>
            <p className="text-xs text-white/25 max-w-xs mx-auto">Create a new location scout or relax your filters to view results.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════ ADD SCOUT MODAL ═══════════════════════ */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
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

              <h2 className="text-xl font-bold tracking-tight text-white mb-6">Log New Location Scout</h2>

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
                    disabled={!newName.trim() || !newAddress.trim()}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Save Location
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
