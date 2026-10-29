'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { 
  Search,
  Plus, 
  Trash2, 
  Archive, 
  ArchiveRestore, 
  Calendar, 
  MapPin, 
  ExternalLink,
  Filter,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Link as LinkIcon,
  ChevronDown,
  MoreVertical,
  Receipt,
  Film,
  Users,
  ClipboardList,
  CalendarPlus,
  BookmarkPlus,
  FolderOpen,
  MessageSquare,
  Eye,
  Settings2,
  Building2,
  Activity,
  FileText,
  Package,
  CloudSun,
  RefreshCw,
  FolderKanban,
  Mail,
  X
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { authHeader } from '@/lib/api-client';
import { postNotify } from '@/lib/notify';
import { useRealtime } from '@/lib/useRealtime';
import { Job, STATUSES, JobLink, Client, Project, JobRole } from '@/components/gearbuilder/types';
import Autocomplete from 'react-google-autocomplete';
import TeamBuilder from '@/components/teambuilder/TeamBuilder';
import ClientPicker from '@/components/workspace/ClientPicker';
import { generateMasterBrief } from '@/lib/pdf-generator';
import { fetchGearCategoryMap, groupManifestByCategory, buildGearTableBody } from '@/lib/gear-manifest';
import { getBranding, hexToRgb } from '@/lib/branding';
import { sanitizeUrl } from '@/lib/sanitize';
import { latestDraftLinks } from '@/lib/drafts';
import { formatLocalDate, todayLocalISO, parseCallTime, toTimeInputValue, fromTimeInputValue, addDays } from '@/lib/date';
import { pushJobToGoogleCalendar, removeJobFromGoogleCalendar, removeEventFromGoogleCalendar } from '@/lib/calendar-push';
import type { NewProductionSeed } from '@/components/gearbuilder/ProductionCalendar';
import { caps, currency } from '@/lib/format';
import { toast, confirmAction, promptAction } from '@/components/Feedback';
import { saved } from '@/lib/saved';
import { trackAction } from '@/lib/usage';
import { CONTROL_FIELD, CONTROL_SELECT, CONTROL_SELECT_MAX, CONTROL_CTA, CONTROL_GAP, CONTROL_H, TOOLBAR_CARD, controlToggle } from '@/lib/controls';
import { FilterSheet } from '@/components/workspace/FilterSheet';
import { Modal, DropdownMenu } from '@/components/workspace/Overlay';
import type { BillingSummary } from '@/app/api/integrations/quickbooks/route';
import {
  type Deliverable,
  DELIVERABLE_FORMATS,
  DELIVERABLE_STATUS,
  deliverableStatusLabel,
  deliverableStatusTone,
} from '@/lib/deliverables';
import { InlineText, InlinePicker, ChipSelect, AddLine, AddLinkForm } from '@/components/teambuilder/InlineEdit';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Where most shoots are: the New York metro area, roughly Trenton to New
 * Haven. Both location fields pass this as a bias, not a restriction, so a
 * "Lafayette Street" match in Manhattan outranks one in Lafayette, Louisiana
 * while a shoot in Toronto or London still finds its address.
 */
const NEW_YORK_AREA_BOUNDS = { north: 41.3, south: 40.3, east: -73.0, west: -74.8 };

/** True when the wrap lands at or before the call, i.e. the day runs overnight. */
const wrapsOvernight = (call: string | null | undefined, wrap: string | null | undefined) => {
  const c = parseCallTime(call);
  const w = parseCallTime(wrap);
  if (!c || !w) return false;
  return w.hour * 60 + w.minute <= c.hour * 60 + c.minute;
};

/** A card edit: any job field, with null to clear one (supabase-js drops undefined). */
type JobPatch = { [K in keyof Job]?: Job[K] | null };

const byShootDate = (a: Job, b: Job) => (a.shoot_date || '').localeCompare(b.shoot_date || '');

/** Whole days from one "YYYY-MM-DD" to another. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "Tue, Oct 21", with the year only when it isn't this one. */
const cardDate = (value: string) => {
  const d = formatLocalDate(value, { year: 'numeric' }, '');
  const thisYear = String(new Date().getFullYear());
  return formatLocalDate(value, d === thisYear
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * "https://frame.io/r/abc" from whatever was pasted, or null when it isn't a
 * link at all. A bare "frame.io/r/abc" is the usual paste from a text.
 */
const normaliseLink = (raw: string): URL | null => {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
};

/**
 * How big the cards are, as on the Edit Tracker: small fits more productions
 * on screen to scan a busy month, large gives each card room to read. Same
 * fields at every size — only the width and spacing change. Phones always
 * show one card across, so the choice only applies from tablet width up.
 */
type CardSize = 'compact' | 'regular' | 'large';
const CARD_SIZE_KEY = 'slate_card_size';
const CARD_GRID: Record<CardSize, string> = {
  compact: 'grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4',
  regular: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  large: 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6',
};

const weatherCodeToText = (code: number) => {
  const map: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  };
  return map[code] || `Unknown (${code})`;
};

export default function Slate({ 
  userRole, 
  onBuildGear,
  preselectedJobId,
  onClearPreselectedJobId,
  newProductionSeed,
  onClearNewProductionSeed
}: { 
  userRole?: string, 
  onBuildGear?: (job: Job) => void,
  preselectedJobId?: string | null,
  onClearPreselectedJobId?: () => void,
  /**
   * A production handed over by the Calendar tab: a bare date from "New
   * production", or a marker being promoted, carrying its name, dates, times,
   * and notes so a hold doesn't have to be retyped as a shoot.
   */
  newProductionSeed?: NewProductionSeed | null,
  onClearNewProductionSeed?: () => void
} = {}) {
  const isClient = userRole === 'client';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [clientFilter, setClientFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [groupByProject, setGroupByProject] = useState(false);
  // Each viewer's own choice, remembered on this device like the Edit Tracker's.
  const [cardSize, setCardSize] = useState<CardSize>('regular');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CARD_SIZE_KEY);
      if (saved === 'compact' || saved === 'regular' || saved === 'large') setCardSize(saved);
    } catch { /* private mode */ }
  }, []);
  const chooseCardSize = (size: CardSize) => {
    setCardSize(size);
    try { localStorage.setItem(CARD_SIZE_KEY, size); } catch { /* ignore */ }
  };
  const [isLoading, setIsLoading] = useState(true);
  
  // Manage Job Modal (Team Builder)
  const [manageJobId, setManageJobId] = useState<string | null>(null);
  
  // Edit Job Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job>>({
    title: '',
    client_name: '',
    production_company: '',
    job_status: 'Planning',
    // Still stamped on every new job so the rentals side keeps working; it is
    // no longer a choice in the form, where nobody was picking "Rental Only".
    type: 'production',
    // Local day: the UTC one is already tomorrow on a New York evening.
    shoot_date: todayLocalISO(),
    call_time: '',
    location_name: '',
    location_address: '',
    notes_general: '',
    links: []
  });

  // Snapshot of the job as the modal opened, so a backdrop click can tell
  // "nothing typed yet" from "13 fields of work about to be thrown away".
  const [jobModalBaseline, setJobModalBaseline] = useState('');
  // Optional fields stay folded away while creating; an existing job that
  // already uses any of them opens with them showing.
  const [showJobDetails, setShowJobDetails] = useState(false);

  const isJobModalDirty = () => JSON.stringify(editingJob) !== jobModalBaseline;

  const closeJobModal = async () => {
    if (isJobModalDirty()) {
      const discard = await confirmAction({
        title: 'Discard changes?',
        message: 'This production has unsaved edits.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      });
      if (!discard) return;
    }
    // Abandoning the form leaves the marker it came from alone — the hold is
    // still a hold until a production actually replaces it.
    pendingMarker.current = null;
    setIsJobModalOpen(false);
  };

  const openNewJobModal = (seed?: NewProductionSeed) => {
    // Distinguish the three entry points: whether the calendar hand-offs
    // actually get used is the reason they were built.
    trackAction('slate', seed?.markerId ? 'production_from_marker' : seed ? 'new_production_from_calendar' : 'new_production');
    const blank: Partial<Job> = {
      title: seed?.title || '',
      client_name: '',
      production_company: '',
      job_status: seed?.status || 'Planning',
      type: 'production',
      // toISOString() here gave the UTC day, so an evening west of UTC
      // pre-filled tomorrow's date on a form that says "today".
      shoot_date: seed?.date || todayLocalISO(),
      end_date: seed?.endDate || '',
      // Call time defaults to TBD rather than inventing an 8:00 AM call
      // nobody chose — which also pushed a wrong time to Google Calendar.
      // An empty call time syncs as an all-day event until it's set. A marker
      // that already had times brings them across as call and wrap.
      call_time: seed?.callTime || '',
      wrap_time: seed?.wrapTime || '',
      location_name: '',
      location_address: '',
      notes_general: seed?.notes || '',
      links: []
    };
    // The marker only goes once its production exists — a form abandoned
    // halfway must leave the hold on the calendar.
    pendingMarker.current = seed?.markerId
      ? { id: seed.markerId }
      : null;
    setEditingJob(blank);
    setJobModalBaseline(JSON.stringify(blank));
    // Notes arriving from a marker are the only detail it carries; opening
    // that block folded away would hide them behind a heading.
    setShowJobDetails(!!seed?.notes);
    setIsJobModalOpen(true);
  };

  /**
   * The calendar marker this production is replacing, if it came from one.
   * A ref rather than state: nothing renders from it, and it has to survive
   * the form being edited without re-running the effect that opened it.
   */
  const pendingMarker = useRef<{ id: string } | null>(null);

  /** Clear the marker a saved production replaced, on both calendars. */
  const clearPendingMarker = async () => {
    const marker = pendingMarker.current;
    pendingMarker.current = null;
    if (!marker) return;
    try {
      // The Slate id: a marker is mirrored onto every connected calendar, so
      // the server resolves which Google events to remove.
      await removeEventFromGoogleCalendar(marker.id);
      const { error } = await supabase.from('calendar_events').delete().eq('id', marker.id);
      if (error) throw error;
    } catch (err) {
      // The production is saved and is what matters; a marker left behind is
      // a duplicate on the day, not lost work.
      console.error('Could not remove the calendar marker after converting it:', err);
      toast('Production saved. The original calendar marker is still there — delete it from the Calendar tab.');
    }
  };

  const openEditJobModal = (job: Job) => {
    setEditingJob(job);
    setJobModalBaseline(JSON.stringify(job));
    // Open the optional block already expanded when the job uses any of it,
    // so existing detail is never hidden behind a collapsed heading.
    setShowJobDetails(!!(
      job.production_company || job.project_id || job.notes_general || job.contact_email ||
      job.nearest_hospital_name || job.nearest_parking_name || job.weather_summary
    ));
    setIsJobModalOpen(true);
  };

  const handlePlaceSelected = useCallback((place: any) => {
    if (!place) return;
    const address: string = place.formatted_address || '';
    const name: string = place.name || '';
    // For a venue ("Hudson Theatre") Google returns a name distinct from the
    // address. For a plain street address it returns the street line as the
    // name, which would just repeat what's already in the address field.
    const isVenue = !!name && !address.startsWith(name);
    setEditingJob(prev => ({
      ...prev,
      location_address: address || prev.location_address || '',
      // Never overwrite a name the user typed themselves.
      location_name: prev.location_name || (isVenue ? name : ''),
    }));
  }, []);

  /**
   * A venue picked by name. Fills the address too — that's the point of
   * searching by name — but never overwrites an address already typed, since
   * a shoot can be at a suite or a loading dock the place listing won't know.
   */
  const handleVenueSelected = useCallback((place: any) => {
    if (!place) return;
    const name: string = place.name || '';
    const address: string = place.formatted_address || '';
    setEditingJob(prev => ({
      ...prev,
      location_name: name || prev.location_name || '',
      location_address: prev.location_address?.trim() ? prev.location_address : address,
    }));
  }, []);

  /** Free-typed venue names have to survive: not every location is on Google. */
  const handleVenueBlur = useCallback((e: any) => {
    const val = e.target.value;
    setEditingJob(prev => ({ ...prev, location_name: val }));
  }, []);

  const handleAddressBlur = useCallback((e: any) => {
    const val = e.target.value;
    setEditingJob(prev => ({ ...prev, location_address: val }));
  }, []);

  const [isAutoFillingLogistics, setIsAutoFillingLogistics] = useState(false);

  const handleAutoFillLogistics = async () => {
    const address = editingJob.location_address;
    if (!address) {
      toast('Please enter a Full Address first.');
      return;
    }
    setIsAutoFillingLogistics(true);
    try {
      // 1. Geocode address
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, { headers: await authHeader() });
      const geoData = await geoRes.json();
      if (!geoRes.ok) throw new Error(geoData.error || 'Geocoding failed');
      const { lat, lng } = geoData;

      // 2. Fetch nearest hospital
      const hospRes = await fetch(`/api/hospital?address=${encodeURIComponent(address)}`, { headers: await authHeader() });
      const hospData = await hospRes.json();
      let hospitalName = '';
      let hospitalAddr = '';
      if (hospRes.ok && hospData) {
        hospitalName = hospData.name;
        hospitalAddr = hospData.address;
      }

      // 3. Fetch nearest parking
      const parkRes = await fetch(`/api/parking?address=${encodeURIComponent(address)}`, { headers: await authHeader() });
      const parkData = await parkRes.json();
      let parkingName = '';
      let parkingAddr = '';
      if (parkRes.ok && parkData) {
        parkingName = parkData.name;
        parkingAddr = parkData.address;
      }

      // 4. Fetch weather forecast (if shoot date is available)
      let weatherText = '';
      if (editingJob.shoot_date) {
        try {
          const date = new Date(editingJob.shoot_date).toISOString().slice(0, 10);
          const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`);
          const wData = await wRes.json();
          if (wData.daily) {
            const code = wData.daily.weathercode[0];
            const temp = wData.daily.temperature_2m_max[0];
            weatherText = `${weatherCodeToText(code)} • High: ${temp}°F`;
          }
        } catch (weatherErr) {
          console.warn('Weather fetch failed during auto-fill:', weatherErr);
        }
      }

      // Update state
      setEditingJob(prev => ({
        ...prev,
        nearest_hospital_name: hospitalName || prev.nearest_hospital_name,
        nearest_hospital_address: hospitalAddr || prev.nearest_hospital_address,
        nearest_parking_name: parkingName || prev.nearest_parking_name,
        nearest_parking_address: parkingAddr || prev.nearest_parking_address,
        weather_summary: weatherText || prev.weather_summary
      }));
    } catch (err: any) {
      console.error(err);
      toast('Failed to auto-fill logistics: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAutoFillingLogistics(false);
    }
  };

  const handleRefreshWeather = async (job: Job) => {
    const address = job.location_address || job.location_name;
    if (!address || !job.shoot_date) {
      toast('Location address and Shoot Date are required to fetch weather.');
      return;
    }
    try {
      // 1. Geocode
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, { headers: await authHeader() });
      const geoData = await geoRes.json();
      if (!geoRes.ok) throw new Error(geoData.error || 'Address geocoding failed');
      const { lat, lng } = geoData;

      // 2. Fetch daily weather
      const date = new Date(job.shoot_date).toISOString().slice(0, 10);
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`);
      const wData = await wRes.json();

      if (wData.daily) {
        const code = wData.daily.weathercode[0];
        const temp = wData.daily.temperature_2m_max[0];
        const summary = `${weatherCodeToText(code)} • High: ${temp}°F`;

        // 3. Update in Supabase
        const { error } = await supabase
          .from('jobs')
          .update({ weather_summary: summary })
          .eq('id', job.id);
        
        if (error) throw error;
        
        // 4. Update local state
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, weather_summary: summary } : j));
      } else {
        throw new Error('Weather data unavailable for this date.');
      }
    } catch (err: any) {
      console.error('Error refreshing weather:', err);
      toast(`Could not refresh weather: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Live team sync: refetch when any teammate changes jobs/clients/projects.
  // In the background — the spinner replaces the whole board, which unmounted
  // an open form, the crew manager, or a half-typed deliverable every time
  // anyone (including this tab's own status change, echoed back) saved a job.
  useRealtime(['jobs', 'clients', 'projects'], () => fetchJobs({ background: true }));

  useEffect(() => {
    if (preselectedJobId && jobs.length > 0) {
      const match = jobs.find(j => j.id === preselectedJobId);
      if (match) {
        openEditJobModal(match);
        // Clear it so it doesn't reopen if the modal is closed
        onClearPreselectedJobId?.();
      }
    }
  }, [preselectedJobId, jobs, onClearPreselectedJobId]);

  // Arrived from Calendar — "New production" on a day, or a marker being
  // promoted to a real shoot. Same handoff as preselectedJobId above, but for
  // a production that doesn't exist yet: open the full form pre-filled from
  // the seed, then clear it so closing the form stays closed.
  useEffect(() => {
    if (!newProductionSeed) return;
    openNewJobModal(newProductionSeed);
    onClearNewProductionSeed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProductionSeed]);

  const fetchJobs = async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setIsLoading(true);
    try {
      // Bounded like the calendar and Rolodex queries. This pulled the entire
      // jobs table on every mount; a rolling two-year archive covers what the
      // board is actually used for, and undated jobs are always included via
      // the null branch so a new production can never fall outside the window.
      const archiveFloor = new Date();
      archiveFloor.setFullYear(archiveFloor.getFullYear() - 2);
      const floorStr = archiveFloor.toISOString().split('T')[0];

      const [jobsRes, clientsRes, projectsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .or(`shoot_date.gte.${floorStr},shoot_date.is.null,end_date.gte.${floorStr}`)
          .order('shoot_date', { ascending: true })
          .limit(2000),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*').order('name', { ascending: true })
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      setJobs(jobsRes.data as Job[]);
      if (clientsRes.data) setClients(clientsRes.data as Client[]);
      // Projects table may not exist yet on older deployments — fail soft.
      if (!projectsRes.error && projectsRes.data) setProjects(projectsRes.data as Project[]);
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      if (err && typeof err === 'object') {
        console.error('Detailed fetch error:', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
          status: err.status
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fire a team notification through the multi-channel dispatch route.
  // Fails silently — a webhook hiccup must never block saving a job.
  const sendNotification = async (eventKey: string, job: Partial<Job>, oldStatus?: string) => {
    try {
      await postNotify({
        event_key: eventKey,
        variables: {
          title: job.title || '',
          client: job.client_name || job.production_company || 'Internal',
          production_company: job.production_company || '',
          shoot_date: job.shoot_date || '',
          location: job.location_name || '',
          old_status: oldStatus || '',
          new_status: job.job_status || '',
        },
      });
    } catch (notifyErr) {
      console.error('Failed to send team notification:', notifyErr);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob.title) return;

    try {
      let savedJobData;
      // Snapshot the prior status so we can detect transitions (e.g. Hold -> Booked).
      const prevStatus = editingJob.id ? jobs.find(j => j.id === editingJob.id)?.job_status : undefined;

      // Resolve (or create) the client so the job carries a stable client_id link.
      // This powers the Client → Project hierarchy filtering across the app.
      const jobPayload: Partial<Job> = { ...editingJob };
      // Cleared date pickers hand back "", which Postgres rejects for a DATE
      // column. Null is what "no end date" actually means.
      // Null rather than undefined: supabase-js drops undefined keys, so
      // clearing an end date has to be sent explicitly to take effect.
      for (const key of ['shoot_date', 'end_date', 'due_date'] as const) {
        if (jobPayload[key] === '') (jobPayload as any)[key] = null;
      }
      // Link to a client row when the picker points at one. A name that
      // matches nothing stays free text: saving a production is no reason to
      // mint a client record, and doing so is what filled the client list with
      // one-off names typed into this field.
      // Null, not undefined: supabase-js drops undefined keys, so a job moved
      // to a free-text client (or cleared) kept its old client_id — and with
      // it the old client's filter, billing, and deliverable inheritance.
      (jobPayload as any).client_id = editingJob.client_name?.trim()
        ? resolveClientId(editingJob) ?? null
        : null;

      if (editingJob.id) {
        // Only the fields edited in this form. The modal holds a snapshot of
        // the whole row from when it opened; writing all of it back reverted
        // anything a teammate changed meanwhile — an editor's draft link, a
        // stage move on the Edit Tracker, a gear list.
        const baseline = JSON.parse(jobModalBaseline || '{}') as Record<string, unknown>;
        const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        const changes = Object.fromEntries(
          Object.entries(jobPayload)
            .filter(([key, value]) => !same(value, baseline[key]))
            // Undefined is dropped from the request, so a cleared project or
            // client link has to go as null to clear anything.
            .map(([key, value]) => [key, value === undefined ? null : value])
        );
        if (Object.keys(changes).length === 0) {
          setIsJobModalOpen(false);
          return;
        }
        const { data, error } = await supabase
          .from('jobs')
          .update(changes)
          .eq('id', editingJob.id)
          .select()
          .single();
        if (error) throw error;
        savedJobData = data;
        setJobs(prev => prev.map(j => j.id === editingJob.id ? data as Job : j).sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));

        // Announce status transitions (Hold -> Booked, etc.) to the team.
        const newStatus = (data as Job).job_status;
        if (newStatus && newStatus !== prevStatus) {
          sendNotification(`status_${newStatus.toLowerCase()}`, data as Job, prevStatus);
        }
      } else {
        // New productions stay off the Edit Tracker board until someone adds
        // them there. Explicit null beats the legacy DEFAULT 'Filmed' on
        // databases that haven't dropped it yet.
        (jobPayload as any).edit_status = null;
        const { data, error } = await supabase
          .from('jobs')
          .insert([jobPayload])
          .select()
          .single();
        if (error) throw error;
        savedJobData = data;
        setJobs(prev => [...prev, data as Job].sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));

        // Announce the new production across all enabled channels.
        sendNotification('job_created', data as Job);

        // Promoted from a calendar marker: the hold has become the shoot, so
        // the marker goes rather than sitting alongside it on the same day.
        await clearPendingMarker();
      }

      // Auto-populate Google Calendar. This is the whole point of Slate: a
      // production booked here lands on the team's calendar without anyone
      // re-entering it. Fire-and-forget — the row is already saved, and a
      // failed push is reported without rolling anything back.
      if (savedJobData?.id) {
        pushJobToGoogleCalendar(savedJobData.id).then(result => {
          if (!result.ok && result.message) {
            toast(result.message, 'error');
          }
        });
      }

      setIsJobModalOpen(false);
    } catch (err: any) {
      console.error('Error saving job:', err);
      toast('Failed to save job: ' + (err.message || 'Unknown error'));
    }
  };

  /**
   * Change a production's status straight from its card. Hold → Booked is the
   * most frequent edit on this board and used to require opening the full
   * 13-field modal and saving it. Optimistic. The Google event is pushed too:
   * its description states the status, and a cancelled shoot comes off the
   * calendar altogether — skipping the push left both stale on Google.
   */
  const updateJobStatus = async (job: Job, status: Job['job_status']) => {
    if (!status || status === job.job_status) return;
    const previous = job.job_status;
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, job_status: status } : j)));
    if (!(await saved(supabase.from('jobs').update({ job_status: status }).eq('id', job.id), 'change the status'))) {
      setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, job_status: previous } : j)));
      return;
    }
    sendNotification(`status_${status.toLowerCase()}`, { ...job, job_status: status }, previous);
    if (job.shoot_date) {
      pushJobToGoogleCalendar(job.id).then(result => {
        if (!result.ok && result.message) toast(result.message, 'error');
      });
    }
  };

  // Card edits arrive a field at a time — call, then wrap, then the venue — and
  // each would push its own Google update. Waiting for a pause sends one, and
  // stops two pushes for the same event landing out of order.
  const calendarPushTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pushSoon = (jobId: string) => {
    const timers = calendarPushTimers.current;
    clearTimeout(timers.get(jobId));
    timers.set(jobId, setTimeout(() => {
      timers.delete(jobId);
      pushJobToGoogleCalendar(jobId).then(result => {
        if (!result.ok && result.message) toast(result.message, 'error');
      });
    }, 1500));
  };

  /** The card whose date just changed, so it can be found where it landed. */
  const [movedJobId, setMovedJobId] = useState<string | null>(null);

  /**
   * Save a detail edited on the card itself — the call time moved, the venue
   * swapped, the notes rewritten — without the full form. Only the fields
   * edited are written, so nothing a teammate changed meanwhile is reverted.
   * Optimistic, and put back if the write is refused. The Google event carries
   * the dates, times, place, notes and links, so it follows.
   */
  const patchJob = async (job: Job, patch: JobPatch, what: string): Promise<boolean> => {
    const before = Object.fromEntries(
      Object.keys(patch).map(key => [key, job[key as keyof Job] ?? null]),
    ) as JobPatch;
    const apply = (fields: JobPatch) =>
      setJobs(prev => prev.map(j => (j.id === job.id ? ({ ...j, ...fields } as Job) : j)).sort(byShootDate));
    apply(patch);
    if ('shoot_date' in patch) setMovedJobId(job.id);
    if (!(await saved(supabase.from('jobs').update(patch).eq('id', job.id), what))) {
      apply(before);
      return false;
    }
    const shootDate = 'shoot_date' in patch ? patch.shoot_date : job.shoot_date;
    if (shootDate) pushSoon(job.id);
    return true;
  };

  /**
   * A new first day. A multi-day shoot keeps its length, the way a calendar
   * event does when it's dragged: Oct 21–23 moved to the 28th runs to the
   * 30th. The last day can be changed on its own afterwards.
   */
  const moveShootDate = (job: Job, next: string) => {
    const patch: JobPatch = { shoot_date: next || null };
    if (next && job.shoot_date && job.end_date && job.end_date > job.shoot_date) {
      patch.end_date = addDays(job.end_date, daysBetween(job.shoot_date, next));
    }
    return patchJob(job, patch, 'change the shoot date');
  };

  // Archive keeps a production — crew, gear, links, everything — but takes it
  // out of the Slate's lists and the pickers elsewhere. For work that never
  // got a date, or is done but worth keeping.
  const toggleArchive = async (job: Job) => {
    const archived_at = job.archived_at ? null : new Date().toISOString();
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, archived_at } : j)));
    const { error } = await supabase.from('jobs').update({ archived_at }).eq('id', job.id);
    if (error) {
      setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, archived_at: job.archived_at } : j)));
      toast(/archived_at/.test(error.message)
        ? 'Archiving needs a one-time database update first (the archive SQL script).'
        : `Couldn't ${archived_at ? 'archive' : 'unarchive'} it: ${error.message}`, 'error');
      return;
    }
    toast(archived_at ? `Archived “${job.title}”. It’s in the Archived folder at the bottom.` : `“${job.title}” is back on the Slate.`);
  };

  const deleteJob = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this production?', message: 'This will remove all associated roles and gear lists, and clear the shoot from Google Calendar.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      // Clear Google first: once the row is gone its google_event_id goes with
      // it, and the orphaned event would be re-imported as a new job.
      const googleEventId = jobs.find(j => j.id === id)?.google_event_id;
      if (googleEventId) await removeJobFromGoogleCalendar(googleEventId);

      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast('Failed to delete production.');
    }
  };

  // "Day 3 of the same shoot" titles: increment an existing Day N suffix,
  // otherwise start at Day 2.
  const nextDayTitle = (title: string): string => {
    const m = title.match(/^(.*?)\s*[—–-]?\s*\(?day\s+(\d+)\)?\s*$/i);
    if (m && m[1].trim()) return `${m[1].trim()} — Day ${parseInt(m[2], 10) + 1}`;
    return `${title.trim()} — Day 2`;
  };

  // Date-only math at noon local so the +1 never lands on the wrong day
  // across timezones/DST.
  const nextShootDate = (dateStr: string): string => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Duplicate a production for multi-day shoots: copies everything that
  // carries across days (client, location, safety info, gear manifest, notes,
  // links, creative) plus the full crew, bumps the shoot date to the next day,
  // and numbers the title "— Day N". Post-production state, review links, and
  // email threads are per-deliverable, so the copy starts clean.
  const duplicateJob = async (job: Job) => {
    try {
      const {
        id: _id,
        updated_at: _updatedAt,
        job_roles: _roles,
        editor: _editor,
        project: _project,
        edit_status: _editStatus,
        editor_id: _editorId,
        edit_notes: _editNotes,
        edit_labels: _editLabels,
        review_link: _reviewLink,
        review_password: _reviewPassword,
        email_thread_id: _threadId,
        email_thread_subject: _threadSubject,
        gear_list_url: _gearListUrl,
        // Identity the new day must not inherit. The Google event id made
        // saving day 2 move day 1's calendar event, and deleting day 2 delete
        // it; the share token let day 1's gear link open day 2. The database
        // mints fresh values for both.
        google_event_id: _googleEventId,
        google_calendar_user_id: _googleCalendarUserId,
        share_token: _shareToken,
        created_at: _createdAt,
        // A forecast for the original date, not the new one.
        weather_summary: _weather,
        ...copy
      } = job as any;

      const payload = {
        ...copy,
        title: nextDayTitle(job.title),
        shoot_date: job.shoot_date ? nextShootDate(job.shoot_date) : undefined,
        // Shifted with the start so the copy never ends before it begins.
        end_date: job.end_date ? nextShootDate(job.end_date) : null,
        // Duplicated days start clean in post — keep them off the Edit
        // Tracker board (explicit null beats the legacy DB default).
        edit_status: null,
      };

      const { data, error } = await supabase
        .from('jobs')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      // Carry the crew over — same team, same call times/rates as the source
      // day, editable per-day afterwards. Fails soft: the day still exists
      // without crew if this insert is rejected.
      try {
        const { data: roles } = await supabase
          .from('job_roles')
          .select('*')
          .eq('job_id', job.id);
        if (roles && roles.length > 0) {
          const roleRows = roles.map(({ id: _rid, contact: _c, ...r }: any) => ({ ...r, job_id: data.id }));
          const { error: rolesErr } = await supabase.from('job_roles').insert(roleRows);
          if (rolesErr) {
            console.error('Duplicated job but crew copy failed:', rolesErr);
            toast("Duplicated, but the crew didn't copy over — add them to the new day.", 'error');
          }
        }
      } catch (rolesErr) {
        console.error('Duplicated job but crew copy failed:', rolesErr);
        toast("Duplicated, but the crew didn't copy over — add them to the new day.", 'error');
      }

      setJobs(prev => [...prev, data as Job].sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));

      // The new day gets its own calendar event, the same as a production
      // created from the form. Undated copies stay off Google: the push would
      // pin them to today, and the calendar sync skips undated jobs too.
      if (data.shoot_date) {
        pushJobToGoogleCalendar(data.id).then(result => {
          if (!result.ok && result.message) toast(result.message, 'error');
        });
      }
    } catch (err: any) {
      console.error('Error duplicating job:', err);
      toast('Failed to duplicate production: ' + (err.message || 'Unknown error'));
    }
  };

  const saveAsTemplate = async (job: Job) => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('job_id', job.id);

      if (rolesError) throw rolesError;

      const templateData = {
        name: `${job.title} (Template)`,
        description: `Template based on ${job.title} for ${job.client_name}`,
        roles: roles.map(r => ({
          position: r.position,
          department: r.department,
          day_rate: r.day_rate
        }))
      };

      const { error } = await supabase
        .from('job_templates')
        .insert([templateData]);

      if (error) throw error;
      toast('Job structure saved as a reusable template!');
    } catch (err) {
      console.error('Error saving template:', err);
      toast('Failed to save template. Ensure the job_templates table exists.');
    }
  };

  // What goes on an exported call sheet — every section is optional so the
  // same production can produce a full crew sheet, a client-safe version, or
  // a bare logistics sheet.
  interface CallSheetOptions {
    safety: boolean;        // weather / hospital / parking
    notes: boolean;
    crew: boolean;
    crewContacts: boolean;  // email + phone columns on the crew table
    gear: boolean;
  }

  const DEFAULT_CALL_SHEET_OPTIONS: CallSheetOptions = {
    safety: true, notes: true, crew: true, crewContacts: true, gear: true,
  };

  const [exportJob, setExportJob] = useState<Job | null>(null);
  const [exportOptions, setExportOptions] = useState<CallSheetOptions>(DEFAULT_CALL_SHEET_OPTIONS);

  const generateCallSheet = async (job: Job, options: CallSheetOptions = DEFAULT_CALL_SHEET_OPTIONS) => {
    try {
      // Fetch crew roles in the order set on the Crew Manifest
      const { data: rolesData, error: rolesError } = await supabase
        .from('job_roles')
        .select('*, contact:contacts(*)')
        .eq('job_id', job.id)
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (rolesError) throw rolesError;
      const roles = rolesData || [];

      // Org branding (color + company name) for the call sheet
      const branding = await getBranding();
      const brandRgb = hexToRgb(branding.brand_color);

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;

      const ZIPLINE_BLUE = branding.brand_color || '#0077FF';
      const TEXT_DARK = '#111111';
      const TEXT_GRAY = '#666666';

      // Title & Header (Left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(TEXT_DARK);
      doc.text(`${job.title.toUpperCase()}`, margin, margin);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Client: ${caps(job.client_name, 'N/A')}`, margin, margin + 15);
      if (job.production_company) {
         doc.text(`Prod Co: ${caps(job.production_company)}`, margin, margin + 28);
      }

      // Company name + date (Right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
      doc.text(branding.name.toUpperCase(), pageWidth - margin, margin, { align: 'right' });

      const formattedDate = formatLocalDate(job.shoot_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_GRAY);
      doc.text(formattedDate.toUpperCase(), pageWidth - margin, margin + 14, { align: 'right' });

      // Logistics Table Header Grid
      autoTable(doc, {
        startY: margin + 45,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold', fillColor: [240, 240, 240] },
          1: { cellWidth: 160 },
          2: { cellWidth: 100, fontStyle: 'bold', fillColor: [240, 240, 240] },
          3: { cellWidth: 'auto' },
        },
        body: options.safety ? [
          ['CALL TIME:', caps(job.call_time, 'TBD'), 'WEATHER:', caps(job.weather_summary, 'TBD')],
          ['LOCATION:', caps(job.location_name, 'TBD'), 'HOSPITAL:', caps(job.nearest_hospital_name, 'TBD')],
          ['ADDRESS:', caps(job.location_address), 'PARKING:', caps(job.nearest_parking_name, 'TBD')],
        ] : [
          ['CALL TIME:', caps(job.call_time, 'TBD'), 'LOCATION:', caps(job.location_name, 'TBD')],
          ['ADDRESS:', caps(job.location_address), '', ''],
        ],
        margin: { left: margin, right: margin }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      // Keep a section title attached to its table — if the title would land
      // in the bottom margin, start the section on a fresh page instead.
      const ensureRoom = (needed: number) => {
        if (finalY + needed > pageHeight - margin) {
          doc.addPage();
          finalY = margin;
        }
      };

      // Notes Section
      if (options.notes && job.notes_general) {
        ensureRoom(60);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(TEXT_DARK);
        doc.text('GENERAL NOTES', margin, finalY);
        finalY += 5;

        autoTable(doc, {
          startY: finalY,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 8, fillColor: [250, 250, 250], textColor: TEXT_DARK },
          body: [[job.notes_general]],
          margin: { left: margin, right: margin }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;
      }

      // Crew Section
      if (options.crew && roles.length > 0) {
        ensureRoom(70);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ZIPLINE_BLUE);
        doc.text('CREW & TALENT', margin, finalY);
        finalY += 10;

        const crewData = roles.map(role => options.crewContacts ? [
          caps((role as any).position, 'TBD'),
          caps((role as any).contact?.name || (role as any).name, 'TBD'),
          (role as any).contact?.email || (role as any).email || '—',
          (role as any).contact?.phone || (role as any).phone || '—',
          caps((role as any).call_time || job.call_time, '—')
        ] : [
          caps((role as any).position, 'TBD'),
          caps((role as any).contact?.name || (role as any).name, 'TBD'),
          caps((role as any).call_time || job.call_time, '—')
        ]);

        autoTable(doc, {
          startY: finalY,
          head: [options.crewContacts ? ['POSITION', 'NAME', 'EMAIL', 'PHONE', 'IN'] : ['POSITION', 'NAME', 'IN']],
          body: crewData,
          theme: 'grid',
          headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 9, textColor: TEXT_DARK, cellPadding: 5 },
          margin: { left: margin, right: margin }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;
      }

      // Gear Manifest Section — grouped and ordered by inventory category so
      // the call sheet reads in the same load-out order as the Equipment List.
      const manifestObj = job.gear_manifest as Record<string, number> | undefined;
      if (options.gear && manifestObj && Object.values(manifestObj).some(count => count > 0)) {
        const categoryMap = await fetchGearCategoryMap();
        const gearGroups = groupManifestByCategory(manifestObj, categoryMap);

        ensureRoom(80);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ZIPLINE_BLUE);
        doc.text('EQUIPMENT MANIFEST', margin, finalY);
        finalY += 10;

        autoTable(doc, {
          startY: finalY,
          head: [['QTY', 'ITEM']],
          body: buildGearTableBody(gearGroups),
          theme: 'grid',
          headStyles: { fillColor: brandRgb, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 9, textColor: TEXT_DARK, cellPadding: 5 },
          columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold', halign: 'center' }, 1: { cellWidth: 'auto' } },
          margin: { left: margin, right: margin }
        });
      }

      doc.save(`${job.title.replace(/\s+/g, '_')}_Call_Sheet.pdf`);
    } catch (err) {
      console.error('Error generating call sheet:', err);
      toast('Failed to generate call sheet.');
    }
  };

  /** A link pasted straight onto the card. Labelled by its site when no label is given. */
  const addLink = async (job: Job, rawUrl: string, label: string) => {
    const url = normaliseLink(rawUrl);
    if (!url) {
      toast(`“${rawUrl.trim()}” doesn’t look like a link.`, 'error');
      return false;
    }
    const link: JobLink = { label: label.trim() || url.hostname.replace(/^www\./, ''), url: url.href };
    return patchJob(job, { links: [...(job.links || []), link] }, 'add the link');
  };

  // Only links added here: drafts belong to the Edit Tracker, and the review,
  // Discord and Drive links are set where they come from.
  const removeLink = async (job: Job, link: JobLink) => {
    if (!(await confirmAction({ title: 'Remove this link?', message: link.label || link.url, confirmLabel: 'Remove', danger: true }))) return;
    const links = (job.links || []).filter(l => !(l.url === link.url && l.label === link.label && l.category === link.category));
    void patchJob(job, { links }, 'remove the link');
  };

  // Projects available for the currently selected client (for the dependent dropdown)
  const projectsForFilter = useMemo(() => {
    if (clientFilter === 'All') return projects;
    return projects.filter(p => p.client_id === clientFilter);
  }, [projects, clientFilter]);

  const projectNameById = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  const clientNameById = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

  // QuickBooks billing, read-only. Fetched once for every client on the board
  // rather than per card, so the whole grid costs one round trip. Silent when
  // QuickBooks isn't connected — this is additive, never a blocker.
  const [billing, setBilling] = useState<Record<string, BillingSummary>>({});

  const clientIdsOnBoard = useMemo(
    () => Array.from(new Set(jobs.map(j => j.client_id).filter(Boolean))) as string[],
    [jobs],
  );

  useEffect(() => {
    if (clientIdsOnBoard.length === 0) { setBilling({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/integrations/quickbooks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'summary', clientIds: clientIdsOnBoard }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.summaries) setBilling(data.summaries);
      } catch {
        // Billing is decoration on top of the board; a failure stays quiet.
      }
    })();
    return () => { cancelled = true; };
  }, [clientIdsOnBoard.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deliverables pinned to each production. One query for the whole board, the
  // same shape as billing above — a card should never fetch for itself.
  const [deliverables, setDeliverables] = useState<Record<string, Deliverable[]>>({});

  const loadDeliverables = useCallback(async (ids: string[]) => {
    if (ids.length === 0) { setDeliverables({}); return; }
    const { data, error } = await supabase
      .from('social_deliverables')
      .select('*')
      .in('job_id', ids)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error('Failed to load deliverables:', error); return; }
    const byJob: Record<string, Deliverable[]> = {};
    for (const row of (data || []) as Deliverable[]) {
      if (!row.job_id) continue;
      (byJob[row.job_id] ||= []).push(row);
    }
    setDeliverables(byJob);
  }, []);

  const jobIdsOnBoard = useMemo(() => jobs.map(j => j.id), [jobs]);

  useEffect(() => {
    void loadDeliverables(jobIdsOnBoard);
  }, [jobIdsOnBoard.join(','), loadDeliverables]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crew per production, so a card can say who's on it without opening the
  // crew manager. One query for the board, same as billing and deliverables.
  const [crew, setCrew] = useState<Record<string, JobRole[]>>({});
  // Bumped when the crew manager closes, so cards show the edit just made.
  const [crewVersion, setCrewVersion] = useState(0);

  const closeCrewManager = () => {
    // The Google event lists the crew, so a change made in the manager has to
    // reach it — until now only saving the production form did that, and the
    // calendar kept the crew as it stood at the last form save.
    const job = jobs.find(j => j.id === manageJobId);
    if (job?.shoot_date) {
      pushJobToGoogleCalendar(job.id).then(result => {
        if (!result.ok && result.message) toast(result.message, 'error');
      });
    }
    setManageJobId(null);
    setCrewVersion(v => v + 1);
  };

  useEffect(() => {
    if (jobIdsOnBoard.length === 0) { setCrew({}); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('job_roles')
        .select('*, contact:contacts(id, name)')
        .in('job_id', jobIdsOnBoard)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (error) { console.error('Failed to load crew:', error); return; }
      const byJob: Record<string, JobRole[]> = {};
      for (const row of (data || []) as JobRole[]) {
        if (!row.job_id) continue;
        (byJob[row.job_id] ||= []).push(row);
      }
      setCrew(byJob);
    })();
    return () => { cancelled = true; };
  }, [jobIdsOnBoard.join(','), crewVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new row is written only once it has a name — a stray tap on "Add" used
  // to leave a blank row behind here and in the Social tab. It inherits the
  // job's client so the Social tab lists it under the right name, and the
  // card's last format, since cutdowns tend to come in runs of one shape.
  const addDeliverable = async (job: Job, label: string) => {
    const current = deliverables[job.id] || [];
    const format = current[current.length - 1]?.format || '16:9';
    const result = await saved(
      supabase
        .from('social_deliverables')
        .insert([{ job_id: job.id, client_id: job.client_id || null, label, format, status: 'todo' }])
        .select()
        .single(),
      'add the deliverable',
    );
    if (!result?.data) return;
    setDeliverables(prev => ({ ...prev, [job.id]: [...(prev[job.id] || []), result.data as Deliverable] }));
  };

  const patchDeliverable = async (jobId: string, id: string, patch: Partial<Deliverable>) => {
    setDeliverables(prev => ({
      ...prev,
      [jobId]: (prev[jobId] || []).map(d => (d.id === id ? { ...d, ...patch } : d)),
    }));
    if (!(await saved(supabase.from('social_deliverables').update(patch).eq('id', id), 'save the deliverable'))) {
      void loadDeliverables(jobIdsOnBoard);
    }
  };

  const removeDeliverable = async (jobId: string, id: string) => {
    const prior = deliverables[jobId] || [];
    const target = prior.find(d => d.id === id);
    // The remove button is always showing now, on phones too; a named
    // deliverable is a thing someone typed, so it takes a second tap to go.
    if (target?.label && !(await confirmAction({ title: 'Remove this deliverable?', message: target.label, confirmLabel: 'Remove', danger: true }))) return;
    setDeliverables(prev => ({ ...prev, [jobId]: prior.filter(d => d.id !== id) }));
    if (!(await saved(supabase.from('social_deliverables').delete().eq('id', id), 'remove the deliverable'))) {
      setDeliverables(prev => ({ ...prev, [jobId]: prior }));
    }
  };


  // Everything the search and filters match, archived or not. The Slate's
  // lists show the live ones; archived ones sit in their own folder.
  const matchingJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter(job => {
      // Search spans everything you'd plausibly remember a shoot by, not just
      // its title and client.
      const matchesSearch = !q || [
        job.title,
        job.client_name,
        job.production_company,
        job.location_name,
        job.location_address,
        job.notes_general,
        job.project_id ? projectNameById.get(job.project_id) : undefined,
      ].some(field => field?.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || job.job_status === statusFilter;
      // Jobs linked to a client by name only (no client_id) used to vanish
      // from the filtered list while still showing up under Grouped, which
      // matches on either. Both now agree.
      const matchesClient =
        clientFilter === 'All' ||
        job.client_id === clientFilter ||
        (!job.client_id && !!job.client_name &&
          job.client_name.trim().toLowerCase() === (clientNameById.get(clientFilter) || '').trim().toLowerCase());
      const matchesProject = projectFilter === 'All' || job.project_id === projectFilter;
      return matchesSearch && matchesStatus && matchesClient && matchesProject;
    });
  }, [jobs, searchQuery, statusFilter, clientFilter, projectFilter, projectNameById, clientNameById]);

  const filteredJobs = useMemo(() => matchingJobs.filter(j => !j.archived_at), [matchingJobs]);
  const archivedJobs = useMemo(
    () => matchingJobs.filter(j => !!j.archived_at).sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || '')),
    [matchingJobs],
  );

  /** The last day a shoot occupies — its end date for a multi-day run. */
  const lastDayOf = (job: Job) => job.end_date && job.end_date > (job.shoot_date || '')
    ? job.end_date
    : job.shoot_date;

  // Productions with no date yet. These used to fall into "Completed &
  // Archive" alongside finished work, so a shoot you'd just created appeared
  // greyed out under a heading that reads as deleted.
  const unscheduledJobs = useMemo(
    () => filteredJobs.filter(j => !j.shoot_date),
    [filteredJobs],
  );

  const upcomingJobs = useMemo(() => {
    // Local, not UTC: after 8 PM in New York the UTC date is already
    // tomorrow, which archived today's shoot while it was still running.
    const today = todayLocalISO();
    // Compared against the *last* day so a multi-day shoot stays "upcoming"
    // while it is still running, rather than archiving itself on day two.
    return filteredJobs.filter(j => j.shoot_date && (lastDayOf(j) as string) >= today);
  }, [filteredJobs]);

  const pastJobs = useMemo(() => {
    const today = todayLocalISO();
    return filteredJobs
      .filter(j => j.shoot_date && (lastDayOf(j) as string) < today)
      // Most recent first: an archive that leads with the oldest job ever
      // buries the shoot you actually just wrapped.
      .sort((a, b) => (b.shoot_date || '').localeCompare(a.shoot_date || ''));
  }, [filteredJobs]);


  // Client → Project → Jobs grouping for the "Grouped" view
  const groupedJobs = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const projectMap = new Map(projects.map(p => [p.id, p]));

    type ProjGroup = { key: string; name: string; color?: string; jobs: Job[] };
    type ClientGroup = { key: string; name: string; projects: ProjGroup[] };

    const clientGroups = new Map<string, ClientGroup>();

    for (const job of filteredJobs) {
      const cKey = job.client_id || job.client_name || '__none__';
      const cName = job.client_id ? (clientMap.get(job.client_id)?.name || 'Unknown Client')
                  : (job.client_name || 'No Client');
      if (!clientGroups.has(cKey)) {
        clientGroups.set(cKey, { key: cKey, name: cName, projects: [] });
      }
      const cg = clientGroups.get(cKey)!;

      const pKey = job.project_id || '__unassigned__';
      const proj = job.project_id ? projectMap.get(job.project_id) : undefined;
      const pName = proj?.name || 'Unassigned';
      let pg = cg.projects.find(p => p.key === pKey);
      if (!pg) {
        pg = { key: pKey, name: pName, color: proj?.color, jobs: [] };
        cg.projects.push(pg);
      }
      pg.jobs.push(job);
    }

    // Sort: clients alphabetically, "No Client" last; projects with Unassigned last
    const result = Array.from(clientGroups.values()).sort((a, b) => {
      if (a.key === '__none__') return 1;
      if (b.key === '__none__') return -1;
      return a.name.localeCompare(b.name);
    });
    result.forEach(cg => {
      cg.projects.sort((a, b) => {
        if (a.key === '__unassigned__') return 1;
        if (b.key === '__unassigned__') return -1;
        return a.name.localeCompare(b.name);
      });
    });
    return result;
  }, [filteredJobs, clients, projects]);

  // Resolve the client_id for the job being edited (explicit link or name match)
  const resolveClientId = (job: Partial<Job>): string | undefined => {
    if (job.client_id) return job.client_id;
    if (job.client_name) {
      const match = clients.find(c => c.name.toLowerCase() === job.client_name!.toLowerCase().trim());
      return match?.id;
    }
    return undefined;
  };

  // Create a new project inline for the job's current client
  const handleCreateProject = async () => {
    const name = await promptAction({
      title: 'New project',
      message: 'Projects group several shoots for the same client.',
      label: 'Project name',
      placeholder: 'e.g. Moulin Rouge Campaign',
    });
    if (!name) return;
    const clientId = resolveClientId(editingJob);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name, client_id: clientId || null }])
        .select()
        .single();
      if (error) throw error;
      const newProject = data as Project;
      setProjects(prev => [...prev, newProject]);
      setEditingJob(prev => ({ ...prev, project_id: newProject.id }));
    } catch (err: any) {
      console.error('Error creating project:', err);
      toast(`Failed to create project: ${err.message || 'unknown error'}`);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Booked': return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'Hold': return <Clock3 className="w-3 h-3 text-yellow-500" />;
      case 'Planning': return <Clock3 className="w-3 h-3 text-blue-500" />;
      // Wrapped had no case and fell through to the grey default, so a
      // finished shoot looked identical to one with no status at all.
      case 'Wrapped': return <CheckCircle2 className="w-3 h-3 text-white/50" />;
      case 'Cancelled': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock3 className="w-3 h-3 opacity-20" />;
    }
  };

  // One card, wired up. The Slate renders it in five places (needs a date,
  // upcoming, past, archived, and grouped by project), which used to mean
  // five copies of the same twenty props.
  const renderCard = (job: Job, { showProject = true }: { showProject?: boolean } = {}) => (
    <JobCard
      key={job.id}
      job={job}
      isClient={isClient}
      getStatusIcon={getStatusIcon}
      onSaveAsTemplate={() => saveAsTemplate(job)}
      onDuplicate={() => duplicateJob(job)}
      onDelete={() => deleteJob(job.id)}
      onArchive={() => toggleArchive(job)}
      onManage={() => setManageJobId(job.id)}
      onExportCallSheet={() => { setExportOptions(DEFAULT_CALL_SHEET_OPTIONS); setExportJob(job); }}
      onEdit={() => openEditJobModal(job)}
      onBuildGear={() => onBuildGear?.(job)}
      onRefreshWeather={() => handleRefreshWeather(job)}
      onStatusChange={(status) => updateJobStatus(job, status)}
      onPatch={(patch, what) => patchJob(job, patch, what)}
      onMoveShootDate={(next) => moveShootDate(job, next)}
      onAddLink={(url, label) => addLink(job, url, label)}
      onRemoveLink={(link) => removeLink(job, link)}
      billing={job.client_id ? billing[job.client_id] : undefined}
      projectName={showProject && job.project_id ? projectNameById.get(job.project_id) : undefined}
      crew={crew[job.id]}
      deliverables={deliverables[job.id]}
      onAddDeliverable={(label) => addDeliverable(job, label)}
      onPatchDeliverable={(id, patch) => patchDeliverable(job.id, id, patch)}
      onRemoveDeliverable={(id) => removeDeliverable(job.id, id)}
      moved={movedJobId === job.id}
      compact={cardSize === 'compact'}
      onMovedSeen={() => setMovedJobId(null)}
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Filters & Actions Header */}
      {/* The filter group used to be capped at max-w-4xl while the CTA sat hard
          right, so the controls were squeezed into two-thirds of the row and
          "Group" wrapped underneath — with empty space beside it. The cap is
          gone: the group takes the width actually available, wraps only when it
          genuinely runs out, and every child is the same height. */}
      <div className={`flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 lg:gap-6 ${TOOLBAR_CARD}`}>
        <div className={`flex flex-wrap items-center ${CONTROL_GAP} flex-1 w-full min-w-0`}>
          <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs or clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 ${CONTROL_FIELD}`}
            />
          </div>
          
          <FilterSheet
            activeCount={
              (statusFilter !== 'All' ? 1 : 0) +
              (clientFilter !== 'All' ? 1 : 0) +
              (projectFilter !== 'All' ? 1 : 0) +
              (groupByProject ? 1 : 0)
            }
          >
            <Filter className="w-4 h-4 text-white/20 hidden md:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`flex-1 md:flex-none min-w-[130px] ${CONTROL_SELECT_MAX} ${CONTROL_SELECT}`}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Client filter */}
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setProjectFilter('All'); // reset dependent project filter
              }}
              className={`flex-1 md:flex-none min-w-[130px] ${CONTROL_SELECT_MAX} ${CONTROL_SELECT}`}
            >
              <option value="All">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Project filter (scoped to selected client) */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              disabled={projectsForFilter.length === 0}
              className={`flex-1 md:flex-none min-w-[130px] ${CONTROL_SELECT_MAX} ${CONTROL_SELECT} disabled:opacity-30`}
            >
              <option value="All">All Projects</option>
              {projectsForFilter.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Group-by-project toggle */}
            <button
              type="button"
              onClick={() => setGroupByProject(v => !v)}
              title="Group jobs by project"
              className={`flex-1 md:flex-none min-w-[110px] ${controlToggle(groupByProject)}`}
            >
              {groupByProject ? 'Grouped' : 'Group'}
            </button>
          </FilterSheet>

          <div className={`hidden md:flex items-center gap-0.5 p-1 bg-black/50 border border-white/10 rounded-xl ${CONTROL_H}`} role="group" aria-label="Card size">
            {(['compact', 'regular', 'large'] as CardSize[]).map((sz, i) => (
              <button
                key={sz}
                type="button"
                onClick={() => chooseCardSize(sz)}
                title={`Card size: ${sz === 'compact' ? 'small' : sz === 'regular' ? 'medium' : 'large'}`}
                aria-pressed={cardSize === sz}
                className={`h-full w-8 rounded-lg text-[12px] font-semibold transition-colors ${cardSize === sz ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              >
                {['S', 'M', 'L'][i]}
              </button>
            ))}
          </div>
        </div>

        {!isClient && (
          <button 
            onClick={() => openNewJobModal()}
            data-tour="slate-new"
            className={`w-full lg:w-auto shrink-0 ${CONTROL_CTA}`}
          >
            <Plus className="w-4 h-4" /> New Production
          </button>
        )}
      </div>

      {/* Grouped view: Client → Project → Jobs */}
      {groupByProject ? (
        <div className="space-y-10">
          {groupedJobs.length === 0 && (
            <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
              <p className="font-medium tracking-tight text-sm text-white/70">No jobs found.</p>
            </div>
          )}
          {groupedJobs.map(cg => (
            <section key={cg.key} className="space-y-6">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold tracking-tight text-accent whitespace-nowrap">{cg.name}</h2>
                <div className="h-px bg-accent/20 flex-1" />
                <span className="text-[11px] font-medium opacity-40 tracking-tight text-white">
                  {cg.projects.reduce((n, p) => n + p.jobs.length, 0)} Jobs
                </span>
              </div>
              <div className="space-y-8 pl-1 md:pl-4 border-l border-white/5">
                {cg.projects.map(pg => (
                  <div key={pg.key} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pg.color || 'var(--accent)' }}
                      />
                      <h3 className="text-xs font-semibold tracking-tight text-white/70 whitespace-nowrap">{pg.name}</h3>
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[10px] font-medium opacity-40 tracking-tight text-white">{pg.jobs.length}</span>
                    </div>
                    <div className={CARD_GRID[cardSize]}>
                      {pg.jobs.map(job => renderCard(job, { showProject: false }))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
      /* Sections */
      <div className="space-y-12">
        {/* Undated productions, above the dated ones — they need a date, not
            an archive. Hidden entirely when there are none. */}
        {unscheduledJobs.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400 whitespace-nowrap">Needs a Date</h2>
              <div className="h-px bg-amber-400/20 flex-1" />
              <span className="text-[11px] font-medium opacity-40 tracking-tight text-white">{unscheduledJobs.length} {unscheduledJobs.length === 1 ? 'Job' : 'Jobs'}</span>
            </div>
            <div className={CARD_GRID[cardSize]}>
              {unscheduledJobs.map(job => renderCard(job))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent whitespace-nowrap">Upcoming Productions</h2>
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[11px] font-medium opacity-40 tracking-tight text-white">{upcomingJobs.length} Jobs</span>
          </div>
          
          <div className={CARD_GRID[cardSize]}>
            {upcomingJobs.map(job => renderCard(job))}
            {upcomingJobs.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
                <p className="font-medium tracking-tight text-sm text-white/70">No upcoming jobs found.</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6 opacity-60">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 whitespace-nowrap text-white">Completed & Archive</h2>
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[11px] font-medium opacity-40 tracking-tight text-white">{pastJobs.length} Jobs</span>
          </div>
          
          <div className={CARD_GRID[cardSize]}>
             {pastJobs.map(job => renderCard(job))}
          </div>
        </section>

        {/* Archived: kept, out of the way. Collapsed unless asked for, or a
            search matches something in it. */}
        {archivedJobs.length > 0 && (
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              className="w-full flex items-center gap-3 text-left group"
              aria-expanded={showArchived || !!searchQuery.trim()}
            >
              <Archive className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
              <h2 className="text-[11px] font-semibold tracking-tight text-white/50 group-hover:text-white/80 whitespace-nowrap">Archived</h2>
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-[11px] font-medium text-white/40 whitespace-nowrap">
                {archivedJobs.length} {archivedJobs.length === 1 ? 'job' : 'jobs'} · {showArchived || searchQuery.trim() ? 'Hide' : 'Show'}
              </span>
            </button>
            {(showArchived || !!searchQuery.trim()) && (
              <div className={`${CARD_GRID[cardSize]} opacity-70`}>
             {archivedJobs.map(job => renderCard(job))}
              </div>
            )}
          </section>
        )}
      </div>
      )}

      {/* Edit Job Modal */}
      <Modal
        open={isJobModalOpen}
        onClose={closeJobModal}
        title={editingJob.id ? 'Edit Production' : 'New Production'}
        subtitle={editingJob.id ? undefined : 'A title is all you need — everything else can wait.'}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeJobModal}
              className="px-4 py-2.5 rounded-lg font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="slate-job-form"
              className="bg-accent text-white px-6 py-2.5 rounded-lg font-semibold text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20"
            >
              {editingJob.id ? 'Save Changes' : 'Create Production'}
            </button>
          </div>
        }
      >
              <form id="slate-job-form" onSubmit={handleSaveJob} className="grid grid-cols-1 md:grid-cols-6 gap-x-3 gap-y-3">
                {/* Production Title (the individual shoot) */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Title</label>
                  <input
                    required
                    autoFocus
                    type="text"
                    placeholder="e.g. Broadway Opening Night"
                    value={editingJob.title}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>

                {/* Client Name */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Client Name <span className="opacity-60 normal-case tracking-normal font-medium">(who you bill)</span></label>
                  <ClientPicker
                    clients={clients}
                    value={editingJob.client_name || ''}
                    clientId={editingJob.client_id || null}
                    onChange={({ name, clientId }) => {
                      const picked = clientId ? clients.find(c => c.id === clientId) : null;
                      setEditingJob(prev => ({
                        ...prev,
                        client_name: name,
                        client_id: clientId || undefined,
                        // Auto-pull the bill-to contact email from the Rolodex (only if not already set)
                        contact_email: (picked?.email && !prev.contact_email) ? picked.email : prev.contact_email,
                      }));
                    }}
                    onClientCreated={c => setClients(prev => [...prev, c])}
                    placeholder="Client name"
                    inputClassName="w-full bg-black/50 border border-white/10 py-2.5 pl-2.5 pr-9 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                  />
                  {(() => {
                    const match = clients.find(c => c.name.trim().toLowerCase() === (editingJob.client_name || '').trim().toLowerCase());
                    const details = match ? [match.email, match.phone, match.address].filter(Boolean).join('  ·  ') : '';
                    if (!details) return null;
                    return (
                      <p className="text-[11px] md:text-[8px] font-medium text-accent/70 ml-1 mt-0.5 flex items-center gap-1 normal-case tracking-normal">
                        <Building2 className="w-2.5 h-2.5 shrink-0" /> Pulled from Rolodex: {details}
                      </p>
                    );
                  })()}
                </div>

                {/* --- section --- */}
                <div className="md:col-span-6 flex items-center gap-3 mt-2 first:mt-0">
                  <span className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">Schedule</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* Job Status */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Job Status</label>
                  <div className="relative">
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white" />
                    <select 
                      value={editingJob.job_status}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, job_status: e.target.value as any }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white appearance-none cursor-pointer"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Shoot Date */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Shoot Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white pointer-events-none" />
                    <input 
                      type="date"
                      value={editingJob.shoot_date}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, shoot_date: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                {/* End Date — multi-day shoots. Blank means a single day. */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">End Date <span className="opacity-50 normal-case tracking-normal">(multi-day)</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white pointer-events-none" />
                    <input
                      type="date"
                      value={editingJob.end_date || ''}
                      min={editingJob.shoot_date || undefined}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                {/* Call Time. A free time input, like the calendar's, so a
                    7:15 or 6:45 call can be set — the old half-hour dropdown
                    couldn't. Cleared means TBD. */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Call Time</label>
                  <input
                    type="time"
                    value={toTimeInputValue(editingJob.call_time)}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, call_time: fromTimeInputValue(e.target.value) }))}
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white [color-scheme:dark]"
                  />
                </div>

                {/* Wrap Time */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Wrap Time</label>
                  <input
                    type="time"
                    value={toTimeInputValue(editingJob.wrap_time)}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, wrap_time: fromTimeInputValue(e.target.value) }))}
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white [color-scheme:dark]"
                  />
                  {/* A wrap at or before the call is a night shoot, not a
                      mistake — say so rather than validating it away. */}
                  {wrapsOvernight(editingJob.call_time, editingJob.wrap_time) && (
                    <p className="text-[11px] md:text-[9px] text-white/35 ml-1">Runs past midnight into the next day.</p>
                  )}
                </div>

                {/* --- section --- */}
                <div className="md:col-span-6 flex items-center gap-3 mt-2 first:mt-0">
                  <span className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">Location</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* Location Name — searches places by name and fills the
                    address from the pick. Free text still works: a location
                    that isn't on Google ("Matt's garage") saves on blur. */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Location Name</label>
                  <div className="relative flex">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white z-10" />
                    <Autocomplete
                      key={`name-${editingJob.id || 'new'}-${editingJob.location_name || ''}`}
                      apiKey={GOOGLE_MAPS_API_KEY}
                      // `establishment` biases to venues rather than street
                      // addresses — searching by name means searching for a
                      // place, and the address field covers the other case.
                      options={{
                        types: ['establishment'],
                        fields: ['name', 'formatted_address', 'geometry.location', 'place_id'],
                        bounds: NEW_YORK_AREA_BOUNDS,
                      }}
                      onPlaceSelected={handleVenueSelected}
                      defaultValue={editingJob.location_name || ''}
                      placeholder="e.g. Hudson Theatre"
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                      onBlur={handleVenueBlur}
                    />
                  </div>
                </div>

                {/* Full Address */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Full Address</label>
                  <div className="relative flex">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white z-10" />
                    <Autocomplete
                      key={`addr-${editingJob.id || 'new'}-${editingJob.location_address || ''}`}
                      apiKey={GOOGLE_MAPS_API_KEY}
                      // `types` has to be set: the library's default is
                      // `(cities)`, which only ever offered towns, so a street
                      // address was matched against city names worldwide.
                      // The field list adds `name` to the library's default so
                      // Location Name can auto-fill from a venue's address.
                      options={{
                        types: ['address'],
                        fields: ['address_components', 'geometry.location', 'place_id', 'formatted_address', 'name'],
                        bounds: NEW_YORK_AREA_BOUNDS,
                      }}
                      onPlaceSelected={handlePlaceSelected}
                      defaultValue={editingJob.location_address || ''}
                      placeholder="Street, City, State, Zip"
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                      onBlur={handleAddressBlur}
                    />
                  </div>
                  {/* Without a key the widget silently degrades to a plain text
                      box — no dropdown, no error — which reads as "autocomplete
                      is broken" rather than "it was never switched on". */}
                  {!GOOGLE_MAPS_API_KEY && (
                    <p className="text-[11px] md:text-[9px] text-amber-400/70 ml-1 leading-relaxed">
                      Address autocomplete is off — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY isn&rsquo;t set on the server. Type the address manually for now.
                    </p>
                  )}
                </div>

                {/* Everything below is optional. Collapsed by default so
                    creating a production is a title, a date and a client —
                    the rest is there when the job actually needs it. */}
                <div className="md:col-span-6">
                  <button
                    type="button"
                    onClick={() => setShowJobDetails(v => !v)}
                    className="w-full flex items-center gap-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-accent transition-colors"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showJobDetails ? '' : '-rotate-90'}`} />
                    More details
                    <span className="h-px bg-white/10 flex-1 ml-1" />
                  </button>
                </div>

                {showJobDetails && (
                <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-6 gap-x-3 gap-y-3">
                {/* Production Company */}
                <div className="md:col-span-3 flex flex-col gap-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Company <span className="opacity-60 normal-case tracking-normal font-medium">(if a prod co hired you for their client)</span></label>
                  <div className="relative mt-auto">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white" />
                    <input 
                      type="text"
                      placeholder="Production co"
                      value={editingJob.production_company || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, production_company: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                    />
                  </div>
                </div>

                {/* Project (within the selected client) */}
                <div className="md:col-span-3 flex flex-col gap-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white flex items-center justify-between">
                    <span>Project</span>
                    <button
                      type="button"
                      onClick={handleCreateProject}
                      className="text-accent hover:text-white transition-colors normal-case tracking-normal font-bold"
                    >
                      + New
                    </button>
                  </label>
                  <div className="relative mt-auto">
                    <FolderKanban className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white pointer-events-none" />
                    <select
                      value={editingJob.project_id || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, project_id: e.target.value || undefined }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white appearance-none cursor-pointer"
                    >
                      <option value="">No Project</option>
                      {(() => {
                        const cId = resolveClientId(editingJob);
                        const opts = cId ? projects.filter(p => p.client_id === cId || p.id === editingJob.project_id) : projects;
                        return opts.map(p => <option key={p.id} value={p.id}>{p.name}</option>);
                      })()}
                    </select>
                  </div>
                </div>

                {/* Additional Logistics overrides */}
                <div className="space-y-1 md:col-span-6">
                   <div className="flex items-center justify-between mb-0.5">
                     <h3 className="text-[11px] md:text-[9px] font-black uppercase tracking-[0.2em] text-accent">Logistics Overrides (Optional)</h3>
                     {editingJob.location_address && (
                       <button
                         type="button"
                         onClick={handleAutoFillLogistics}
                         disabled={isAutoFillingLogistics}
                         className="px-2 py-0.5 bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white rounded-md text-[11px] md:text-[8px] font-semibold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                       >
                         {isAutoFillingLogistics ? (
                           <>
                             <div className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" />
                             Fetching...
                           </>
                         ) : (
                           <>
                             <RefreshCw className="w-2.5 h-2.5" />
                             Auto-Fill Logistics
                           </>
                         )}
                       </button>
                     )}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input 
                        type="text"
                        placeholder="Nearest hospital"
                        value={editingJob.nearest_hospital_name || ''}
                        onChange={(e) => setEditingJob(prev => ({ ...prev, nearest_hospital_name: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 p-2.5 rounded-lg outline-none focus:border-accent font-bold text-xs text-white"
                      />
                      <input 
                        type="text"
                        placeholder="Nearest parking"
                        value={editingJob.nearest_parking_name || ''}
                        onChange={(e) => setEditingJob(prev => ({ ...prev, nearest_parking_name: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 p-2.5 rounded-lg outline-none focus:border-accent font-bold text-xs text-white"
                      />
                      <input 
                        type="text"
                        placeholder="Weather override"
                        value={editingJob.weather_summary || ''}
                        onChange={(e) => setEditingJob(prev => ({ ...prev, weather_summary: e.target.value }))}
                        className="w-full bg-black/50 border border-white/10 p-2.5 rounded-lg outline-none focus:border-accent font-bold text-xs text-white"
                      />
                   </div>
                   <p className="text-[11px] md:text-[8px] text-white/30 italic mt-0.5">If left blank, logistics will auto-fetch in the Gear Builder based on the Full Address.</p>
                </div>


                {/* Contact Email (linked correspondence) */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Contact Email
                    {editingJob.email_thread_subject && (
                      <span className="text-accent normal-case tracking-normal font-bold truncate">· linked: {editingJob.email_thread_subject}</span>
                    )}
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={editingJob.contact_email || ''}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, contact_email: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-bold text-xs text-white"
                  />
                </div>

                {/* General Notes */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">General Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2 w-3.5 h-3.5 opacity-40 text-white" />
                    <textarea
                      placeholder="Additional production notes — write as much as you need, drag the corner to expand..."
                      value={editingJob.notes_general || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, notes_general: e.target.value }))}
                      rows={5}
                      className="w-full bg-black/50 border border-white/10 py-2 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-medium text-xs text-white leading-relaxed min-h-[110px] max-h-[50vh] resize-y"
                    />
                  </div>
                </div>

                </div>
                )}

              </form>
      </Modal>

      {/* Manage Crew Modal (Team Builder) */}
      <Modal
        open={!!manageJobId}
        onClose={closeCrewManager}
        maxWidth="max-w-6xl"
      >
        {manageJobId && <TeamBuilder predefinedJobId={manageJobId} onClose={closeCrewManager} />}
      </Modal>

      {/* Call Sheet export options — pick exactly what goes on the PDF */}
      <AnimatePresence>
        {exportJob && (
          <Modal
            open={!!exportJob}
            onClose={() => setExportJob(null)}
            title="Export Call Sheet"
            maxWidth="max-w-sm"
          >
            <div>
              <p className="text-[10px] text-white/40 mb-4 truncate">{exportJob.title}</p>

              <div className="space-y-1.5 mb-5">
                {([
                  { key: 'safety', label: 'Safety & Logistics', hint: 'Weather, hospital, parking' },
                  { key: 'notes', label: 'General Notes', hint: 'Production notes block' },
                  { key: 'crew', label: 'Crew & Talent', hint: 'The crew table' },
                  { key: 'crewContacts', label: 'Crew Contact Info', hint: 'Email & phone columns' },
                  { key: 'gear', label: 'Equipment Manifest', hint: 'Category-sorted gear list' },
                ] as { key: keyof CallSheetOptions; label: string; hint: string }[]).map(opt => {
                  const disabled = opt.key === 'crewContacts' && !exportOptions.crew;
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        disabled ? 'opacity-30 border-white/5' : 'cursor-pointer border-white/5 hover:border-white/15 bg-white/[0.02]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={exportOptions[opt.key] && !disabled}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-white/20 text-accent focus:ring-accent bg-black cursor-pointer"
                      />
                      <span className="flex-1">
                        <span className="block text-xs font-bold text-white">{opt.label}</span>
                        <span className="block text-[11px] md:text-[9px] text-white/35">{opt.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] md:text-[9px] text-white/25 mb-4">Rates and fees are never included on exported call sheets.</p>

              <button
                onClick={() => {
                  const job = exportJob;
                  setExportJob(null);
                  if (job) generateCallSheet(job, exportOptions);
                }}
                className="w-full py-3 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                Export PDF
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Label column of the card's details list, lined up with the first line of its value. */
const DETAIL_LABEL = 'pt-2 pointer-coarse:pt-3.5 text-[11px] font-medium text-white/40';

/**
 * One labelled block on a card. Every section is headed the same way and
 * sits in the same order on every card, so the eye learns where Notes or
 * Deliverables are and can go straight there.
 */
function CardSection({ icon, label, meta, tour, children }: {
  icon: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-tour={tour} className="pt-4 mt-4 border-t border-white/5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p role="heading" aria-level={4} className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 flex items-center gap-1.5">
          {icon} {label}
        </p>
        {meta}
      </div>
      {children}
    </section>
  );
}

function AddButton({ onClick, tour, label, children }: { onClick: () => void; tour?: string; label?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tour}
      aria-label={label}
      className="inline-flex items-center gap-1.5 h-8 pointer-coarse:h-10 px-2.5 rounded-lg text-[12px] font-medium text-accent hover:bg-accent/10 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: s }));

/** The fixed list, plus whatever an older row holds, so a select never shows a value it wasn't given. */
const withCurrent = (list: readonly string[], current: string, label = (v: string) => v) =>
  (list.includes(current) ? list : [current, ...list]).map(v => ({ value: v, label: label(v) }));

function JobCard({
  job,
  isClient,
  getStatusIcon,
  onSaveAsTemplate,
  onDuplicate,
  onDelete,
  onArchive,
  onManage,
  onExportCallSheet,
  onEdit,
  onBuildGear,
  onRefreshWeather,
  onStatusChange,
  onPatch,
  onMoveShootDate,
  onAddLink,
  onRemoveLink,
  billing,
  projectName,
  crew = [],
  deliverables = [],
  onAddDeliverable,
  onPatchDeliverable,
  onRemoveDeliverable,
  moved = false,
  onMovedSeen,
  compact = false,
}: {
  job: Job,
  isClient: boolean,
  getStatusIcon: (s?: string) => React.ReactNode,
  onSaveAsTemplate: () => void,
  onDuplicate: () => void,
  onDelete: () => void,
  onArchive?: () => void,
  onManage: () => void,
  onExportCallSheet: () => void,
  onEdit: () => void,
  onBuildGear?: () => void,
  onRefreshWeather?: () => void,
  onStatusChange?: (status: Job['job_status']) => void,
  onPatch: (patch: JobPatch, what: string) => Promise<boolean>,
  onMoveShootDate: (next: string) => Promise<boolean>,
  onAddLink: (url: string, label: string) => Promise<boolean>,
  onRemoveLink: (link: JobLink) => void,
  billing?: BillingSummary,
  projectName?: string,
  crew?: JobRole[],
  deliverables?: Deliverable[],
  onAddDeliverable?: (label: string) => void,
  onPatchDeliverable?: (id: string, patch: Partial<Deliverable>) => void,
  onRemoveDeliverable?: (id: string) => void,
  /** Its date just changed, so it may have moved: bring it into view. */
  moved?: boolean,
  onMovedSeen?: () => void,
  /** Small cards: tighter padding, so more fit across. */
  compact?: boolean,
}) {
  const gearCount = job.gear_manifest ? Object.values(job.gear_manifest as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

  const hasVaultLinks = !!(job.review_link || job.discord_url || job.drive_folder_url || job.links?.length);
  // Edit Tracker drafts show as their newest cut only; the full history lives
  // on the card. Posting a draft also sets review_link, so skip that button
  // when it would just repeat the newest draft.
  const vaultLinks = latestDraftLinks(job.links);
  const reviewIsDraft = vaultLinks.some(l => l.category === 'Draft' && l.url === job.review_link);

  const statusTone: Record<string, string> = {
    Booked: 'bg-green-500/10 border-green-500/20 text-green-300',
    Hold: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    Planning: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    Wrapped: 'bg-white/5 border-white/10 text-white/60',
    Cancelled: 'bg-red-500/10 border-red-500/20 text-red-300',
  };
  const currentStatus = job.job_status || 'Planning';
  const multiDay = !!(job.shoot_date && job.end_date && job.end_date > job.shoot_date);
  const overnight = wrapsOvernight(job.call_time, job.wrap_time);

  // An empty section folds away into an "Add" button below the others, so a
  // card that has no notes doesn't carry an empty notes box. These open one.
  const [notesOpen, setNotesOpen] = useState(false);
  const [addingDeliverable, setAddingDeliverable] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const showNotes = !!job.notes_general || notesOpen;
  const showDeliverables = deliverables.length > 0 || addingDeliverable;
  const showLinks = hasVaultLinks || addingLink;

  // Opened inside the tap that asked for it, so the new field is focused
  // while the tap still counts: a phone only raises its keyboard for that.
  const openNow = (open: (v: boolean) => void) => flushSync(() => open(true));

  // A new date can send the card elsewhere in the list, or to another
  // section. Bring it into view where it landed — unless the edit ended
  // with a tap into some other field, which shouldn't be scrolled away from.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moved) return;
    const card = cardRef.current;
    const active = document.activeElement;
    if (card && (!active || active === document.body || card.contains(active))) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const t = setTimeout(() => onMovedSeen?.(), 1600);
    return () => clearTimeout(t);
  }, [moved]); // eslint-disable-line react-hooks/exhaustive-deps

  const readValue = 'px-2 py-1.5 text-[13px] leading-snug';

  return (
    <div
      ref={cardRef}
      className={`@container group bg-neutral-900/40 border ${compact ? 'p-4' : 'p-5 md:p-6'} rounded-2xl transition-all relative flex flex-col h-full overflow-hidden ${
        moved ? 'border-accent/60 ring-2 ring-accent/30' : 'border-white/5'
      } ${isClient ? '' : 'hover:border-accent/30 hover:bg-neutral-900/60'}`}
    >
      {/* Background Decor */}
      <div className="hidden md:block absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-accent/10 transition-colors pointer-events-none" />

      <div className="flex justify-between items-start mb-4 relative z-10 gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Status is a real control. Hold → Booked is the most common edit
              on this board. */}
          {isClient || !onStatusChange ? (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${statusTone[currentStatus] || 'bg-white/5 border-white/5 text-white'}`}>
              {getStatusIcon(job.job_status)}
              <span className="text-[10px] font-semibold tracking-wide">{currentStatus}</span>
            </div>
          ) : (
            <ChipSelect
              value={currentStatus}
              options={STATUS_OPTIONS}
              onChange={(s) => onStatusChange(s as Job['job_status'])}
              ariaLabel={`Status for ${job.title}`}
              className={statusTone[currentStatus] || 'bg-white/5 border-white/5 text-white'}
            >
              {getStatusIcon(job.job_status)}
              {currentStatus}
            </ChipSelect>
          )}
          {gearCount > 0 && (
            isClient ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-full border border-accent/20">
                <Package className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-medium tracking-wide text-accent">{gearCount} Gear</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onBuildGear?.()}
                aria-label={`Open the gear list — ${gearCount} items`}
                className="flex items-center gap-1 h-7 pointer-coarse:h-10 px-2.5 bg-accent/10 hover:bg-accent/20 rounded-full border border-accent/20 transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-medium tracking-wide text-accent">{gearCount} gear</span>
              </button>
            )
          )}
        </div>
        {/* The details are edited on the card, the crew and the full form
            from the footer; what's left here is what you do *with* a
            production — gear, exports, copies — and the housekeeping. */}
        {!isClient && (
          <DropdownMenu
            align="right"
            trigger={({ onClick, ref, ...aria }) => (
              <button
                ref={ref}
                onClick={onClick}
                {...aria}
                aria-haspopup="menu"
                aria-label={`More for ${job.title}`}
                data-tour="slate-card-menu"
                className="p-2 pointer-coarse:p-3 -mr-1 -mt-1 shrink-0 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            )}
            items={[
              { label: 'Build gear list', icon: <Package className="w-3.5 h-3.5" />, onSelect: () => onBuildGear?.() },
              { label: 'Export call sheet', icon: <ClipboardList className="w-3.5 h-3.5" />, onSelect: onExportCallSheet },
              {
                label: 'Export production brief',
                hint: 'Full PDF: crew, gear, schedule',
                icon: <FileText className="w-3.5 h-3.5" />,
                onSelect: async () => {
                  try {
                    await generateMasterBrief(job.id);
                  } catch (err) {
                    console.error(err);
                    toast('Failed to generate Master Production Brief.');
                  }
                },
              },
              {
                label: 'Duplicate for next day',
                hint: 'Copies gear, crew & details',
                icon: <CalendarPlus className="w-3.5 h-3.5" />,
                onSelect: onDuplicate,
              },
              { label: 'Save crew as template', icon: <BookmarkPlus className="w-3.5 h-3.5" />, onSelect: onSaveAsTemplate },
              job.archived_at
                ? { label: 'Unarchive', hint: 'Back onto the Slate', icon: <ArchiveRestore className="w-3.5 h-3.5" />, onSelect: () => onArchive?.() }
                : { label: 'Archive', hint: 'Keep it, out of the way', icon: <Archive className="w-3.5 h-3.5" />, onSelect: () => onArchive?.() },
              { label: 'Delete production', icon: <Trash2 className="w-3.5 h-3.5" />, onSelect: onDelete, danger: true },
            ]}
          />
        )}
      </div>

      <div className="flex-1 relative z-10 text-white">
        {/* The title opens the full form, as does "All details" below. */}
        {isClient ? (
          <h3 className="text-lg font-semibold tracking-tight mb-1 line-clamp-2">{job.title}</h3>
        ) : (
          <button
            onClick={onEdit}
            className="text-left w-full mb-1 pointer-coarse:min-h-10 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <h3 className="text-lg font-semibold tracking-tight hover:text-accent transition-colors line-clamp-2">{job.title}</h3>
          </button>
        )}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <p className="text-[12px] font-medium tracking-tight opacity-50">{job.client_name || 'Individual Client'}</p>
          {projectName && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-tight px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20">
              <FolderKanban className="w-2.5 h-2.5" /> {projectName}
            </span>
          )}
        </div>

        {/* The facts that change the night before, laid out like the top of
            a call sheet. Each value is its own editor: tap the call time
            and the time picker opens; tap the venue and type. */}
        <dl className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-1.5 gap-y-1 text-white/85">
          <dt className={DETAIL_LABEL}>{multiDay ? 'Dates' : 'Date'}</dt>
          <dd className="flex flex-wrap items-center gap-1 min-w-0">
            {isClient ? (
              <span className={readValue}>
                {job.shoot_date ? cardDate(job.shoot_date) : 'TBD'}
                {multiDay && ` → ${cardDate(job.end_date!)}`}
              </span>
            ) : (
              <>
                <InlinePicker
                  type="date"
                  value={job.shoot_date || ''}
                  format={cardDate}
                  placeholder="Add a date"
                  placeholderClassName="text-amber-300"
                  ariaLabel={multiDay ? `First day of ${job.title}` : `Shoot date for ${job.title}`}
                  onSave={(next) => void onMoveShootDate(next)}
                  className="flex-1 basis-28"
                />
                {multiDay && (
                  <>
                    <span aria-hidden className="text-white/30 text-xs">→</span>
                    <InlinePicker
                      type="date"
                      value={job.end_date || ''}
                      min={job.shoot_date}
                      format={cardDate}
                      placeholder="One day"
                      ariaLabel={`Last day of ${job.title}`}
                      // Cleared, or set back onto the first day: a one-day shoot.
                      onSave={(next) => void onPatch({ end_date: next && next > (job.shoot_date || '') ? next : null }, 'change the last day')}
                      className="flex-1 basis-28"
                    />
                  </>
                )}
              </>
            )}
          </dd>

          <dt className={DETAIL_LABEL}>Call</dt>
          <dd className="flex flex-wrap items-center gap-1.5 min-w-0">
            {isClient ? (
              <span className={`${readValue} flex-1 basis-[5.5rem]`}>{job.call_time || 'TBD'}</span>
            ) : (
              <InlinePicker
                type="time"
                value={toTimeInputValue(job.call_time)}
                format={fromTimeInputValue}
                // A call time the parser can't read ("after load-in") still
                // shows as written rather than turning into TBD.
                placeholder={job.call_time || 'TBD'}
                ariaLabel={`Call time for ${job.title}`}
                onSave={(next) => void onPatch({ call_time: fromTimeInputValue(next) }, 'change the call time')}
                className="flex-1 basis-[5.5rem]"
              />
            )}
            {/* On a small card Wrap moves under Call rather than both times being cut to "7:…". */}
            <span className="flex flex-1 basis-[7.5rem] items-center gap-1.5 min-w-0">
              <span className="shrink-0 text-[11px] font-medium text-white/40 px-1">Wrap</span>
              {isClient ? (
                <span className={`${readValue} flex-1`}>{job.wrap_time || '—'}{overnight && ' (+1)'}</span>
              ) : (
                <InlinePicker
                  type="time"
                  value={toTimeInputValue(job.wrap_time)}
                  format={(v) => (
                    <>
                      {fromTimeInputValue(v)}
                      {/* A wrap at or before the call is a night shoot. */}
                      {overnight && <span className="ml-1 text-[11px] text-white/40" title="Runs past midnight">+1</span>}
                    </>
                  )}
                  placeholder={job.wrap_time || 'TBD'}
                  ariaLabel={`Wrap time for ${job.title}`}
                  onSave={(next) => void onPatch({ wrap_time: fromTimeInputValue(next) }, 'change the wrap time')}
                  className="flex-1"
                />
              )}
            </span>
          </dd>

          {(!isClient || job.location_name) && (
            <>
              <dt className={DETAIL_LABEL}>Venue</dt>
              <dd className="min-w-0">
                {isClient ? (
                  <p className={`${readValue} font-semibold`}>{job.location_name}</p>
                ) : (
                  <InlineText
                    value={job.location_name}
                    placeholder="Add a venue"
                    ariaLabel={`Venue for ${job.title}`}
                    onSave={(next) => void onPatch({ location_name: next }, 'change the venue')}
                    className="font-semibold"
                  />
                )}
              </dd>
            </>
          )}

          {(!isClient || job.location_address) && (
            <>
              <dt className={DETAIL_LABEL}>Address</dt>
              <dd className="min-w-0 text-white/60">
                {isClient ? (
                  <p className={readValue}>{job.location_address}</p>
                ) : (
                  <InlineText
                    value={job.location_address}
                    placeholder="Add an address"
                    ariaLabel={`Address for ${job.title}`}
                    onSave={(next) => void onPatch({ location_address: next }, 'change the address')}
                  />
                )}
              </dd>
            </>
          )}

          {job.weather_summary && (
            <>
              <dt className={DETAIL_LABEL}>Weather</dt>
              <dd className="flex items-center gap-1 min-w-0">
                <span className={`${readValue} flex-1 flex items-center gap-1.5 text-white/70`}>
                  <CloudSun className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
                  {job.weather_summary}
                </span>
                {!isClient && (
                  <button
                    onClick={() => onRefreshWeather?.()}
                    className="shrink-0 w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 grid place-items-center hover:bg-white/5 rounded-lg text-white/40 hover:text-accent transition-colors cursor-pointer"
                    title="Refresh weather forecast"
                    aria-label="Refresh weather forecast"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </dd>
            </>
          )}
        </dl>

        {showNotes && (
          <CardSection icon={<FileText className="w-3 h-3" />} label="Notes" tour="slate-notes">
            {isClient ? (
              <p className={`${readValue} text-white/80 whitespace-pre-wrap line-clamp-4`}>{job.notes_general}</p>
            ) : (
              <InlineText
                multiline
                restLines={4}
                autoFocus={notesOpen && !job.notes_general}
                value={job.notes_general}
                placeholder="Parking, load-in, who to ask for…"
                ariaLabel={`Notes for ${job.title}`}
                onSave={(next) => void onPatch({ notes_general: next }, 'save the notes')}
                onDone={() => setNotesOpen(false)}
                className="text-white/80"
              />
            )}
          </CardSection>
        )}

        {/* Who's on it. Capped, because a 20-person call sheet is a document,
            not a card — the count and the footer lead to the full crew list. */}
        {crew.length > 0 && (
          <CardSection
            icon={<Users className="w-3 h-3" />}
            label="Crew"
            meta={<span className="text-[10px] text-white/30">{crew.length}</span>}
          >
            <div className="space-y-1 px-2">
              {crew.slice(0, 4).map(r => {
                const who = r.contact?.name || r.name || '';
                return (
                  <div key={r.id} className="flex items-baseline gap-2 text-[11px] min-w-0">
                    <span className="text-white/45 shrink-0 max-w-[45%] truncate">{r.position || 'Crew'}</span>
                    <span className={`flex-1 min-w-0 truncate ${who ? 'text-white/85' : 'text-white/30 italic'}`}>
                      {who || 'Unassigned'}
                    </span>
                    {r.call_time && <span className="text-[10px] text-white/30 shrink-0 tabular-nums">{r.call_time}</span>}
                  </div>
                );
              })}
            </div>
            {crew.length > 4 && (
              <p className="mt-2 px-2 text-[10px] font-medium text-white/40">+{crew.length - 4} more</p>
            )}
          </CardSection>
        )}

        {/* Deliverables pinned to this production, each edited in its row:
            the name is typed over, the format and status are dropdowns. */}
        {showDeliverables && (
          <CardSection
            icon={<Film className="w-3 h-3" />}
            label="Deliverables"
            tour="slate-deliverables"
            meta={deliverables.length > 0 && (
              <span className="text-[10px] text-white/30">
                {deliverables.filter(d => d.status === 'delivered').length}/{deliverables.length} delivered
              </span>
            )}
          >
            <ul className="space-y-2 @sm:space-y-1">
              {/* A narrow card gives the name its own line: beside the format,
                  status and remove controls it was cut to "Short Form x1…". */}
              {deliverables.map(d => (
                <li key={d.id} className="flex flex-wrap @sm:flex-nowrap items-center gap-1.5">
                  {isClient ? (
                    <span className={`${readValue} flex-1 basis-full @sm:basis-auto text-white/80 truncate`}>{d.label || 'Untitled'}</span>
                  ) : (
                    <InlineText
                      value={d.label}
                      placeholder="Untitled — add a name"
                      ariaLabel="Deliverable name"
                      onSave={(next) => onPatchDeliverable?.(d.id, { label: next })}
                      className="flex-1 basis-full @sm:basis-auto text-white/85"
                    />
                  )}
                  {isClient ? (
                    <span className="px-2 text-[11px] text-white/45">{d.format || '16:9'}</span>
                  ) : (
                    <ChipSelect
                      value={d.format || '16:9'}
                      options={withCurrent(DELIVERABLE_FORMATS, d.format || '16:9')}
                      onChange={(format) => onPatchDeliverable?.(d.id, { format })}
                      ariaLabel={`Format for ${d.label || 'this deliverable'}`}
                      className="border-white/10 text-white/60 tabular-nums"
                    >
                      {d.format || '16:9'}
                    </ChipSelect>
                  )}
                  {isClient ? (
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${deliverableStatusTone(d.status)}`}>
                      {deliverableStatusLabel(d.status)}
                    </span>
                  ) : (
                    <ChipSelect
                      value={d.status || 'todo'}
                      options={withCurrent(DELIVERABLE_STATUS, d.status || 'todo', deliverableStatusLabel)}
                      onChange={(status) => onPatchDeliverable?.(d.id, { status })}
                      ariaLabel={`Status of ${d.label || 'this deliverable'}`}
                      className={deliverableStatusTone(d.status)}
                    >
                      {deliverableStatusLabel(d.status)}
                    </ChipSelect>
                  )}
                  {!isClient && (
                    <button
                      type="button"
                      aria-label={`Remove ${d.label || 'deliverable'}`}
                      title="Remove"
                      onClick={() => onRemoveDeliverable?.(d.id)}
                      className="ml-auto shrink-0 w-8 h-8 pointer-coarse:w-10 pointer-coarse:h-10 grid place-items-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {addingDeliverable && (
                <li>
                  <AddLine
                    placeholder="Name it, e.g. 60s hero cut — Enter for another"
                    ariaLabel="New deliverable name"
                    onAdd={(label) => onAddDeliverable?.(label)}
                    onClose={() => setAddingDeliverable(false)}
                  />
                </li>
              )}
            </ul>
            {!isClient && !addingDeliverable && (
              <div className="mt-1.5">
                <AddButton onClick={() => openNow(setAddingDeliverable)}>Add deliverable</AddButton>
              </div>
            )}
          </CardSection>
        )}

        {/* QuickBooks, read-only. Only rendered once the client has actually
            been billed something — an empty billing block on every card would
            be the "No links" placeholder all over again. */}
        {billing && (billing.invoiced > 0 || billing.estimateCount > 0) && (
          <CardSection
            icon={<Receipt className="w-3 h-3" />}
            label="Billing"
            meta={billing.overdue > 0 ? (
              <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">
                {currency(billing.overdue)} overdue
              </span>
            ) : billing.outstanding > 0 ? (
              <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {currency(billing.outstanding)} open
              </span>
            ) : billing.invoiced > 0 ? (
              <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/25">
                Paid in full
              </span>
            ) : null}
          >
            <div className="flex items-center gap-3 px-2 text-[10px] font-semibold text-white/50">
              {billing.invoiced > 0 && <span>{currency(billing.invoiced)} invoiced</span>}
              {billing.estimateCount > 0 && (
                <span className="text-white/35">
                  {currency(billing.estimateTotal)} quoted{billing.estimateCount > 1 ? ` · ${billing.estimateCount}` : ''}
                </span>
              )}
            </div>
          </CardSection>
        )}

        {/* Links. Called "Project Vault" before, which read as the password
            Vault. A link pasted here can be taken off again here; drafts
            belong to the Edit Tracker, and the review, Discord and Drive
            links to wherever set them. */}
        {showLinks && (
          <CardSection icon={<LinkIcon className="w-3 h-3" />} label="Links">
            {hasVaultLinks && (
              <div className="grid grid-cols-2 gap-1.5">
                {job.review_link && !reviewIsDraft && (
                  <a href={sanitizeUrl(job.review_link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 h-9 pointer-coarse:h-11 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <Eye className="w-3 h-3 text-accent shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Review</span>
                  </a>
                )}
                {job.discord_url && (
                  <a href={sanitizeUrl(job.discord_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 h-9 pointer-coarse:h-11 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <MessageSquare className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Discord</span>
                  </a>
                )}
                {job.drive_folder_url && (
                  <a href={sanitizeUrl(job.drive_folder_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 h-9 pointer-coarse:h-11 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <FolderOpen className="w-3 h-3 text-yellow-500 shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Drive</span>
                  </a>
                )}
                {vaultLinks.map((link, i) => {
                  const removable = !isClient && link.category !== 'Draft';
                  return (
                    <div key={i} className="flex items-stretch min-w-0 bg-white/5 rounded-lg border border-white/5">
                      <a href={sanitizeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center gap-2 px-2 h-9 pointer-coarse:h-11 rounded-lg hover:bg-white/10 transition-colors group/link">
                        <ExternalLink className="w-3 h-3 text-white/30 shrink-0" />
                        <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100 truncate">{link.label}{link.version ? ` v${link.version}` : ''}</span>
                      </a>
                      {removable && (
                        <button
                          type="button"
                          onClick={() => onRemoveLink(link)}
                          aria-label={`Remove the ${link.label} link`}
                          title="Remove"
                          className="shrink-0 w-7 pointer-coarse:w-10 grid place-items-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!isClient && (
              addingLink ? (
                <div className={hasVaultLinks ? 'mt-2' : ''}>
                  <AddLinkForm onAdd={onAddLink} onClose={() => setAddingLink(false)} />
                </div>
              ) : (
                <div className="mt-1.5">
                  <AddButton onClick={() => openNow(setAddingLink)}>Add link</AddButton>
                </div>
              )
            )}
          </CardSection>
        )}

        {/* The sections this card doesn't have yet, one tap each. They open
            in their place above, with the cursor already in them. */}
        {!isClient && (!showNotes || !showDeliverables || !showLinks) && (
          <div className="pt-3 mt-4 border-t border-white/5 flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30 mr-1">Add</span>
            {!showNotes && <AddButton tour="slate-notes" label="Add notes" onClick={() => openNow(setNotesOpen)}>Notes</AddButton>}
            {!showDeliverables && <AddButton tour="slate-deliverables" label="Add a deliverable" onClick={() => openNow(setAddingDeliverable)}>Deliverable</AddButton>}
            {!showLinks && <AddButton label="Add a link" onClick={() => openNow(setAddingLink)}>Link</AddButton>}
          </div>
        )}
      </div>

      {/* Footer: the two bigger editors. The crew manager (booking, the day's
          schedule, call times per person) and the full production form, for
          everything the card doesn't show. */}
      {!isClient && (
        <div className="pt-4 mt-4 border-t border-white/5 grid grid-cols-2 gap-2 relative z-10">
          <button
            type="button"
            onClick={onEdit}
            className="h-9 pointer-coarse:h-11 px-2 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[12px] font-medium tracking-tight whitespace-nowrap text-white/60 hover:text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" /> All details
          </button>
          <button
            type="button"
            onClick={onManage}
            data-tour="slate-crew"
            className="h-9 pointer-coarse:h-11 px-2 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[12px] font-medium tracking-tight whitespace-nowrap text-white/60 hover:text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" /> Crew & schedule
          </button>
        </div>
      )}
    </div>
  );
}
