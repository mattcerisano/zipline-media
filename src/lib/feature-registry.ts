// Searchable index of what the app can DO, surfaced through the ⌘K palette
// alongside data results. Each entry is written the way a user would ask for
// it ("how do I…"), with synonyms in `keywords` so both keyword and semantic
// ranking have plenty to grab. `tab` is the Command Center tab that hosts the
// feature — selecting a result navigates there.

export interface AppFeature {
  id: string;
  title: string;
  description: string;
  keywords: string;
  tab: string;
}

export const APP_FEATURES: AppFeature[] = [
  // ---- Calendar ----
  { id: 'cal-view', title: 'Production Calendar', description: 'See every shoot, hold, and imported Google event in one monthly view.', keywords: 'calendar month schedule shoots overview agenda', tab: 'calendar' },
  { id: 'cal-google-sync', title: 'Google Calendar Sync', description: 'Two-way sync: productions push to Google, and the connected account\'s events flow in automatically every 10 minutes.', keywords: 'google calendar sync import events automatic background connect', tab: 'calendar' },
  { id: 'cal-quick-markers', title: 'Quick Calendar Markers', description: 'Click any day to drop a Timeout, Hold, Travel Day, Edit Day, or Book-to-Shoot marker.', keywords: 'marker timeout hold travel edit day available quick add label', tab: 'calendar' },

  // ---- Slate ----
  { id: 'slate-create', title: 'Create a Production', description: 'Spin up a new job with client, dates, location, and crew on the Slate.', keywords: 'new job production create shoot add slate booking', tab: 'slate' },
  { id: 'slate-callsheet', title: 'Export a Call Sheet PDF', description: 'One-click branded call sheet with logistics, schedule, crew (in your chosen order), weather, hospital, and parking.', keywords: 'call sheet pdf export print crew list logistics day sheet', tab: 'slate' },
  { id: 'slate-duplicate', title: 'Duplicate a Shoot Day', description: 'Copy a production to the next day — crew, gear, and logistics carry over, post-production starts clean.', keywords: 'duplicate copy multi-day day 2 repeat shoot', tab: 'slate' },
  { id: 'slate-templates', title: 'Crew Templates', description: 'Save a job\'s role structure as a reusable template and apply it to future productions.', keywords: 'template crew roles reuse structure apply save', tab: 'slate' },
  { id: 'slate-budget', title: 'Budgets & Day Rates', description: 'Track day rates, flat fees, overtime, and total spend per production.', keywords: 'budget money day rate fees cost financials spend overtime', tab: 'slate' },
  { id: 'slate-crew', title: 'Crew Manifest & Ordering', description: 'Assign crew to roles, set call times, and reorder how they appear on the exported call sheet.', keywords: 'crew manifest roles assign order reorder call time positions', tab: 'slate' },
  { id: 'slate-schedule', title: 'Day Schedule Builder', description: 'Build the shoot day timeline that prints on the call sheet.', keywords: 'schedule timeline day plan hours tasks builder', tab: 'slate' },
  { id: 'slate-prep', title: 'Preproduction Checklist', description: 'Per-job prep to-do list with progress tracking.', keywords: 'checklist todo prep tasks preproduction progress', tab: 'slate' },
  { id: 'slate-safety', title: 'Weather, Hospital & Parking Lookup', description: 'Auto-find the forecast, nearest hospital, and parking for the shoot location — printed on the call sheet.', keywords: 'weather hospital parking safety location forecast nearest logistics', tab: 'gear' },

  // ---- Edit Tracker ----
  { id: 'edits-board', title: 'Edit Tracker Board', description: 'Kanban board for post-production: drag deliverables through your custom pipeline stages.', keywords: 'edit tracker post production kanban board pipeline stages deliverables', tab: 'edits' },
  { id: 'edits-columns', title: 'Custom Board Columns', description: 'Rename, recolor, add, or remove the Edit Tracker\'s pipeline stages for the whole team.', keywords: 'columns stages customize rename pipeline workflow', tab: 'edits' },
  { id: 'edits-add', title: 'Add a Production to Post', description: 'Productions stay off the board until you deliberately add them via the Add-to-Board picker.', keywords: 'add to board post pipeline pull in production picker', tab: 'edits' },

  // ---- Gear Builder ----
  { id: 'gear-manifest', title: 'Build a Gear Manifest', description: 'Pick from inventory, add custom items, and assemble the kit list for a shoot.', keywords: 'gear equipment manifest kit list build cameras lenses pack', tab: 'gear' },
  { id: 'gear-pdf', title: 'Gear List PDF & Share Link', description: 'Export the manifest as a branded PDF or share a live link with rental houses and crew.', keywords: 'gear pdf share link export rental house send manifest', tab: 'gear' },
  { id: 'gear-archive', title: 'Archived Gear Lists', description: 'Every saved manifest is kept and reloadable — restore last month\'s kit in one click.', keywords: 'archive gear lists history saved restore previous', tab: 'gear' },
  { id: 'gear-value', title: 'Replacement Value Totals', description: 'Running insurance/replacement value for everything on the manifest.', keywords: 'replacement value insurance total worth cost gear', tab: 'gear' },

  // ---- Creative ----
  { id: 'creative-board', title: 'Creative Board', description: 'Concept, lighting, camera, and audio direction per production — exports into the Master Brief PDF.', keywords: 'creative brief concept moodboard lighting direction vision', tab: 'creative' },
  { id: 'creative-brief', title: 'Master Brief PDF', description: 'One PDF with the full production: creative, crew, schedule, shotlist, and gear.', keywords: 'master brief pdf export full document production bible', tab: 'creative' },
  { id: 'creative-shotlist', title: 'Shotlist Grid', description: 'Plan shots scene-by-scene with a sortable grid that prints on the brief.', keywords: 'shotlist shots scenes grid storyboard plan coverage', tab: 'creative' },

  // ---- Inbox ----
  { id: 'inbox-mail', title: 'Team Inbox (Gmail)', description: 'Read and reply to the connected Gmail account without leaving the app.', keywords: 'email inbox gmail mail read reply messages', tab: 'inbox' },
  { id: 'inbox-compose', title: 'Compose an Email', description: 'Send a fresh email (not just replies) from the connected account.', keywords: 'compose new email send write message', tab: 'inbox' },
  { id: 'inbox-search', title: 'Search the Whole Mailbox', description: 'Gmail-powered search across all mail — supports from:, has:attachment, and quoted phrases.', keywords: 'search email mailbox find from attachment filter query', tab: 'inbox' },
  { id: 'inbox-actions', title: 'Archive, Star & Trash Email', description: 'Gmail-style thread actions: archive, star, trash, and mark unread — synced to the real mailbox.', keywords: 'archive star trash delete unread mark email actions', tab: 'inbox' },
  { id: 'inbox-link', title: 'Link an Email to a Job', description: 'Attach an email thread to a production so the conversation lives with the work.', keywords: 'link email job thread attach production connect', tab: 'inbox' },

  // ---- Contacts / Rolodex ----
  { id: 'rolodex', title: 'Rolodex (Crew & Contacts)', description: 'Your address book of crew, vendors, and collaborators with roles, rates, and notes.', keywords: 'contacts crew people rolodex address book vendors freelancers phone', tab: 'rolodex' },

  // ---- Social ----
  { id: 'social', title: 'Social Media Planner', description: 'Plan and track social posts alongside your production schedule.', keywords: 'social media posts instagram planner content publish', tab: 'social' },

  // ---- Vault ----
  { id: 'vault', title: 'Vault', description: 'Store shared credentials and sensitive team info in one place.', keywords: 'vault passwords credentials secrets logins secure', tab: 'vault' },

  // ---- Dashboard ----
  { id: 'dash-overview', title: 'Dashboard Overview', description: 'At-a-glance widgets: upcoming shoots, tasks, budget, notes, and your work queue.', keywords: 'dashboard home overview widgets summary today', tab: 'dashboard' },
  { id: 'dash-mywork', title: 'My Work', description: 'Everything assigned to you — cards, tasks, and mentions — in one queue.', keywords: 'my work assigned to me tasks queue mentions personal', tab: 'dashboard' },
  { id: 'dash-notes', title: 'Notes Library', description: 'Shared production notes, searchable and reusable across jobs.', keywords: 'notes library snippets shared knowledge write', tab: 'dashboard' },

  // ---- Integrations ----
  { id: 'int-google', title: 'Connect Google Account', description: 'Link Google for Calendar sync, the Drive browser, and the Gmail inbox.', keywords: 'connect google account oauth link integration calendar drive gmail setup', tab: 'integrations' },
  { id: 'int-drive', title: 'Google Drive Browser', description: 'Browse the connected account\'s Drive files from inside the app.', keywords: 'google drive files browser documents folders', tab: 'integrations' },
  { id: 'int-webhooks', title: 'Discord / Webhook Notifications', description: 'Announce bookings and status changes to your team channels automatically.', keywords: 'discord webhook notifications announce channel alerts slack', tab: 'integrations' },
  { id: 'int-push', title: 'Push Notifications', description: 'Call-time reminders and @mention pings straight to your phone or desktop.', keywords: 'push notifications phone mobile call time reminder mention ping alert device', tab: 'integrations' },

  // ---- Meta ----
  { id: 'meta-search', title: 'Smart Search (⌘K)', description: 'This palette — finds productions, contacts, clients, and app features by meaning, not just keywords.', keywords: 'search palette command k find semantic smart', tab: 'dashboard' },
  { id: 'meta-tabs', title: 'Custom Tabs', description: 'Add, rename, and role-restrict Command Center tabs to fit how your team works.', keywords: 'custom tabs add rename organize navigation roles', tab: 'dashboard' },
];
