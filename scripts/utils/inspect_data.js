const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../../.env.local');
let serviceRoleKey = '';
let supabaseUrl = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      serviceRoleKey = line.split('SUPABASE_SERVICE_ROLE_KEY=')[1].trim().replace(/['"]/g, '');
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('NEXT_PUBLIC_SUPABASE_URL=')[1].trim().replace(/['"]/g, '');
    }
  }
} catch (err) {
  console.error('Failed to read .env.local:', err);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function benchmarkQuery(name, queryFn) {
  const start = performance.now();
  try {
    const { data, error, count } = await queryFn();
    const end = performance.now();
    const duration = end - start;
    if (error) {
      return { name, success: false, error: error.message, duration };
    }
    const size = Array.isArray(data) ? data.length : (data ? 1 : 0);
    return { name, success: true, count: count !== undefined ? count : size, duration, sizeBytes: JSON.stringify(data).length };
  } catch (err) {
    const end = performance.now();
    return { name, success: false, error: err.message, duration: end - start };
  }
}

async function main() {
  const tables = ['jobs', 'clients', 'contacts', 'inventory', 'job_roles', 'job_shotlist', 'job_schedules', 'gear_templates'];
  const results = [];

  console.log('--- SYSTEM DATABASE BASELINE BENCHMARK ---');
  for (const table of tables) {
    console.log(`Querying table "${table}"...`);
    const res = await benchmarkQuery(`Select all from ${table}`, () => 
      supabase.from(table).select('*', { count: 'exact' })
    );
    results.push(res);
  }

  // Test relationship query (EditTracker style)
  console.log('Querying jobs with editor contacts relationship...');
  const relationRes = await benchmarkQuery('Jobs with editor relationship', () =>
    supabase.from('jobs').select('*, editor:contacts(*)').order('shoot_date', { ascending: false })
  );
  results.push(relationRes);

  console.log('\n--- RESULTS ---');
  console.table(results.map(r => ({
    Query: r.name,
    Success: r.success ? 'Yes' : 'No',
    'Row Count': r.count !== undefined ? r.count : 'N/A',
    'Latency (ms)': r.duration.toFixed(2),
    'Payload Size (bytes)': r.sizeBytes || 0,
    Error: r.error || 'None'
  })));
}

main();
