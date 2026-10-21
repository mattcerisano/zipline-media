-- Notes have one home: Meeting Notes. The Notes Library (production_notes)
-- lost its screen in #123, so anything written there is copied into
-- meeting_notes where it can be read again. The source rows are kept; the
-- copy is idempotent, so running this twice adds nothing.
INSERT INTO meeting_notes (client_id, title, content, meeting_date, created_at, updated_at)
SELECT p.client_id,
       COALESCE(NULLIF(p.title, ''), 'Untitled note'),
       p.body,
       COALESCE(p.created_at, NOW()),
       COALESCE(p.created_at, NOW()),
       COALESCE(p.updated_at, NOW())
FROM production_notes p
WHERE NOT EXISTS (
  SELECT 1 FROM meeting_notes m
  WHERE m.title = COALESCE(NULLIF(p.title, ''), 'Untitled note')
    AND m.content = p.body
    AND m.client_id IS NOT DISTINCT FROM p.client_id
);
