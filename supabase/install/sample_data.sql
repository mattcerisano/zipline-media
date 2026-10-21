-- Sample data for a fresh Studio OS install, so the first sign-in lands on a
-- populated app rather than empty tabs. Three clients, two projects, four
-- productions (one wrapped and in the edit, one shooting this week, two
-- coming up), six crew in the Rolodex, a few inventory items, and one drive
-- that is out with an editor.
--
-- Every production's title starts with "[Sample]" — that prefix is what the
-- dashboard looks for to show the "this is sample data" notice, and what
-- remove_sample_data.sql deletes by. Every row has a fixed id, so running
-- this twice changes nothing (ON CONFLICT DO NOTHING).
--
-- Run AFTER install.sql: Supabase → SQL Editor → New query → paste → run.
-- Remove later with supabase/install/remove_sample_data.sql, or delete the
-- productions from the Slate one by one.

-- Clients -------------------------------------------------------------------
INSERT INTO public.clients (id, name, email, phone, address, notes) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000001', 'Northlight Theatre Co.', 'marketing@northlight.example', '212-555-0142', '410 W 42nd St, New York, NY', 'Sample client. Season trailers and rehearsal-room content.'),
  ('a5a5a5a5-0000-4000-8000-000000000002', 'Harbor & Vine', 'studio@harborvine.example', '917-555-0188', '88 Front St, Brooklyn, NY', 'Sample client. Restaurant group; social and menu launches.'),
  ('a5a5a5a5-0000-4000-8000-000000000003', 'Meridian Health', 'comms@meridianhealth.example', '646-555-0117', '1 Meridian Plaza, Jersey City, NJ', 'Sample client. Internal training and recruiting films.')
ON CONFLICT (id) DO NOTHING;

-- Projects ------------------------------------------------------------------
INSERT INTO public.projects (id, name, client_id, description, status, color) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000011', 'Fall Season Trailers', 'a5a5a5a5-0000-4000-8000-000000000001', 'Sample project. One trailer per show, plus a sizzle.', 'Active', '#8b5cf6'),
  ('a5a5a5a5-0000-4000-8000-000000000012', 'Recruiting Series', 'a5a5a5a5-0000-4000-8000-000000000003', 'Sample project. Four short films, one per department.', 'Active', '#10b981')
ON CONFLICT (id) DO NOTHING;

-- Crew (Rolodex) ------------------------------------------------------------
INSERT INTO public.contacts (id, name, email, phone, company_name, primary_role, secondary_roles, location_city, location_state, tags, notes_general) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000021', 'Dana Whitfield', 'dana@example.com', '917-555-0201', NULL, 'Director of Photography', ARRAY['Camera Operator'], 'Brooklyn', 'NY', 'camera, owns Alexa Mini', 'Sample contact.'),
  ('a5a5a5a5-0000-4000-8000-000000000022', 'Luis Ortega', 'luis@example.com', '917-555-0202', NULL, 'Gaffer', ARRAY['Key Grip'], 'Queens', 'NY', 'lighting, has a van', 'Sample contact.'),
  ('a5a5a5a5-0000-4000-8000-000000000023', 'Priya Nair', 'priya@example.com', '917-555-0203', NULL, 'Sound Mixer', ARRAY[]::text[], 'Jersey City', 'NJ', 'audio', 'Sample contact.'),
  ('a5a5a5a5-0000-4000-8000-000000000024', 'Sam Okafor', 'sam@example.com', '917-555-0204', NULL, 'Editor', ARRAY['Colorist'], 'Manhattan', 'NY', 'post, premiere, resolve', 'Sample contact. Freelance editor — link an editor account to this contact to try the Edit Tracker as them.'),
  ('a5a5a5a5-0000-4000-8000-000000000025', 'Jess Han', 'jess@example.com', '917-555-0205', NULL, 'Producer', ARRAY['1st AD'], 'Manhattan', 'NY', 'producing', 'Sample contact.'),
  ('a5a5a5a5-0000-4000-8000-000000000026', 'Marco Bellini', 'marco@example.com', '917-555-0206', 'Bellini Audio', 'Boom Operator', ARRAY[]::text[], 'Hoboken', 'NJ', 'audio', 'Sample contact.')
ON CONFLICT (id) DO NOTHING;

-- Productions (Slate) -------------------------------------------------------
-- Dates are relative to today so the calendar always has something on it.
INSERT INTO public.jobs (id, title, client_name, client_id, project_id, production_company, job_status, type, shoot_date, end_date, call_time, wrap_time, location_name, location_address, notes_general, edit_status, editor_id, estimated_budget) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000031', '[Sample] Season trailer — "The Lighthouse Keepers"', 'Northlight Theatre Co.', 'a5a5a5a5-0000-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-000000000011', NULL, 'Wrapped', 'production', CURRENT_DATE - 9, NULL, '8:00 AM', '6:00 PM', 'Northlight rehearsal studio', '410 W 42nd St, New York, NY 10036', 'Two-camera rehearsal coverage plus cast interviews. Deliver a 60s trailer and three 15s cutdowns.', 'WIP', 'a5a5a5a5-0000-4000-8000-000000000024', 8500),
  ('a5a5a5a5-0000-4000-8000-000000000032', '[Sample] Harbor & Vine — spring menu launch', 'Harbor & Vine', 'a5a5a5a5-0000-4000-8000-000000000002', NULL, NULL, 'Booked', 'production', CURRENT_DATE + 2, NULL, '7:00 AM', '3:00 PM', 'Harbor & Vine, DUMBO', '88 Front St, Brooklyn, NY 11201', 'Food and kitchen b-roll, chef interview at 11. Natural light until 1, then tungsten.', 'Filmed', NULL, 4200),
  ('a5a5a5a5-0000-4000-8000-000000000033', '[Sample] Meridian recruiting — nursing', 'Meridian Health', 'a5a5a5a5-0000-4000-8000-000000000003', 'a5a5a5a5-0000-4000-8000-000000000012', NULL, 'Booked', 'production', CURRENT_DATE + 9, CURRENT_DATE + 10, '6:30 AM', '5:00 PM', 'Meridian Plaza, 3rd floor', '1 Meridian Plaza, Jersey City, NJ 07302', 'Two days. Day 1 interviews, day 2 floor b-roll. Scrubs for crew; badge pickup at security.', 'Filmed', NULL, 12000),
  ('a5a5a5a5-0000-4000-8000-000000000034', '[Sample] Northlight — gala sizzle', 'Northlight Theatre Co.', 'a5a5a5a5-0000-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-000000000011', NULL, 'Planning', 'production', CURRENT_DATE + 23, NULL, '4:00 PM', '11:00 PM', 'The Glasshouse', '660 12th Ave, New York, NY 10019', 'Event coverage. Confirm whether we can shoot the auction. Hold date, not yet confirmed.', 'Filmed', NULL, 3800)
ON CONFLICT (id) DO NOTHING;

-- Crew on each production ---------------------------------------------------
INSERT INTO public.job_roles (id, job_id, contact_id, name, position, department, call_time, day_rate, sort_order) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000041', 'a5a5a5a5-0000-4000-8000-000000000031', 'a5a5a5a5-0000-4000-8000-000000000021', 'Dana Whitfield', 'Director of Photography', 'Camera', '8:00 AM', 900, 0),
  ('a5a5a5a5-0000-4000-8000-000000000042', 'a5a5a5a5-0000-4000-8000-000000000031', 'a5a5a5a5-0000-4000-8000-000000000023', 'Priya Nair', 'Sound Mixer', 'Audio', '8:00 AM', 650, 1),
  ('a5a5a5a5-0000-4000-8000-000000000043', 'a5a5a5a5-0000-4000-8000-000000000031', 'a5a5a5a5-0000-4000-8000-000000000025', 'Jess Han', 'Producer', 'Production', '7:30 AM', 700, 2),
  ('a5a5a5a5-0000-4000-8000-000000000044', 'a5a5a5a5-0000-4000-8000-000000000032', 'a5a5a5a5-0000-4000-8000-000000000021', 'Dana Whitfield', 'Director of Photography', 'Camera', '7:00 AM', 900, 0),
  ('a5a5a5a5-0000-4000-8000-000000000045', 'a5a5a5a5-0000-4000-8000-000000000032', 'a5a5a5a5-0000-4000-8000-000000000022', 'Luis Ortega', 'Gaffer', 'Lighting', '6:30 AM', 650, 1),
  ('a5a5a5a5-0000-4000-8000-000000000046', 'a5a5a5a5-0000-4000-8000-000000000033', 'a5a5a5a5-0000-4000-8000-000000000021', 'Dana Whitfield', 'Director of Photography', 'Camera', '6:30 AM', 900, 0),
  ('a5a5a5a5-0000-4000-8000-000000000047', 'a5a5a5a5-0000-4000-8000-000000000033', 'a5a5a5a5-0000-4000-8000-000000000022', 'Luis Ortega', 'Gaffer', 'Lighting', '6:30 AM', 650, 1),
  ('a5a5a5a5-0000-4000-8000-000000000048', 'a5a5a5a5-0000-4000-8000-000000000033', 'a5a5a5a5-0000-4000-8000-000000000026', 'Marco Bellini', 'Boom Operator', 'Audio', '6:30 AM', 500, 2),
  ('a5a5a5a5-0000-4000-8000-000000000049', 'a5a5a5a5-0000-4000-8000-000000000033', 'a5a5a5a5-0000-4000-8000-000000000025', 'Jess Han', 'Producer', 'Production', '6:00 AM', 700, 3)
ON CONFLICT (id) DO NOTHING;

-- A day's schedule and to-dos on the production shooting this week ----------
INSERT INTO public.job_schedules (id, job_id, start_time, end_time, task, location, sort_order) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000051', 'a5a5a5a5-0000-4000-8000-000000000032', '7:00 AM', '7:30 AM', 'Crew call, load in through the kitchen door', 'Harbor & Vine', 0),
  ('a5a5a5a5-0000-4000-8000-000000000052', 'a5a5a5a5-0000-4000-8000-000000000032', '7:30 AM', '11:00 AM', 'Kitchen b-roll, plating', 'Kitchen', 1),
  ('a5a5a5a5-0000-4000-8000-000000000053', 'a5a5a5a5-0000-4000-8000-000000000032', '11:00 AM', '12:00 PM', 'Chef interview', 'Dining room, window two-top', 2),
  ('a5a5a5a5-0000-4000-8000-000000000054', 'a5a5a5a5-0000-4000-8000-000000000032', '1:00 PM', '3:00 PM', 'Dining room b-roll, exteriors', 'Front St', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_todos (id, job_id, task, completed, due_date, sort_order) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000061', 'a5a5a5a5-0000-4000-8000-000000000032', 'Confirm chef availability for the 11am interview', true, CURRENT_DATE - 1, 0),
  ('a5a5a5a5-0000-4000-8000-000000000062', 'a5a5a5a5-0000-4000-8000-000000000032', 'Send call sheet', false, CURRENT_DATE + 1, 1),
  ('a5a5a5a5-0000-4000-8000-000000000063', 'a5a5a5a5-0000-4000-8000-000000000033', 'Badge list to Meridian security', false, CURRENT_DATE + 5, 0),
  ('a5a5a5a5-0000-4000-8000-000000000064', 'a5a5a5a5-0000-4000-8000-000000000031', 'Share V1 with Northlight marketing', false, CURRENT_DATE + 3, 0)
ON CONFLICT (id) DO NOTHING;

-- Inventory (Gear Builder) --------------------------------------------------
INSERT INTO public.inventory (id, name, category, qty, replacement) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000071', 'Sony FX6', 'Camera', 2, 6000),
  ('a5a5a5a5-0000-4000-8000-000000000072', 'Sony 24-70mm f/2.8 GM II', 'Lens', 2, 2300),
  ('a5a5a5a5-0000-4000-8000-000000000073', 'Aputure 600d Pro', 'Lighting', 2, 1900),
  ('a5a5a5a5-0000-4000-8000-000000000074', 'Sennheiser MKH 416', 'Audio', 1, 1000),
  ('a5a5a5a5-0000-4000-8000-000000000075', 'Sachtler Ace XL tripod', 'Grip/Support', 2, 900)
ON CONFLICT (id) DO NOTHING;

-- One drive, out with the editor on the wrapped production ------------------
INSERT INTO public.drives (id, label, kind, model, capacity_tb, status, holder_name, holder_type, job_id, checked_out_at, notes, contents) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000081', 'SAMPLE-01', 'editor', 'Samsung T9', 2, 'out', 'Sam Okafor', 'editor', 'a5a5a5a5-0000-4000-8000-000000000031', now() - interval '8 days', 'Sample drive. Blue tape on the lid.', 'Lighthouse Keepers rehearsal footage, both cameras + audio.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.drive_events (id, drive_id, action, holder_name, job_id, note, actor) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000091', 'a5a5a5a5-0000-4000-8000-000000000081', 'added', NULL, NULL, 'Sample data', 'Sample data'),
  ('a5a5a5a5-0000-4000-8000-000000000092', 'a5a5a5a5-0000-4000-8000-000000000081', 'checked_out', 'Sam Okafor', 'a5a5a5a5-0000-4000-8000-000000000031', 'Handed over at the wrap', 'Sample data')
ON CONFLICT (id) DO NOTHING;
