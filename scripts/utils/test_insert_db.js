const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './.env.local';
let serviceRoleKey = '';
let anonKey = '';
let supabaseUrl = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      serviceRoleKey = line.split('SUPABASE_SERVICE_ROLE_KEY=')[1].trim().replace(/['"]/g, '');
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      anonKey = line.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].trim().replace(/['"]/g, '');
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('NEXT_PUBLIC_SUPABASE_URL=')[1].trim().replace(/['"]/g, '');
    }
  }
} catch (err) {
  console.error('Failed to read .env.local:', err);
  process.exit(1);
}

const supabaseService = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function testInsert() {
  console.log('Querying pg_policies from Supabase...');
  const { data, error } = await supabaseService.rpc('get_policies'); // If custom rpc exists
  
  let policies = null;
  let sqlError = null;
  try {
    const res = await supabaseService
      .from('pg_policies')
      .select('*');
    policies = res.data;
    sqlError = res.error;
  } catch (e) {
    sqlError = e;
  }

  if (sqlError || !policies) {
    // Let's run a query to get roles and user roles for checking authentication
    console.log('Exposing system query not allowed. Querying user_roles table...');
    const { data: roles, error: rolesError } = await supabaseService
      .from('user_roles')
      .select('*');
    if (rolesError) {
      console.error('Error fetching user_roles:', rolesError);
    } else {
      console.log('Active user roles in database:', roles);
    }
  } else {
    console.log('Policies:', policies);
  }
}

testInsert();
