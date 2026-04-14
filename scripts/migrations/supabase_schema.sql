-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Inventory Table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  replacement DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image TEXT,
  owner TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients Table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  primary_role TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  tags TEXT,
  notes_general TEXT,
  is_favorite BOOLEAN DEFAULT false,
  job_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  client_name TEXT,
  production_company TEXT,
  job_status TEXT DEFAULT 'Planning',
  type TEXT DEFAULT 'production',
  shoot_date DATE,
  end_date DATE,
  call_time TEXT,
  location_name TEXT,
  location_address TEXT,
  nearest_hospital_name TEXT,
  nearest_hospital_address TEXT,
  nearest_hospital_phone TEXT,
  nearest_parking_name TEXT,
  nearest_parking_address TEXT,
  weather_summary TEXT,
  gear_list_url TEXT,
  gear_manifest JSONB DEFAULT '{}'::jsonb,
  quote_url TEXT,
  estimate_url TEXT,
  notes_general TEXT,
  discord_url TEXT,
  review_link TEXT,
  review_password TEXT,
  drive_folder_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Roles Table (linking jobs and contacts)
CREATE TABLE job_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT, -- Fallback if no contact_id
  position TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  email TEXT,
  call_time TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies (Basic - can be refined later)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;

-- Simple public access for now (if anon key is used and we want easy testing)
-- In production, these should be restricted to authenticated users.
CREATE POLICY "Allow public read access" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON clients FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON contacts FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON jobs FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON job_roles FOR SELECT USING (true);

-- Allow all for now to facilitate migration and development
CREATE POLICY "Allow all for now" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON job_roles FOR ALL USING (true) WITH CHECK (true);
