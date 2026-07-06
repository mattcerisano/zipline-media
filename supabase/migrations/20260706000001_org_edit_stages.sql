-- Customizable Edit Tracker columns, shared org-wide. JSONB array of
-- { id, label, color } objects; NULL means the built-in default stages
-- (Filmed / WIP / V1 / Revisions / Delivered / Wrapped).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS edit_stages JSONB;
