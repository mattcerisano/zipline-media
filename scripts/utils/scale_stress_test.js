const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read environment config
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
  console.error('❌ Failed to read .env.local:', err);
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Batch helper
async function batchInsert(table, items, batchSize = 50) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const { data, error } = await supabase.from(table).insert(batch).select('id');
    if (error) {
      throw new Error(`Error inserting batch into ${table}: ${error.message}`);
    }
    if (data) {
      results.push(...data.map(d => d.id));
    }
  }
  return results;
}

async function runBenchmark(name, queryFn) {
  const start = performance.now();
  try {
    const { data, error } = await queryFn();
    const end = performance.now();
    const duration = end - start;
    if (error) {
      return { name, success: false, error: error.message, duration };
    }
    const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
    const sizeBytes = JSON.stringify(data || {}).length;
    return { name, success: true, count, duration, sizeBytes };
  } catch (err) {
    const end = performance.now();
    return { name, success: false, error: err.message, duration: end - start };
  }
}

async function main() {
  console.log('🚀 INITIALIZING STRESS TEST & BENCHMARK SUITE...');
  console.log(`Supabase URL: ${supabaseUrl}`);

  // Capture baseline counts
  console.log('\n📊 Fetching database baseline counts...');
  const baseline = {};
  for (const table of ['jobs', 'contacts', 'job_roles']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Error reading ${table} count:`, error.message);
      process.exit(1);
    }
    baseline[table] = count;
    console.log(`   - ${table}: ${count} rows`);
  }

  const SEED_SIZE = 250;
  console.log(`\n🌱 Seeding ${SEED_SIZE} records of each type...`);
  
  const createdContactIds = [];
  const createdJobIds = [];
  const createdJobRoleIds = [];

  try {
    // 1. Seed Contacts
    console.log('   Generating mock contacts...');
    const mockContacts = Array.from({ length: SEED_SIZE }).map((_, i) => ({
      name: `[STRESS_TEST] Contact ${i}`,
      email: `st_contact_${i}@zipline-stress.test`,
      phone: `+1-555-0199-${i.toString().padStart(4, '0')}`,
      primary_role: i % 3 === 0 ? 'Director' : i % 3 === 1 ? 'DP' : 'Editor',
      notes_general: 'Seeded for scale testing purposes.'
    }));
    const contactIds = await batchInsert('contacts', mockContacts, 50);
    createdContactIds.push(...contactIds);
    console.log(`   ✅ Seeded ${createdContactIds.length} contacts.`);

    // 2. Seed Jobs
    console.log('   Generating mock jobs...');
    const mockJobs = Array.from({ length: SEED_SIZE }).map((_, i) => {
      // Pick a random contact to assign as editor
      const editorId = createdContactIds[Math.floor(Math.random() * createdContactIds.length)];
      // Random date in the next 90 days
      const daysAhead = Math.floor(Math.random() * 90);
      const shootDate = new Date();
      shootDate.setDate(shootDate.getDate() + daysAhead);
      
      return {
        title: `[STRESS_TEST] Job ${i}`,
        client_name: `[STRESS_TEST] Client ${i % 10}`,
        job_status: i % 4 === 0 ? 'Planning' : i % 4 === 1 ? 'Scheduled' : i % 4 === 2 ? 'Completed' : 'Cancelled',
        shoot_date: shootDate.toISOString().split('T')[0],
        editor_id: i % 2 === 0 ? editorId : null,
        edit_status: i % 3 === 0 ? 'Rough Cut' : i % 3 === 1 ? 'Color/Audio' : 'Approved',
        notes_general: 'Seeded for database scale testing.'
      };
    });
    const jobIds = await batchInsert('jobs', mockJobs, 50);
    createdJobIds.push(...jobIds);
    console.log(`   ✅ Seeded ${createdJobIds.length} jobs.`);

    // 3. Seed Job Roles (crew assignments)
    console.log('   Generating mock crew assignments (job_roles)...');
    const mockJobRoles = Array.from({ length: SEED_SIZE }).map((_, i) => {
      const jobId = createdJobIds[i % createdJobIds.length];
      const contactId = createdContactIds[i % createdContactIds.length];
      return {
        job_id: jobId,
        contact_id: contactId,
        name: `[STRESS_TEST] Crew ${i}`,
        position: i % 2 === 0 ? 'Camera Operator' : 'Gaffer',
        department: i % 2 === 0 ? 'Camera' : 'Lighting',
        day_rate: 650 + (i % 5) * 50
      };
    });
    const jobRoleIds = await batchInsert('job_roles', mockJobRoles, 50);
    createdJobRoleIds.push(...jobRoleIds);
    console.log(`   ✅ Seeded ${createdJobRoleIds.length} job roles.`);

    console.log('\n🔥 DATABASE SEEDING COMPLETED successfully.');

    // ----------------------------------------------------
    // BENCHMARKS
    // ----------------------------------------------------
    console.log('\n📊 RUNNING BENCHMARKS AGAINST ACTIVE WORKLOAD...');
    const reports = [];

    // Benchmark 1: Select all jobs (Slate/Dashboard load)
    console.log('   [1/6] Running: Select all jobs...');
    reports.push(await runBenchmark('Select all jobs (Dashboard / Slate load)', () => 
      supabase.from('jobs').select('*')
    ));

    // Benchmark 2: Query jobs with complex editor join (EditTracker load)
    console.log('   [2/6] Running: Jobs with Editor relationships (EditTracker)...');
    reports.push(await runBenchmark('Select jobs join editor contact (EditTracker)', () =>
      supabase.from('jobs').select('*, editor:contacts(*)').order('shoot_date', { ascending: false })
    ));

    // Benchmark 3: Query contacts list (Rolodex load)
    console.log('   [3/6] Running: Select all contacts...');
    reports.push(await runBenchmark('Select all contacts (Rolodex load)', () =>
      supabase.from('contacts').select('*').order('name')
    ));

    // Benchmark 4: Calendar Date Range query
    console.log('   [4/6] Running: Calendar date-range query...');
    const startRange = new Date().toISOString().split('T')[0];
    const endRange = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    reports.push(await runBenchmark('Select jobs in date range (30-day view)', () =>
      supabase.from('jobs').select('*').gte('shoot_date', startRange).lte('shoot_date', endRange)
    ));

    // Benchmark 5: Search jobs by title index check
    console.log('   [5/6] Running: Job title text search...');
    reports.push(await runBenchmark('Search jobs by title like query', () =>
      supabase.from('jobs').select('*').ilike('title', '%Job 12%')
    ));

    // Benchmark 6: Concurrency Stress Test
    console.log('   [6/6] Running: Simulated concurrency stress test (15 parallel reads)...');
    const concurrencyStart = performance.now();
    const concurrentRequests = Array.from({ length: 15 }).map(() =>
      supabase.from('jobs').select('*, editor:contacts(*)').order('shoot_date', { ascending: false })
    );
    const concurrentResults = await Promise.all(concurrentRequests);
    const concurrencyEnd = performance.now();
    const totalConcurrencyDuration = concurrencyEnd - concurrencyStart;
    
    let concurrentErrorCount = 0;
    concurrentResults.forEach(r => {
      if (r.error) concurrentErrorCount++;
    });

    console.log('\n--- BENCHMARK RESULTS SUMMARY ---');
    console.table(reports.map(r => ({
      Query: r.name,
      Success: r.success ? 'Yes' : 'No',
      'Rows Returned': r.count,
      'Latency (ms)': r.duration.toFixed(2),
      'Payload Size (bytes)': r.sizeBytes,
      'Speed/Row (ms)': r.count > 0 ? (r.duration / r.count).toFixed(3) : 'N/A',
      Error: r.error || 'None'
    })));

    console.log(`\n⚡ Concurrency Stress Test Results:`);
    console.log(`   - 15 parallel job-relation queries dispatched.`);
    console.log(`   - Total completion time: ${totalConcurrencyDuration.toFixed(2)} ms`);
    console.log(`   - Average response time: ${(totalConcurrencyDuration / 15).toFixed(2)} ms`);
    console.log(`   - Errors encountered: ${concurrentErrorCount}`);

  } catch (error) {
    console.error('❌ Benchmark error occurred:', error.message);
  } finally {
    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n🧹 CLEANING UP DATABASE (Restoring Baseline)...');
    
    if (createdJobRoleIds.length > 0) {
      console.log(`   Deleting ${createdJobRoleIds.length} seeded job roles...`);
      const { error } = await supabase.from('job_roles').delete().in('id', createdJobRoleIds);
      if (error) console.error('   ❌ Error deleting job_roles:', error.message);
      else console.log('   ✅ Cleaned job roles.');
    }

    if (createdJobIds.length > 0) {
      console.log(`   Deleting ${createdJobIds.length} seeded jobs...`);
      const { error } = await supabase.from('jobs').delete().in('id', createdJobIds);
      if (error) console.error('   ❌ Error deleting jobs:', error.message);
      else console.log('   ✅ Cleaned jobs.');
    }

    if (createdContactIds.length > 0) {
      console.log(`   Deleting ${createdContactIds.length} seeded contacts...`);
      const { error } = await supabase.from('contacts').delete().in('id', createdContactIds);
      if (error) console.error('   ❌ Error deleting contacts:', error.message);
      else console.log('   ✅ Cleaned contacts.');
    }

    // Verify restore
    console.log('\n📊 Verifying database final counts against baseline...');
    let clean = true;
    for (const table of ['jobs', 'contacts', 'job_roles']) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error && count === baseline[table]) {
        console.log(`   - ${table}: ${count} rows (Match ✅)`);
      } else {
        console.warn(`   - ⚠️ ${table}: ${count} rows (Expected ${baseline[table]} ❌)`);
        clean = false;
      }
    }

    if (clean) {
      console.log('\n🌟 DATABASE RESTORED TO ORIGINAL BASELINE SUCCESSFULLY.');
    } else {
      console.error('\n⚠️ CLEANUP INCOMPLETE. Some seeded values may remain.');
    }
  }
}

main();
