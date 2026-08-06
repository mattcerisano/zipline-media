'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search,
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  Clock,
  ChevronRight,
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
  Mail
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { postNotify } from '@/lib/notify';
import { useRealtime } from '@/lib/useRealtime';
import { Job, STATUSES, JobLink, Client, Project } from '@/components/gearbuilder/types';
import Autocomplete from 'react-google-autocomplete';
import TeamBuilder from '@/components/teambuilder/TeamBuilder';
import { generateMasterBrief } from '@/lib/pdf-generator';
import { fetchGearCategoryMap, groupManifestByCategory, buildGearTableBody } from '@/lib/gear-manifest';
import { getBranding, hexToRgb } from '@/lib/branding';
import { sanitizeUrl } from '@/lib/sanitize';
import { formatLocalDate, todayLocalISO } from '@/lib/date';
import { pushJobToGoogleCalendar, removeJobFromGoogleCalendar } from '@/lib/calendar-push';
import { caps, currency } from '@/lib/format';
import { toast, confirmAction, promptAction } from '@/components/Feedback';
import { Modal, DropdownMenu } from '@/components/workspace/Overlay';
import type { BillingSummary } from '@/app/api/integrations/quickbooks/route';
import {
  type Deliverable,
  DELIVERABLE_FORMATS,
  nextDeliverableStatus,
  deliverableStatusLabel,
  deliverableStatusTone,
} from '@/lib/deliverables';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
  newProductionDate,
  onClearNewProductionDate
}: { 
  userRole?: string, 
  onBuildGear?: (job: Job) => void,
  preselectedJobId?: string | null,
  onClearPreselectedJobId?: () => void,
  /** Shoot date handed over by the Calendar tab's "New production" action. */
  newProductionDate?: string | null,
  onClearNewProductionDate?: () => void
} = {}) {
  const isClient = userRole === 'client';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [groupByProject, setGroupByProject] = useState(false);
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
    shoot_date: new Date().toISOString().split('T')[0],
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
    setIsJobModalOpen(false);
  };

  const openNewJobModal = (shootDate?: string) => {
    const blank: Partial<Job> = {
      title: '',
      client_name: '',
      production_company: '',
      job_status: 'Planning',
      type: 'production',
      // toISOString() here gave the UTC day, so an evening west of UTC
      // pre-filled tomorrow's date on a form that says "today".
      shoot_date: shootDate || todayLocalISO(),
      // Call time defaults to TBD rather than inventing an 8:00 AM call
      // nobody chose — which also pushed a wrong time to Google Calendar.
      // An empty call time syncs as an all-day event until it's set.
      call_time: '',
      location_name: '',
      location_address: '',
      notes_general: '',
      links: []
    };
    setEditingJob(blank);
    setJobModalBaseline(JSON.stringify(blank));
    setShowJobDetails(false);
    setIsJobModalOpen(true);
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
    setEditingJob(prev => ({ 
      ...prev, 
      location_address: place.formatted_address || '',
      location_name: place.name || prev.location_name || ''
    }));
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
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const geoData = await geoRes.json();
      if (!geoRes.ok) throw new Error(geoData.error || 'Geocoding failed');
      const { lat, lng } = geoData;

      // 2. Fetch nearest hospital
      const hospRes = await fetch(`/api/hospital?address=${encodeURIComponent(address)}`);
      const hospData = await hospRes.json();
      let hospitalName = '';
      let hospitalAddr = '';
      if (hospRes.ok && hospData) {
        hospitalName = hospData.name;
        hospitalAddr = hospData.address;
      }

      // 3. Fetch nearest parking
      const parkRes = await fetch(`/api/parking?address=${encodeURIComponent(address)}`);
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
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
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

  // Link Modal
  const [linkModalJob, setLinkModalJob] = useState<Job | null>(null);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  // Live team sync: refetch when any teammate changes jobs/clients/projects
  useRealtime(['jobs', 'clients', 'projects'], () => fetchJobs());

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

  // Arrived from Calendar → "New production" on a specific day. Same handoff as
  // preselectedJobId above, but for a shoot that doesn't exist yet: open the
  // full form with that date already set, then clear so closing it stays closed.
  useEffect(() => {
    if (!newProductionDate) return;
    openNewJobModal(newProductionDate);
    onClearNewProductionDate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProductionDate]);

  const fetchJobs = async () => {
    setIsLoading(true);
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
      if (editingJob.client_name && editingJob.client_name.trim()) {
        const name = editingJob.client_name.trim();
        let client = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (!client) {
          const { data: newClientData } = await supabase
            .from('clients')
            .insert([{ name }])
            .select()
            .single();
          if (newClientData) {
            client = newClientData as Client;
            setClients(prev => [...prev, client as Client]);
          }
        }
        if (client) jobPayload.client_id = client.id;
      } else {
        jobPayload.client_id = undefined;
      }

      if (editingJob.id) {
        const { data, error } = await supabase
          .from('jobs')
          .update(jobPayload)
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
      }

      // Auto-populate Google Calendar. This is the whole point of Slate: a
      // production booked here lands on the team's calendar without anyone
      // re-entering it. Fire-and-forget — the row is already saved, and a
      // failed push is reported without rolling anything back.
      if (savedJobData?.id) {
        pushJobToGoogleCalendar(savedJobData.id).then(result => {
          if (!result.ok && result.message) {
            toast(result.message);
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
   * 13-field modal and saving it. Optimistic, with the Google Calendar push
   * left to the modal — a status change doesn't alter the event's timing.
   */
  const updateJobStatus = async (job: Job, status: Job['job_status']) => {
    if (!status || status === job.job_status) return;
    const previous = job.job_status;
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, job_status: status } : j)));
    const { error } = await supabase.from('jobs').update({ job_status: status }).eq('id', job.id);
    if (error) {
      console.error('Error updating status:', error);
      setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, job_status: previous } : j)));
      toast('Failed to update status.');
      return;
    }
    sendNotification(`status_${status.toLowerCase()}`, { ...job, job_status: status }, previous);
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
        ...copy
      } = job as any;

      const payload = {
        ...copy,
        title: nextDayTitle(job.title),
        shoot_date: job.shoot_date ? nextShootDate(job.shoot_date) : undefined,
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
          if (rolesErr) console.error('Duplicated job but crew copy failed:', rolesErr);
        }
      } catch (rolesErr) {
        console.error('Duplicated job but crew copy failed:', rolesErr);
      }

      setJobs(prev => [...prev, data as Job].sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));
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

  const addCustomLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkModalJob || !newLinkLabel || !newLinkUrl) return;

    const updatedLinks = [...(linkModalJob.links || []), { label: newLinkLabel, url: newLinkUrl }];
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ links: updatedLinks })
        .eq('id', linkModalJob.id);

      if (error) throw error;
      
      setJobs(prev => prev.map(j => j.id === linkModalJob.id ? { ...j, links: updatedLinks } : j));
      setLinkModalJob(null);
      setNewLinkLabel('');
      setNewLinkUrl('');
    } catch (err) {
      console.error('Error adding link:', err);
      toast('Failed to add link');
    }
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

  // A new row starts blank and inherits the job's client, so it also lands in
  // the Social tab's list under the right name instead of an orphaned dash.
  const addDeliverable = async (job: Job) => {
    const { data, error } = await supabase
      .from('social_deliverables')
      .insert([{ job_id: job.id, client_id: job.client_id || null, label: '', format: '16:9', status: 'todo' }])
      .select()
      .single();
    if (error || !data) { toast('Could not add the deliverable.'); return; }
    setDeliverables(prev => ({ ...prev, [job.id]: [...(prev[job.id] || []), data as Deliverable] }));
  };

  const patchDeliverable = async (jobId: string, id: string, patch: Partial<Deliverable>) => {
    setDeliverables(prev => ({
      ...prev,
      [jobId]: (prev[jobId] || []).map(d => (d.id === id ? { ...d, ...patch } : d)),
    }));
    const { error } = await supabase.from('social_deliverables').update(patch).eq('id', id);
    if (error) { toast('Could not save that change.'); void loadDeliverables(jobIdsOnBoard); }
  };

  const removeDeliverable = async (jobId: string, id: string) => {
    const prior = deliverables[jobId] || [];
    setDeliverables(prev => ({ ...prev, [jobId]: prior.filter(d => d.id !== id) }));
    const { error } = await supabase.from('social_deliverables').delete().eq('id', id);
    if (error) { toast('Could not remove that deliverable.'); setDeliverables(prev => ({ ...prev, [jobId]: prior })); }
  };


  const filteredJobs = useMemo(() => {
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
    const today = new Date().toISOString().split('T')[0];
    // Compared against the *last* day so a multi-day shoot stays "upcoming"
    // while it is still running, rather than archiving itself on day two.
    return filteredJobs.filter(j => j.shoot_date && (lastDayOf(j) as string) >= today);
  }, [filteredJobs]);

  const pastJobs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-neutral-900/40 p-6 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row items-center gap-4 flex-1 w-full max-w-4xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text"
              placeholder="Search jobs or clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 p-3 pl-12 rounded-xl outline-none focus:border-accent transition-all text-[13px] font-medium tracking-tight text-white"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Filter className="w-4 h-4 text-white/20 hidden md:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:flex-none bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-[13px] font-medium tracking-tight cursor-pointer appearance-none min-w-[120px] text-white"
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
              className="flex-1 md:flex-none bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-[13px] font-medium tracking-tight cursor-pointer appearance-none min-w-[120px] text-white"
            >
              <option value="All">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{caps(c.name)}</option>
              ))}
            </select>

            {/* Project filter (scoped to selected client) */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              disabled={projectsForFilter.length === 0}
              className="flex-1 md:flex-none bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-[13px] font-medium tracking-tight cursor-pointer appearance-none min-w-[120px] text-white disabled:opacity-30"
            >
              <option value="All">All Projects</option>
              {projectsForFilter.map(p => (
                <option key={p.id} value={p.id}>{caps(p.name)}</option>
              ))}
            </select>

            {/* Group-by-project toggle */}
            <button
              type="button"
              onClick={() => setGroupByProject(v => !v)}
              title="Group jobs by project"
              className={`flex-1 md:flex-none p-3 rounded-xl border text-[13px] font-medium tracking-tight transition-all min-w-[110px] ${groupByProject ? 'bg-accent text-white border-accent' : 'bg-black/50 border-white/10 text-white/60 hover:text-white'}`}
            >
              {groupByProject ? 'Grouped' : 'Group'}
            </button>
          </div>
        </div>

        {!isClient && (
          <button 
            onClick={() => openNewJobModal()}
            className="bg-accent text-white px-8 py-4 rounded-xl font-semibold tracking-tight text-sm hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center gap-3 w-full lg:w-auto justify-center"
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
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-accent whitespace-nowrap">{cg.name}</h2>
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
                      <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70 whitespace-nowrap">{pg.name}</h3>
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[10px] font-medium opacity-40 tracking-tight text-white">{pg.jobs.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pg.jobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isClient={isClient}
                          getStatusIcon={getStatusIcon}
                          onSaveAsTemplate={() => saveAsTemplate(job)}
                          onDuplicate={() => duplicateJob(job)}
                          onDelete={() => deleteJob(job.id)}
                          onAddLink={() => setLinkModalJob(job)}
                          onManage={() => setManageJobId(job.id)}
                          onExportCallSheet={() => { setExportOptions(DEFAULT_CALL_SHEET_OPTIONS); setExportJob(job); }}
                          onEdit={() => openEditJobModal(job)}
                          onBuildGear={() => onBuildGear?.(job)}
                          onRefreshWeather={() => handleRefreshWeather(job)}
                          onStatusChange={(status) => updateJobStatus(job, status)}
                  billing={job.client_id ? billing[job.client_id] : undefined}
                  deliverables={deliverables[job.id]}
                  onAddDeliverable={() => addDeliverable(job)}
                  onPatchDeliverable={(id, patch) => patchDeliverable(job.id, id, patch)}
                  onRemoveDeliverable={(id) => removeDeliverable(job.id, id)}
                        />
                      ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unscheduledJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isClient={isClient}
                  getStatusIcon={getStatusIcon}
                  onSaveAsTemplate={() => saveAsTemplate(job)}
                  onDuplicate={() => duplicateJob(job)}
                  onDelete={() => deleteJob(job.id)}
                  onAddLink={() => setLinkModalJob(job)}
                  onManage={() => setManageJobId(job.id)}
                  onExportCallSheet={() => { setExportOptions(DEFAULT_CALL_SHEET_OPTIONS); setExportJob(job); }}
                  onEdit={() => openEditJobModal(job)}
                  onBuildGear={() => onBuildGear?.(job)}
                  onRefreshWeather={() => handleRefreshWeather(job)}
                  onStatusChange={(status) => updateJobStatus(job, status)}
                  billing={job.client_id ? billing[job.client_id] : undefined}
                  projectName={job.project_id ? projectNameById.get(job.project_id) : undefined}
                  deliverables={deliverables[job.id]}
                  onAddDeliverable={() => addDeliverable(job)}
                  onPatchDeliverable={(id, patch) => patchDeliverable(job.id, id, patch)}
                  onRemoveDeliverable={(id) => removeDeliverable(job.id, id)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent whitespace-nowrap">Upcoming Productions</h2>
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[11px] font-medium opacity-40 tracking-tight text-white">{upcomingJobs.length} Jobs</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                isClient={isClient}
                getStatusIcon={getStatusIcon} 
                onSaveAsTemplate={() => saveAsTemplate(job)}
                onDuplicate={() => duplicateJob(job)}
                onDelete={() => deleteJob(job.id)}
                onAddLink={() => setLinkModalJob(job)}
                onManage={() => setManageJobId(job.id)}
                onExportCallSheet={() => { setExportOptions(DEFAULT_CALL_SHEET_OPTIONS); setExportJob(job); }}
                onEdit={() => openEditJobModal(job)}
                onBuildGear={() => onBuildGear?.(job)}
                onRefreshWeather={() => handleRefreshWeather(job)}
                onStatusChange={(status) => updateJobStatus(job, status)}
                billing={job.client_id ? billing[job.client_id] : undefined}
                deliverables={deliverables[job.id]}
                onAddDeliverable={() => addDeliverable(job)}
                onPatchDeliverable={(id, patch) => patchDeliverable(job.id, id, patch)}
                onRemoveDeliverable={(id) => removeDeliverable(job.id, id)}
                projectName={job.project_id ? projectNameById.get(job.project_id) : undefined}
              />
            ))}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {pastJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                isClient={isClient}
                getStatusIcon={getStatusIcon} 
                onSaveAsTemplate={() => saveAsTemplate(job)}
                onDuplicate={() => duplicateJob(job)}
                onDelete={() => deleteJob(job.id)}
                onAddLink={() => setLinkModalJob(job)}
                onManage={() => setManageJobId(job.id)}
                onExportCallSheet={() => { setExportOptions(DEFAULT_CALL_SHEET_OPTIONS); setExportJob(job); }}
                onEdit={() => openEditJobModal(job)}
                onBuildGear={() => onBuildGear?.(job)}
                onRefreshWeather={() => handleRefreshWeather(job)}
                onStatusChange={(status) => updateJobStatus(job, status)}
                billing={job.client_id ? billing[job.client_id] : undefined}
                deliverables={deliverables[job.id]}
                onAddDeliverable={() => addDeliverable(job)}
                onPatchDeliverable={(id, patch) => patchDeliverable(job.id, id, patch)}
                onRemoveDeliverable={(id) => removeDeliverable(job.id, id)}
                projectName={job.project_id ? projectNameById.get(job.project_id) : undefined}
              />
            ))}
          </div>
        </section>
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
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Title</label>
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
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Client Name <span className="opacity-60 normal-case tracking-normal font-medium">(who you bill)</span></label>
                  <input
                    type="text"
                    placeholder="Client name"
                    value={editingJob.client_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = clients.find(c => c.name.trim().toLowerCase() === val.trim().toLowerCase());
                      setEditingJob(prev => ({
                        ...prev,
                        client_name: val,
                        client_id: match ? match.id : prev.client_id,
                        // Auto-pull the bill-to contact email from the Rolodex (only if not already set)
                        contact_email: (match && match.email && !prev.contact_email) ? match.email : prev.contact_email,
                      }));
                    }}
                    list="slate-clients"
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                  />
                  <datalist id="slate-clients">
                    {clients.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                  {(() => {
                    const match = clients.find(c => c.name.trim().toLowerCase() === (editingJob.client_name || '').trim().toLowerCase());
                    const details = match ? [match.email, match.phone, match.address].filter(Boolean).join('  ·  ') : '';
                    if (!details) return null;
                    return (
                      <p className="text-[8px] font-medium text-accent/70 ml-1 mt-0.5 flex items-center gap-1 normal-case tracking-normal">
                        <Building2 className="w-2.5 h-2.5 shrink-0" /> Pulled from Rolodex: {details}
                      </p>
                    );
                  })()}
                </div>

                {/* --- section --- */}
                <div className="md:col-span-6 flex items-center gap-3 mt-2 first:mt-0">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">Schedule</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* Job Status */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Job Status</label>
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
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Shoot Date</label>
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
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">End Date <span className="opacity-50 normal-case tracking-normal">(multi-day)</span></label>
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

                {/* Call Time */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Call Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white pointer-events-none z-10" />
                    <select 
                      value={editingJob.call_time || ''}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, call_time: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white appearance-none cursor-pointer"
                    >
                      <option value="">TBD</option>
                      {Array.from({ length: 48 }).map((_, i) => {
                        const hour = Math.floor(i / 2);
                        const min = i % 2 === 0 ? '00' : '30';
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                        const timeStr = `${displayHour}:${min} ${ampm}`;
                        return (
                          <option key={timeStr} value={timeStr}>
                            {timeStr}
                          </option>
                        );
                      })}
                      {editingJob.call_time && !Array.from({ length: 48 }).some((_, i) => {
                        const hour = Math.floor(i / 2);
                        const min = i % 2 === 0 ? '00' : '30';
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                        return `${displayHour}:${min} ${ampm}` === editingJob.call_time;
                      }) && (
                        <option value={editingJob.call_time}>
                          {editingJob.call_time}
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {/* --- section --- */}
                <div className="md:col-span-6 flex items-center gap-3 mt-2 first:mt-0">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">Location</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* Location Name */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Location Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Hudson Theatre"
                    value={editingJob.location_name || ''}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, location_name: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 py-2.5 px-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                  />
                </div>

                {/* Full Address */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Full Address</label>
                  <div className="relative flex">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 text-white z-10" />
                    <Autocomplete
                      key={editingJob.id || 'new-address'}
                      apiKey={GOOGLE_MAPS_API_KEY}
                      onPlaceSelected={handlePlaceSelected}
                      defaultValue={editingJob.location_address || ''}
                      placeholder="Street, City, State, Zip"
                      className="w-full bg-black/50 border border-white/10 py-2.5 pl-9 pr-2.5 rounded-lg outline-none focus:border-accent font-semibold text-xs text-white"
                      onBlur={handleAddressBlur}
                    />
                  </div>
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
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Company <span className="opacity-60 normal-case tracking-normal font-medium">(if a prod co hired you for their client)</span></label>
                  <div className="relative">
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
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white flex items-center justify-between">
                    <span>Project</span>
                    <button
                      type="button"
                      onClick={handleCreateProject}
                      className="text-accent hover:text-white transition-colors normal-case tracking-normal font-bold"
                    >
                      + New
                    </button>
                  </label>
                  <div className="relative">
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
                        return opts.map(p => <option key={p.id} value={p.id}>{caps(p.name)}</option>);
                      })()}
                    </select>
                  </div>
                </div>

                {/* Additional Logistics overrides */}
                <div className="space-y-1 md:col-span-6">
                   <div className="flex items-center justify-between mb-0.5">
                     <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">Logistics Overrides (Optional)</h3>
                     {editingJob.location_address && (
                       <button
                         type="button"
                         onClick={handleAutoFillLogistics}
                         disabled={isAutoFillingLogistics}
                         className="px-2 py-0.5 bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white rounded-md text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
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
                   <p className="text-[8px] text-white/30 italic mt-0.5">If left blank, logistics will auto-fetch in the Gear Builder based on the Full Address.</p>
                </div>


                {/* Contact Email (linked correspondence) */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white flex items-center gap-2">
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
                  <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">General Notes</label>
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

      {/* Add Link Modal */}
      <Modal
        open={!!linkModalJob}
        onClose={() => setLinkModalJob(null)}
        title="Add Vault Link"
        subtitle={linkModalJob?.title}
        maxWidth="max-w-md"
      >
              <form onSubmit={addCustomLink} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black tracking-widest uppercase opacity-40 ml-1 text-white">Link Label</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Frame.io Review"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black tracking-widest uppercase opacity-40 ml-1 text-white">URL</label>
                  <input 
                    required
                    type="url"
                    placeholder="https://..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold text-sm text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                   <button
                    type="button"
                    onClick={() => setLinkModalJob(null)}
                    className="px-5 py-2.5 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-accent text-white px-6 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all"
                  >
                    Add Link
                  </button>
                </div>
              </form>
      </Modal>

      {/* Manage Crew Modal (Team Builder) */}
      <Modal
        open={!!manageJobId}
        onClose={() => setManageJobId(null)}
        maxWidth="max-w-6xl"
      >
        {manageJobId && <TeamBuilder predefinedJobId={manageJobId} onClose={() => setManageJobId(null)} />}
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
                        <span className="block text-[9px] text-white/35">{opt.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[9px] text-white/25 mb-4">Rates and fees are never included on exported call sheets.</p>

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

function JobCard({ 
  job, 
  isClient,
  getStatusIcon, 
  onSaveAsTemplate,
  onDuplicate,
  onDelete,
  onAddLink,
  onManage,
  onExportCallSheet,
  onEdit,
  onBuildGear,
  onRefreshWeather,
  onStatusChange,
  billing,
  projectName,
  deliverables = [],
  onAddDeliverable,
  onPatchDeliverable,
  onRemoveDeliverable
}: {
  job: Job,
  isClient: boolean,
  getStatusIcon: (s?: string) => React.ReactNode,
  onSaveAsTemplate: () => void,
  onDuplicate: () => void,
  onDelete: () => void,
  onAddLink: () => void,
  onManage: () => void,
  onExportCallSheet: () => void,
  onEdit: () => void,
  onBuildGear?: () => void,
  onRefreshWeather?: () => void,
  onStatusChange?: (status: Job['job_status']) => void,
  billing?: BillingSummary,
  projectName?: string,
  deliverables?: Deliverable[],
  onAddDeliverable?: () => void,
  onPatchDeliverable?: (id: string, patch: Partial<Deliverable>) => void,
  onRemoveDeliverable?: (id: string) => void
}) {
  const shootDate = formatLocalDate(job.shoot_date, { month: 'short', day: 'numeric', year: 'numeric' });

  const gearCount = job.gear_manifest ? Object.values(job.gear_manifest as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

  const hasVaultLinks = !!(job.review_link || job.discord_url || job.drive_folder_url || job.links?.length);

  const statusTone: Record<string, string> = {
    Booked: 'bg-green-500/10 border-green-500/20 text-green-300',
    Hold: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    Planning: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    Wrapped: 'bg-white/5 border-white/10 text-white/60',
    Cancelled: 'bg-red-500/10 border-red-500/20 text-red-300',
  };
  const currentStatus = job.job_status || 'Planning';

  return (
    <div
      className={`group bg-neutral-900/40 border border-white/5 p-6 rounded-2xl transition-all relative flex flex-col h-full overflow-hidden ${isClient ? '' : 'hover:border-accent/30 hover:bg-neutral-900/60'}`}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-accent/10 transition-colors pointer-events-none" />

      <div className="flex justify-between items-start mb-5 relative z-10 gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Status is a real control now. Hold → Booked is the most common
              edit on this board and used to require the full edit modal. */}
          {isClient || !onStatusChange ? (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${statusTone[currentStatus] || 'bg-white/5 border-white/5 text-white'}`}>
              {getStatusIcon(job.job_status)}
              <span className="text-[10px] font-semibold tracking-wide">{currentStatus}</span>
            </div>
          ) : (
            <div className={`relative flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full border transition-colors ${statusTone[currentStatus] || 'bg-white/5 border-white/5 text-white'}`}>
              {getStatusIcon(job.job_status)}
              <span className="text-[10px] font-semibold tracking-wide">{currentStatus}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
              <select
                value={currentStatus}
                onChange={(e) => onStatusChange(e.target.value as Job['job_status'])}
                aria-label={`Status for ${job.title}`}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {STATUSES.map(s => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
              </select>
            </div>
          )}
          {gearCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-full border border-accent/20">
               <Package className="w-3.5 h-3.5 text-accent" />
               <span className="text-[10px] font-medium tracking-wide text-accent">{gearCount} Gear</span>
            </div>
          )}
        </div>
        {/* One labelled menu instead of six unlabelled icons. Every action
            reads as words, so nothing depends on decoding a glyph or on a
            tooltip that touch devices never show. */}
        {!isClient && (
          <DropdownMenu
            align="right"
            trigger={({ onClick, ref, ...aria }) => (
              <button
                ref={ref}
                onClick={onClick}
                {...aria}
                aria-haspopup="menu"
                aria-label={`Actions for ${job.title}`}
                className="p-2 -mr-1 shrink-0 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            )}
            items={[
              { label: 'Edit production', icon: <Settings2 className="w-3.5 h-3.5" />, onSelect: onEdit },
              { label: 'Crew & schedule', icon: <ChevronRight className="w-3.5 h-3.5" />, onSelect: onManage },
              { label: 'Build gear list', icon: <Package className="w-3.5 h-3.5" />, onSelect: () => onBuildGear?.() },
              { label: 'Add vault link', icon: <LinkIcon className="w-3.5 h-3.5" />, onSelect: onAddLink },
              {
                label: 'Add deliverable',
                hint: 'Cutdown, version or platform cut',
                icon: <Film className="w-3.5 h-3.5" />,
                onSelect: () => onAddDeliverable?.(),
              },
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
              { label: 'Delete production', icon: <Trash2 className="w-3.5 h-3.5" />, onSelect: onDelete, danger: true },
            ]}
          />
        )}
      </div>

      <div className="flex-1 relative z-10 text-white">
        {/* The title is the click target rather than the whole card. Every
            action above used to need stopPropagation to avoid also opening
            the edit modal, and a stray tap anywhere opened it by accident. */}
        {isClient ? (
          <h3 className="text-lg font-semibold tracking-tight mb-1 line-clamp-2">{job.title}</h3>
        ) : (
          <button
            onClick={onEdit}
            className="text-left w-full mb-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-[11px] font-bold text-white/40">
            <Calendar className="w-4 h-4 text-accent/50 shrink-0" />
            <span className="tracking-tight">{shootDate} {job.call_time && `• ${job.call_time}`}</span>
          </div>
          {(job.location_name || job.location_address) && (
            <div className="flex items-start gap-3 text-[11px] font-bold text-white/40">
              <MapPin className="w-4 h-4 text-accent/50 shrink-0 mt-0.5" />
              <span className="tracking-tight leading-snug">
                {job.location_name && <span className="block text-white/80">{job.location_name}</span>}
                {job.location_address && <span className="block text-[10px] opacity-60 mt-0.5">{job.location_address}</span>}
              </span>
            </div>
          )}
          {job.weather_summary && (
            <div className="flex items-center justify-between text-[11px] font-bold text-white/40 p-2.5 bg-white/5 border border-white/5 rounded-xl">
              <div className="flex items-center gap-2">
                <CloudSun className="w-4 h-4 text-amber-500/70 shrink-0" />
                <span className="tracking-tight text-[11px] text-white/80">{job.weather_summary}</span>
              </div>
              {!isClient && (
                <button
                  onClick={() => onRefreshWeather?.()}
                  className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-accent transition-colors cursor-pointer"
                  title="Refresh weather forecast"
                  aria-label="Refresh weather forecast"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {job.notes_general && (
           <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-1">Notes</p>
              <p className="text-xs text-white/80 line-clamp-3 leading-relaxed">{job.notes_general}</p>
           </div>
        )}

        {/* Deliverables pinned to this production. Like the billing block, it
            only appears once there's something in it — an empty shell on all
            30 cards would be noise. "Add deliverable" lives in the card menu,
            which is how an empty card gets its first one. */}
        {deliverables.length > 0 && (
          <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 flex items-center gap-1.5">
                <Film className="w-3 h-3" /> Deliverables
              </p>
              <span className="text-[10px] text-white/30">
                {deliverables.filter(d => d.status === 'delivered').length}/{deliverables.length} delivered
              </span>
            </div>

            <div className="space-y-1.5">
              {deliverables.map(d => (
                <div key={d.id} className="flex items-center gap-2 group/deliv">
                  {isClient ? (
                    <span className="flex-1 text-[11px] text-white/80 truncate">{d.label || 'Untitled'}</span>
                  ) : (
                    <input
                      defaultValue={d.label || ''}
                      placeholder="e.g. 60s hero cut"
                      aria-label="Deliverable name"
                      onBlur={e => {
                        const value = e.target.value;
                        if (value !== (d.label || '')) onPatchDeliverable?.(d.id, { label: value });
                      }}
                      className="flex-1 min-w-0 bg-transparent outline-none text-[11px] text-white/80 rounded px-1 py-0.5 focus:bg-white/10 placeholder:text-white/25"
                    />
                  )}

                  {!isClient && (
                    <select
                      value={d.format || '16:9'}
                      aria-label="Aspect ratio"
                      onChange={e => onPatchDeliverable?.(d.id, { format: e.target.value })}
                      className="bg-transparent outline-none text-[10px] text-white/45 cursor-pointer shrink-0 hover:text-white/70"
                    >
                      {DELIVERABLE_FORMATS.map(f => (
                        <option key={f} value={f} className="bg-zinc-900">{f}</option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    disabled={isClient}
                    onClick={() => onPatchDeliverable?.(d.id, { status: nextDeliverableStatus(d.status) })}
                    title={isClient ? undefined : 'Change status'}
                    className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest shrink-0 transition-colors ${deliverableStatusTone(d.status)} ${isClient ? '' : 'cursor-pointer'}`}
                  >
                    {deliverableStatusLabel(d.status)}
                  </button>

                  {!isClient && (
                    <button
                      type="button"
                      aria-label={`Remove ${d.label || 'deliverable'}`}
                      title="Remove"
                      onClick={() => onRemoveDeliverable?.(d.id)}
                      className="shrink-0 text-white/20 hover:text-red-400 transition-colors opacity-100 md:opacity-0 md:group-hover/deliv:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isClient && (
              <button
                type="button"
                onClick={() => onAddDeliverable?.()}
                className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent hover:text-white transition-colors"
              >
                + Deliverable
              </button>
            )}
          </div>
        )}

        {/* QuickBooks, read-only. Only rendered once the client has actually
            been billed something — an empty billing block on every card would
            be the "No vault links" placeholder all over again. */}
        {billing && (billing.invoiced > 0 || billing.estimateCount > 0) && (
          <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 flex items-center gap-1.5">
                <Receipt className="w-3 h-3" /> Billing
              </p>
              {billing.overdue > 0 ? (
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">
                  {currency(billing.overdue)} overdue
                </span>
              ) : billing.outstanding > 0 ? (
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  {currency(billing.outstanding)} open
                </span>
              ) : billing.invoiced > 0 ? (
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/25">
                  Paid in full
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-white/50">
              {billing.invoiced > 0 && <span>{currency(billing.invoiced)} invoiced</span>}
              {billing.estimateCount > 0 && (
                <span className="text-white/35">
                  {currency(billing.estimateTotal)} quoted{billing.estimateCount > 1 ? ` · ${billing.estimateCount}` : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Project Vault — rendered only when there is something in it. The
            empty "No vault links" placeholder used to occupy a block on every
            card that had no links, which was most of them. */}
        {hasVaultLinks && (
          <div className="space-y-2 mb-6">
             <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30 flex items-center gap-2 mb-3">
               <LinkIcon className="w-3 h-3" /> Project Vault
             </p>
             <div className="grid grid-cols-2 gap-2">
                {job.review_link && (
                  <a href={sanitizeUrl(job.review_link)} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <Eye className="w-3 h-3 text-accent shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Review</span>
                  </a>
                )}
                {job.discord_url && (
                  <a href={sanitizeUrl(job.discord_url)} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <MessageSquare className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Discord</span>
                  </a>
                )}
                {job.drive_folder_url && (
                  <a href={sanitizeUrl(job.drive_folder_url)} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <FolderOpen className="w-3 h-3 text-yellow-500 shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100">Drive</span>
                  </a>
                )}
                {job.links?.map((link, i) => (
                  <a key={i} href={sanitizeUrl(link.url)} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                    <ExternalLink className="w-3 h-3 text-white/30 shrink-0" />
                    <span className="text-[11px] font-medium tracking-tight opacity-60 group-hover/link:opacity-100 truncate">{link.label}</span>
                  </a>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Footer: the two things you actually do next. The old left-hand slot
          held a static briefcase styled as an avatar stack that never had any
          avatars in it. */}
      {!isClient && (
        <div className="pt-4 border-t border-white/5 mt-auto flex items-center justify-between gap-2 relative z-10">
           <button
             onClick={onAddLink}
             className="text-[11px] font-medium tracking-tight text-white/30 hover:text-accent transition-all flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg"
           >
             <Plus className="w-3.5 h-3.5" /> Link
           </button>
           <button
             onClick={onManage}
             className="text-[12px] font-medium tracking-tight text-white/40 hover:text-white transition-all flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg"
           >
             Manage <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      )}
    </div>
  );
}
