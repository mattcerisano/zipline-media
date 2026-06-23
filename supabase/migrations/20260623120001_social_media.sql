-- Workstream B: Social Media management (manual planner — no platform OAuth).
-- Five tables backing the Content Calendar, Rollout Tracker, Deliverables
-- Tracker, and Link Hub + Caption Library. RLS mirrors the rest of the app
-- ("Allow all for now").

-- 1) Content calendar posts
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT,
  caption TEXT,
  platform TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'idea',          -- idea | draft | scheduled | posted
  scheduled_at TIMESTAMPTZ,
  asset_url TEXT,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Rollout campaigns (per release / artist)
CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  release_date DATE,
  status TEXT DEFAULT 'planning',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Campaign tasks (phased checklist)
CREATE TABLE IF NOT EXISTS social_campaign_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES social_campaigns(id) ON DELETE CASCADE,
  phase TEXT DEFAULT 'teaser',         -- teaser | release | post
  task TEXT NOT NULL,
  owner TEXT,
  due_date DATE,
  is_done BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Deliverables (cutdowns per platform/format)
CREATE TABLE IF NOT EXISTS social_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  label TEXT,
  format TEXT DEFAULT '9:16',
  duration TEXT,
  platform TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'todo',          -- todo | in_progress | delivered
  asset_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Link hub + caption library
CREATE TABLE IF NOT EXISTS social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  kind TEXT DEFAULT 'link',            -- link | caption
  label TEXT,
  url TEXT,
  body TEXT,
  platform TEXT,
  tags TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['social_posts','social_campaigns','social_campaign_tasks','social_deliverables','social_links']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for now" ON %I;', t);
    EXECUTE format('CREATE POLICY "Allow all for now" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_posts_client ON social_posts (client_id);
CREATE INDEX IF NOT EXISTS idx_social_campaign_tasks_campaign ON social_campaign_tasks (campaign_id);
CREATE INDEX IF NOT EXISTS idx_social_deliverables_client ON social_deliverables (client_id);
CREATE INDEX IF NOT EXISTS idx_social_links_client ON social_links (client_id);
