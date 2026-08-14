export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  primary_role?: string;
  /**
   * The other hats this person wears. The primary role is their default title;
   * these count for role lookups (who can edit?) and are offered as positions
   * when they're added to a call sheet.
   */
  secondary_roles?: string[] | null;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  tags?: string;
  notes_general?: string;
  is_favorite: boolean;
  job_history?: {
    job_id: string;
    job_title: string;
    role: string;
    date: string;
    status: string;
  }[];
  updated_at?: string;
}

export interface Profile {
  id: string;
  org_id?: string;
  full_name?: string;
  position?: string;
  phone?: string;
  address?: string;
  email?: string;
  avatar_url?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  client_id?: string;
  description?: string;
  status?: 'Active' | 'On Hold' | 'Completed' | 'Archived';
  color?: string; // optional hex for calendar/badge tinting
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  history?: {
    id: string;
    type: 'job' | 'gear';
    date: string;
    title: string;
    summary?: string;
  }[];
  updated_at?: string;
}

export interface JobRole {
  id: string;
  job_id: string;
  contact_id?: string;
  name?: string; // Fallback if no contact_id
  position: string;
  department?: string;
  phone?: string;
  email?: string;
  call_time?: string;
  day_rate?: number;
  flat_fee?: number;
  is_overtime?: boolean;
  notes?: string;
  sort_order?: number;
  contact?: Contact; // Hydrated
}

export interface JobLink {
  label: string;
  url: string;
  category?: 'Review' | 'Archive' | 'Discord' | 'Folder' | 'Other' | 'Creative';
}

export interface EditLabel {
  id: string;
  color: string;
  text: string;
}

export interface JobSchedule {
  id: string;
  job_id: string;
  start_time: string;
  end_time?: string;
  task: string;
  location?: string;
  notes?: string;
  sort_order: number;
}

export interface JobTodo {
  id: string;
  job_id: string;
  task: string;
  completed: boolean;
  due_date?: string;
  sort_order: number;
  created_at?: string;
}

export interface JobShot {
  id: string;
  job_id: string;
  shot_number?: string;
  description: string;
  framing?: string;
  equipment?: string;
  image_url?: string;
  is_special?: boolean;
  aspect_ratio?: string;
  lighting_setup?: string;
  scene_group?: string;
  sort_order: number;
  // Spreadsheet shotlist columns (Production Bible parity)
  scene_id?: string | null;
  timing?: string;
  subject?: string;
  movement?: string;
  lens?: string;
  animation_link?: string;
  animation_label?: string;
  timecode?: string;
  lyrics?: string;
  notes?: string;
  take_best?: string;
  est_takes?: string;
  priority?: 'must' | 'nice';
}

// Team notification integrations (Discord / Slack / Teams)
export type NotificationPlatform = 'discord' | 'slack' | 'teams';

export interface NotificationChannel {
  id: string;
  org_id?: string;
  platform: NotificationPlatform;
  label?: string;
  webhook_url?: string;
  enabled: boolean;
  updated_at?: string;
}

export interface NotificationEvent {
  id: string;
  org_id?: string;
  event_key: string;
  enabled: boolean;
  message_template?: string;
  updated_at?: string;
}

// The four offered in the Calendar tab's quick-add are 'hold', 'timeout'
// (Out of Office), 'booked', and 'meeting'. The rest are legacy values kept so
// markers created before the menu was simplified still render with their own
// label and colour instead of falling back to the first preset.
export type CalendarEventPreset =
  | 'hold'
  | 'timeout'
  | 'booked'
  | 'meeting'
  | 'planning'
  | 'available'
  | 'travel'
  | 'edit'
  | 'google';

export interface CalendarEvent {
  id: string;
  title?: string;
  preset: CalendarEventPreset;
  event_date: string;
  end_date?: string | null;
  /** Wall-clock start ("2:00 PM"). Empty means an all-day marker. */
  start_time?: string | null;
  /** Wall-clock end. Empty runs an hour from the start. */
  end_time?: string | null;
  notes?: string;
  job_id?: string | null;
  /** Set when the marker was imported from Google Calendar. */
  google_event_id?: string | null;
  /** Tombstone: removed in-app; re-syncs must not resurrect it. */
  hidden?: boolean | null;
}

export interface JobScene {
  id: string;
  job_id: string;
  setup_number?: string;
  name?: string;
  timecode?: string;
  description?: string;
  notes?: string;
  est_minutes?: string;
  sort_order: number;
}

export interface Job {
  id: string;
  title: string;
  client_name?: string;
  client_id?: string;
  project_id?: string;
  project?: Project; // Hydrated
  production_company?: string;
  job_status?: 'Planning' | 'Hold' | 'Booked' | 'Wrapped' | 'Cancelled';
  type?: 'production' | 'rental';
  shoot_date?: string;
  due_date?: string;
  end_date?: string;
  call_time?: string;
  /**
   * Wall-clock end of the shooting day, e.g. "6:00 PM". Empty means unknown,
   * and the calendar falls back to an eight-hour estimate. A wrap at or before
   * the call is read as running past midnight.
   */
  wrap_time?: string;
  location_name?: string;
  location_address?: string;
  nearest_hospital_name?: string;
  nearest_hospital_address?: string;
  nearest_hospital_phone?: string;
  nearest_parking_name?: string;
  nearest_parking_address?: string;
  weather_summary?: string;
  gear_list_url?: string;
  gear_manifest?: Record<string, number>;
  /**
   * Credential for the public gear-share link. Anyone holding it can read and
   * edit this job's gear manifest through /api/share/gear, so it belongs in a
   * share URL and nowhere else — never render it on a page.
   */
  share_token?: string;
  quote_url?: string;
  estimate_url?: string;
  notes_general?: string;
  // Email linkage (#6)
  contact_email?: string;
  email_thread_id?: string;
  email_thread_subject?: string;
  job_roles: JobRole[];
  // Integrations
  /** Google Calendar event this job is mirrored to, set by the push/sync. */
  google_event_id?: string | null;
  discord_url?: string;
  review_link?: string; // Frame.io / Vimeo
  review_password?: string;
  drive_folder_url?: string;
  links?: JobLink[]; // Array of custom links
  // Post & Creative
  edit_status?: 'Filmed' | 'WIP' | 'V1' | 'Revisions' | 'Delivered' | 'Wrapped';
  editor_id?: string;
  editor?: Contact; // Hydrated
  edit_notes?: string;
  edit_labels?: EditLabel[];
  creative_brief?: string;
  color_palette?: string[]; // Array of hex codes
  updated_at?: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  description?: string;
  roles: Partial<JobRole>[];
  created_at?: string;
}

export interface GearTemplate {
  id: string;
  name: string;
  description?: string;
  items: Record<string, number>;
  created_at?: string;
}

export const STORAGE_KEY_CONTACTS = 'zipline_rolodex_contacts';
export const STORAGE_KEY_CLIENTS = 'zipline_rolodex_clients';
export const STORAGE_KEY_JOBS = 'zipline_slate_jobs';
export const STORAGE_KEY_MEETINGS = 'zipline_meetings';

export const DEPARTMENTS = [
  'Production', 'Camera', 'G&E / Lighting', 'Audio', 'Art', 
  'Makeup', 'Wardrobe', 'Script', 'VFX', 'Post', 'Support', 'General'
];

export const STATUSES = ['Planning', 'Hold', 'Booked', 'Wrapped', 'Cancelled'];
