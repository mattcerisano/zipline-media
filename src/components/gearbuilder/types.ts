export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  primary_role?: string;
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
  contact?: Contact; // Hydrated
}

export interface JobLink {
  label: string;
  url: string;
  category?: 'Review' | 'Archive' | 'Discord' | 'Folder' | 'Other';
}

export interface Job {
  id: string;
  title: string;
  client_name?: string;
  production_company?: string;
  job_status?: 'Planning' | 'Hold' | 'Booked' | 'Wrapped' | 'Cancelled';
  type?: 'production' | 'rental';
  shoot_date?: string;
  end_date?: string;
  call_time?: string;
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
  quote_url?: string;
  estimate_url?: string;
  notes_general?: string;
  job_roles: JobRole[];
  // Integrations
  discord_url?: string;
  review_link?: string; // Frame.io / Vimeo
  review_password?: string;
  drive_folder_url?: string;
  links?: JobLink[]; // Array of custom links
  edit_status?: 'Filmed' | 'WIP' | 'V1' | 'Revisions' | 'Delivered' | 'Wrapped';
  editor_id?: string;
  editor?: Contact; // Hydrated
  updated_at?: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  description?: string;
  roles: Partial<JobRole>[];
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
