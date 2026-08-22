-- Duplicate pairs the team has already ruled on.
--
-- The rolodex flags contacts that look like the same person (same email,
-- same phone, same name through a nickname or a typo — see
-- src/lib/duplicate-contacts.ts). Some of those really are two people, and
-- once someone says so the pair must stay quiet for everyone, not just in
-- the browser that dismissed it.
--
-- Each entry is the two contact ids sorted and joined with '::', so the key
-- is the same whichever record was looked at first. localStorage still holds
-- the instant copy; this column is what makes the decision stick across
-- devices and teammates (see src/lib/team-prefs.ts).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dismissed_duplicate_pairs JSONB DEFAULT '[]'::jsonb;
