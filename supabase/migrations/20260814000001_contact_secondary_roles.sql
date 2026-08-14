-- Secondary roles on a contact.
--
-- A contact had exactly one role, primary_role, and every "who can do X?"
-- lookup read it. On a small crew that is wrong more often than it is right —
-- the same person cuts, shoots, and produces depending on the job. Concretely:
-- assigning an edit in the tracker required setting someone's primary role to
-- "Editor", which then listed them as the editor on every call sheet they
-- appeared on.
--
-- primary_role stays the headline — the default title on a call sheet, the one
-- the Rolodex sorts by. secondary_roles are the other hats, and count for
-- role lookups and call-sheet position suggestions.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS secondary_roles TEXT[] DEFAULT '{}'::text[];

-- "Everyone who can colour" is a filter on this column across the whole
-- roster, so it is worth an index once a rolodex is more than a few hundred.
CREATE INDEX IF NOT EXISTS idx_contacts_secondary_roles
  ON public.contacts USING GIN (secondary_roles);
