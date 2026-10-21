'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin as MapPinIcon, Star, X } from 'lucide-react';
import { EscapeToClose } from '@/components/workspace/Overlay';
import { useStudioTheme, type ResolvedTheme } from '@/components/workspace/ThemeProvider';
import { loadGoogleMaps, onMapsAuthFailure, type GMap, type GMaps } from '@/lib/google-maps';
import { dateSpan, type MapPin, type MapPlace } from '@/lib/map-places';
import { STUDIO_HOME } from '@/lib/studio';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Scouts are amber diamonds; productions are circles in the studio's accent. */
export const SCOUT_COLOR = '#f59e0b';
const PRODUCTION_COLOR = 'var(--accent)';

// Calm basemaps that keep the pins the loudest thing on screen. Points of
// interest are hidden: a map full of shops and stations buries the pins.
const LIGHT_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
const DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1c1d21' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1d21' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8e95' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3a3c42' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b5b8be' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#1e2620' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2b2d32' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#202125' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3d43' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1014' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a4e56' }] },
];

function basemap(theme: ResolvedTheme) {
  return theme === 'light'
    ? { styles: LIGHT_STYLES, backgroundColor: '#eceef1' }
    : { styles: DARK_STYLES, backgroundColor: '#1c1d21' };
}

/** The shape a pin's places are drawn as — also the legend in the toolbar. */
export function markStyle(kind: MapPin['kind'], scale = 1): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'block',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,.55)',
    transition: 'transform .15s ease',
  };
  if (kind === 'scout') {
    return { ...base, width: 12, height: 12, borderRadius: 2, background: SCOUT_COLOR, transform: `rotate(45deg) scale(${scale})` };
  }
  return {
    ...base,
    width: 14,
    height: 14,
    borderRadius: 9999,
    background: kind === 'mixed' ? `conic-gradient(${PRODUCTION_COLOR} 0 50%, ${SCOUT_COLOR} 0 100%)` : PRODUCTION_COLOR,
    transform: `scale(${scale})`,
  };
}

/** Applies markStyle to a pin built outside React. */
function paintMark(el: HTMLElement, kind: MapPin['kind'], scale = 1) {
  const css = markStyle(kind, scale);
  Object.assign(el.style, Object.fromEntries(
    Object.entries(css).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v])
  ));
}

function pinLabel(pin: MapPin): string {
  const first = pin.places[0];
  const productions = pin.places.filter(p => p.kind === 'production').length;
  const scouts = pin.places.length - productions;
  const counts = [
    productions && `${productions} production${productions === 1 ? '' : 's'}`,
    scouts && `${scouts} scout${scouts === 1 ? '' : 's'}`,
  ].filter(Boolean).join(', ');
  return pin.places.length === 1 ? `${first.title} — ${first.where}` : `${first.where} — ${counts}`;
}

interface PinLayer {
  setMap(map: GMap | null): void;
  setPins(pins: MapPin[]): void;
  setSelected(key: string | null): void;
}

/**
 * Every pin in one overlay of plain buttons: HTML, so they follow the app's
 * theme and accent, are reachable by keyboard, and need neither a Map ID nor
 * the deprecated Marker class.
 */
function createPinLayer(maps: GMaps, onPick: (key: string) => void): PinLayer {
  class Layer extends maps.OverlayView {
    root = document.createElement('div');
    pins: MapPin[] = [];
    els = new Map<string, { button: HTMLButtonElement; mark: HTMLSpanElement }>();
    selected: string | null = null;

    onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(this.root); }
    onRemove() { this.root.remove(); }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      for (const pin of this.pins) {
        const px = projection.fromLatLngToDivPixel(new maps.LatLng(pin.point.lat, pin.point.lng));
        const el = this.els.get(pin.key);
        if (!px || !el) continue;
        el.button.style.left = `${px.x}px`;
        el.button.style.top = `${px.y}px`;
      }
    }

    setPins(pins: MapPin[]) {
      this.pins = pins;
      this.els.clear();
      this.root.replaceChildren(...pins.map(pin => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent';
        button.style.cssText =
          'position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;padding:0;border:0;background:none;' +
          'display:flex;align-items:center;justify-content:center;cursor:pointer;';
        const label = pinLabel(pin);
        button.setAttribute('aria-label', label);
        button.title = label;
        const mark = document.createElement('span');
        paintMark(mark, pin.kind);
        button.appendChild(mark);
        if (pin.places.length > 1) {
          const badge = document.createElement('span');
          badge.textContent = String(pin.places.length);
          badge.style.cssText =
            'position:absolute;top:1px;left:19px;min-width:16px;height:16px;padding:0 4px;border-radius:9999px;' +
            'background:#16171a;color:#fff;border:1px solid #fff;font:600 9px/14px system-ui,sans-serif;text-align:center;';
          button.appendChild(badge);
        }
        button.addEventListener('click', () => onPick(pin.key));
        maps.OverlayView.preventMapHitsAndGesturesFrom(button);
        this.els.set(pin.key, { button, mark });
        return button;
      }));
      this.paintSelection();
      this.draw();
    }

    setSelected(key: string | null) {
      this.selected = key;
      this.paintSelection();
    }

    paintSelection() {
      for (const pin of this.pins) {
        const el = this.els.get(pin.key);
        if (!el) continue;
        const on = pin.key === this.selected;
        paintMark(el.mark, pin.kind, on ? 1.45 : 1);
        el.button.style.zIndex = on ? '2' : '';
        el.button.setAttribute('aria-pressed', String(on));
      }
    }
  }
  return new Layer();
}

type Status = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

export default function LocationsMap({ pins, selectedKey, onSelect, onOpenPlace }: {
  pins: MapPin[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onOpenPlace: (place: MapPlace) => void;
}) {
  const { resolvedTheme } = useStudioTheme();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const mapsRef = useRef<GMaps | null>(null);
  const layerRef = useRef<PinLayer | null>(null);
  const fittedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<Status>(() =>
    GOOGLE_MAPS_API_KEY
      ? { state: 'loading' }
      : { state: 'error', message: 'The map needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set on the server.' }
  );

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // One map per mount. The theme it starts in is read from the DOM rather
  // than the hook, so a theme change doesn't rebuild it (the effect below
  // restyles it instead).
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;
    const stopAuthWatch = onMapsAuthFailure(() => setStatus({
      state: 'error',
      message: 'Google refused the map key. In Google Cloud, enable the Maps JavaScript API on it and allow this site.',
    }));
    loadGoogleMaps(GOOGLE_MAPS_API_KEY).then(maps => {
      if (cancelled || !mapEl.current) return;
      const theme = (document.getElementById('studio-os-root')?.getAttribute('data-theme') || 'dark') as ResolvedTheme;
      const map = new maps.Map(mapEl.current, {
        center: STUDIO_HOME,
        zoom: 11,
        ...basemap(theme),
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      map.addListener('click', () => onSelectRef.current(null));
      const layer = createPinLayer(maps, key => onSelectRef.current(key));
      layer.setMap(map);
      mapsRef.current = maps;
      mapRef.current = map;
      layerRef.current = layer;
      setStatus(s => (s.state === 'error' ? s : { state: 'ready' }));
    }).catch(err => {
      if (!cancelled) setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    });
    return () => {
      cancelled = true;
      stopAuthWatch();
      layerRef.current?.setMap(null);
      layerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setOptions(basemap(resolvedTheme));
  }, [resolvedTheme, status.state]);

  // New pins, and a new set of them (a filter changed, or the first lookups
  // came back) frames them all. Re-framing on every update would yank the
  // map away from wherever someone had zoomed to.
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (status.state !== 'ready' || !map || !maps) return;
    layerRef.current?.setPins(pins);
    const signature = pins.map(p => p.key).sort().join('|');
    if (signature === fittedRef.current) return;
    fittedRef.current = signature;
    if (pins.length === 0) {
      map.setCenter(STUDIO_HOME);
      map.setZoom(11);
    } else if (pins.length === 1) {
      map.setCenter(pins[0].point);
      map.setZoom(14);
    } else {
      const bounds = new maps.LatLngBounds();
      pins.forEach(p => bounds.extend(p.point));
      map.fitBounds(bounds, 48);
    }
  }, [pins, status.state]);

  useEffect(() => {
    layerRef.current?.setSelected(selectedKey);
    const pin = selectedKey ? pins.find(p => p.key === selectedKey) : null;
    // On a phone the card covers the bottom of the map; centre the pin so
    // it stays in sight above it.
    if (pin && window.innerWidth < 768) mapRef.current?.panTo(pin.point);
  }, [selectedKey, pins, status.state]);

  const selected = selectedKey ? pins.find(p => p.key === selectedKey) ?? null : null;

  return (
    <div className="relative flex-1 min-h-[320px] rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
      <div ref={mapEl} className="absolute inset-0" />

      {status.state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {status.state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-zinc-900">
          <MapPinIcon className="w-8 h-8 text-white/20" />
          <p className="text-sm font-medium text-white/70">The map couldn’t load</p>
          <p className="text-xs text-white/45 max-w-sm">{status.message}</p>
        </div>
      )}
      {status.state === 'ready' && pins.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm rounded-lg bg-zinc-900/95 border border-white/10 px-3 py-2 text-center text-xs text-white/60 shadow-lg pointer-events-none">
          Nothing to show here yet. Productions with an address and logged scouts appear as pins.
        </div>
      )}

      {selected && (
        <PinCard pin={selected} onClose={() => onSelect(null)} onOpenPlace={onOpenPlace} />
      )}
    </div>
  );
}

function PinCard({ pin, onClose, onOpenPlace }: {
  pin: MapPin;
  onClose: () => void;
  onOpenPlace: (place: MapPlace) => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={pinLabel(pin)}
      className="absolute left-2 right-2 bottom-2 md:left-3 md:right-auto md:bottom-3 md:w-80 max-h-[55%] flex flex-col rounded-xl bg-zinc-900 border border-white/10 shadow-2xl shadow-black/40"
    >
      <EscapeToClose onClose={onClose} />
      <div className="flex items-start gap-2 px-3.5 pt-3 pb-2 border-b border-white/[0.06] shrink-0">
        <MapPinIcon className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
        <p className="flex-1 min-w-0 text-xs text-white/55 leading-snug line-clamp-2">{pin.places[0].where}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="overflow-y-auto custom-scrollbar divide-y divide-white/[0.06]">
        {pin.places.map(place => (
          <li key={place.key} className="px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <span aria-hidden className="w-3.5 h-3.5 mt-[3px] shrink-0 flex items-center justify-center">
                <span style={markStyle(place.kind, 0.75)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white leading-snug truncate">{place.title}</p>
                <p className="text-xs text-white/45 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                  {place.kind === 'production' ? (
                    <>
                      <span>{dateSpan(place.date, place.endDate)}</span>
                      {place.client && <span>· {place.client}</span>}
                      {place.archived && <span>· Archived</span>}
                    </>
                  ) : (
                    <>
                      <span>{place.date ? `Scouted ${dateSpan(place.date)}` : 'Scouted'}</span>
                      {!!place.rating && (
                        <span className="inline-flex items-center gap-0.5 text-yellow-500" aria-label={`${place.rating} stars`}>
                          · {place.rating} <Star className="w-3 h-3 fill-current" />
                        </span>
                      )}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenPlace(place)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  {place.kind === 'production' ? 'Open on the Slate' : 'Open location card'}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
