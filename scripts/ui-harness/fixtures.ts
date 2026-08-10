/**
 * Fake data for the UI harness. Never touches the real database.
 *
 * Deliberately awkward. Uniform, tidy placeholder data is what let a squashed
 * logo, a clipped headline and a stranded filter pill all survive review —
 * every one of them needed a real string to show up. So: client names long
 * enough to overflow a select, a job title that has to wrap, a one-character
 * name, an empty result set, and characters that break naive layout (an
 * ampersand, an em dash, an apostrophe).
 *
 * If a screen looks right against these, it will usually look right against
 * the studio's own records.
 */

const iso = (d: string) => new Date(d).toISOString();

export const clients = [
  { id: 'c1', name: 'Moulin Rouge! The Musical — Broadway Company', email: 'production@moulinrouge.example', phone: '212-555-0142' },
  { id: 'c2', name: 'SIX', email: 'hello@six.example' },
  { id: 'c3', name: 'Hot Ones / First We Feast', email: 'booking@firstwefeast.example' },
  { id: 'c4', name: "That Parenting Music Cast", email: 'hi@tpmc.example' },
];

export const projects = [
  { id: 'p1', name: 'Spring Brand Campaign 2026', client_id: 'c1', status: 'Active' },
  { id: 'p2', name: 'Social Cutdowns', client_id: 'c1', status: 'Active' },
  { id: 'p3', name: 'S12', client_id: 'c3', status: 'Active' },
];

export const contacts = [
  { id: 'ct1', name: 'Alex Lim', email: 'alex@example.com', phone: '917-555-0101', primary_role: 'Audio Mixer', is_favorite: true },
  { id: 'ct2', name: 'Priyanka Raghunathan-Whitfield', email: 'priyanka@example.com', phone: '917-555-0102', primary_role: 'Director of Photography', is_favorite: true },
  { id: 'ct3', name: 'Jo', email: 'jo@example.com', phone: '917-555-0103', primary_role: 'Gaffer', is_favorite: false },
  { id: 'ct4', name: 'Marcus Webb', email: 'marcus@example.com', primary_role: 'Editor', is_favorite: false },
];

export const jobs = [
  {
    id: 'j1',
    title: 'That Parenting Music Cast Recording- Day 2',
    client_name: 'That Parenting Music Cast',
    client_id: 'c4',
    job_status: 'Booked',
    type: 'production',
    shoot_date: '2026-08-14',
    call_time: '7:00 AM',
    wrap_time: '7:00 PM',
    location_name: 'Greenpoint Terminal Warehouse',
    location_address: '67 West St, Brooklyn, NY 11222',
    edit_status: 'WIP',
    editor_id: 'ct4',
    job_roles: [],
    links: [],
    created_at: iso('2026-07-01'),
  },
  {
    id: 'j2',
    title: 'Moulin Rouge! 5 Year Anniversary — Broadway Sizzle',
    client_name: 'Moulin Rouge! The Musical — Broadway Company',
    client_id: 'c1',
    project_id: 'p1',
    job_status: 'Planning',
    type: 'production',
    shoot_date: '2026-08-22',
    call_time: '9:00 AM',
    edit_status: 'Filmed',
    job_roles: [],
    links: [],
    created_at: iso('2026-07-04'),
  },
  {
    id: 'j3',
    title: 'Sizzle',
    client_name: 'SIX',
    client_id: 'c2',
    job_status: 'Wrapped',
    type: 'production',
    shoot_date: '2026-06-02',
    edit_status: 'Delivered',
    job_roles: [],
    links: [],
    created_at: iso('2026-05-20'),
  },
  {
    id: 'j4',
    title: "Hot Ones' Sean Evans and Keke Palmer Turn Up the Heat",
    client_name: 'Hot Ones / First We Feast',
    client_id: 'c3',
    project_id: 'p3',
    job_status: 'Booked',
    type: 'production',
    shoot_date: '2026-09-03',
    call_time: '6:30 AM',
    wrap_time: '8:00 PM',
    edit_status: 'Revisions',
    editor_id: 'ct4',
    job_roles: [],
    links: [],
    created_at: iso('2026-07-11'),
  },
];

export const job_roles = [
  { id: 'r1', job_id: 'j1', contact_id: 'ct1', position: 'Audio Mixer', department: 'Sound', call_time: '7:00 AM', day_rate: 850, sort_order: 0, contact: contacts[0] },
  { id: 'r2', job_id: 'j1', contact_id: 'ct2', position: 'Director of Photography', department: 'Camera', call_time: '7:00 AM', day_rate: 1200, sort_order: 1, contact: contacts[1] },
  { id: 'r3', job_id: 'j1', contact_id: 'ct3', position: 'Gaffer', department: 'Lighting', call_time: '7:30 AM', sort_order: 2, contact: contacts[2] },
];

export const job_schedules = [
  { id: 's1', job_id: 'j1', start_time: '07:00', end_time: '08:00', task: 'Crew call & load in', sort_order: 0 },
  { id: 's2', job_id: 'j1', start_time: '08:00', task: 'Lighting setup — main stage', sort_order: 1 },
  { id: 's3', job_id: 'j1', start_time: '', task: 'Wrap & strike', sort_order: 2 },
];

export const job_todos = [
  { id: 't1', job_id: 'j1', task: 'Confirm parking permit', completed: true, sort_order: 0 },
  { id: 't2', job_id: 'j1', task: 'Battery check + media format', completed: false, sort_order: 1 },
];

export const user_roles = [
  { id: 'ur1', user_id: 'harness-user', email: 'harness@zipline.local', role: 'admin', org_id: 'org1' },
];

export const organizations = [
  { id: 'org1', name: 'Zipline Media', brand_color: '#22c7e8', tagline: 'New York, NY' },
];

export const inventory = [
  { id: 'i1', name: 'Sony FX9', category: 'Camera', qty: 2, replacement: 11000 },
  { id: 'i2', name: 'Aputure 600d Pro', category: 'Lighting', qty: 4, replacement: 1900 },
];

/** Tables the app queries that are legitimately empty in this scenario. */
export const EMPTY = [
  'google_tokens', 'quickbooks_tokens', 'calendar_events', 'social_deliverables',
  'notification_channels', 'notification_events', 'job_shotlist', 'job_scenes',
  'vault_items', 'vault', 'vault_meta', 'social_posts', 'social_links',
  'social_campaigns', 'social_campaign_tasks', 'production_notes', 'budget_items',
  'gear_templates', 'job_templates', 'usage_events', 'profiles',
];

export const TABLES: Record<string, unknown[]> = {
  jobs, clients, projects, contacts, job_roles, job_schedules, job_todos,
  user_roles, organizations, inventory,
  ...Object.fromEntries(EMPTY.map(t => [t, []])),
};
