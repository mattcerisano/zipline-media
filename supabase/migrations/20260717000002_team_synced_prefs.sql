-- Preferences that used to live only in one browser's localStorage now sync:
--   organizations.custom_tabs       — the team's Command Center tab layout
--   organizations.saved_gear_owners — gear builder's remembered owner names
--   profiles.scratch_notes          — each user's dashboard scratchpad
-- localStorage remains the instant fallback layer; these are authoritative
-- when present (see src/lib/team-prefs.ts).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_tabs JSONB,
  ADD COLUMN IF NOT EXISTS saved_gear_owners JSONB;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scratch_notes TEXT;
