'use client';

/**
 * Loads the Google Maps JavaScript API once per page.
 *
 * The Slate's address autocomplete (react-google-autocomplete) loads the same
 * script with the Places library. Google refuses a second copy of the API on
 * one page, so this reuses the autocomplete's script when it's already there,
 * and asks for Places too when it loads first, so the autocomplete still works.
 *
 * Only the handful of classes the Locations map uses are typed here, rather
 * than pulling in @types/google.maps for them.
 */

export interface LatLngLiteral { lat: number; lng: number }

export interface GMapListener { remove(): void }

export interface GMap {
  fitBounds(bounds: GLatLngBounds, padding?: number | { top: number; right: number; bottom: number; left: number }): void;
  setCenter(center: LatLngLiteral): void;
  setZoom(zoom: number): void;
  getZoom(): number | undefined;
  setOptions(options: Record<string, unknown>): void;
  panTo(center: LatLngLiteral): void;
  addListener(event: string, handler: () => void): GMapListener;
}

export interface GLatLngBounds { extend(point: LatLngLiteral): GLatLngBounds }

export interface GProjection { fromLatLngToDivPixel(point: unknown): { x: number; y: number } | null }

export interface GOverlayView {
  setMap(map: GMap | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement } | null;
  getProjection(): GProjection | null;
}

export interface GMaps {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => GLatLngBounds;
  OverlayView: (new () => GOverlayView) & { preventMapHitsAndGesturesFrom(el: HTMLElement): void };
}

type MapsWindow = Window & {
  google?: { maps?: Partial<GMaps> };
  __ziplineMapsReady?: () => void;
  gm_authFailure?: () => void;
};

const SCRIPT_BASE = 'https://maps.googleapis.com/maps/api/js';
let loading: Promise<GMaps> | null = null;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

function ready(w: MapsWindow): GMaps | null {
  const maps = w.google?.maps;
  return maps?.Map && maps.OverlayView ? (maps as GMaps) : null;
}

/**
 * Google calls `gm_authFailure` after the script has loaded when it rejects
 * the key: the Maps JavaScript API not enabled on it, a referrer it doesn't
 * allow, billing off. The map then turns grey with a "for development
 * purposes only" watermark, so callers listen here to say what's wrong.
 */
export function onMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => { authFailureListeners.delete(listener); };
}

export function loadGoogleMaps(apiKey: string): Promise<GMaps> {
  const w = window as MapsWindow;
  const already = ready(w);
  if (already) return Promise.resolve(already);
  if (loading) return loading;

  w.gm_authFailure = () => {
    authFailed = true;
    authFailureListeners.forEach(fn => fn());
  };

  loading = new Promise<GMaps>((resolve, reject) => {
    // Resolves once the classes exist: the autocomplete's script fires `load`
    // before the API has finished setting itself up.
    const waitForApi = () => {
      const started = Date.now();
      const tick = () => {
        const maps = ready(w);
        if (maps) resolve(maps);
        else if (Date.now() - started > 15_000) {
          loading = null;
          reject(new Error('Google Maps took too long to load.'));
        } else setTimeout(tick, 100);
      };
      tick();
    };
    const failed = () => {
      loading = null;
      reject(new Error('Google Maps couldn’t be reached. Check your connection.'));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_BASE}"]`);
    if (existing) {
      existing.addEventListener('load', waitForApi);
      existing.addEventListener('error', failed);
      waitForApi();
      return;
    }

    w.__ziplineMapsReady = waitForApi;
    const script = document.createElement('script');
    script.src = `${SCRIPT_BASE}?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&callback=__ziplineMapsReady`;
    script.async = true;
    script.addEventListener('error', failed);
    document.head.appendChild(script);
  });
  return loading;
}
