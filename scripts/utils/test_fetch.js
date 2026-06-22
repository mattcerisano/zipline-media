const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = '/Users/mattcerisano/Documents/Websites/zipline-media/.env.local';
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

async function runTest() {
  const testEmail = `test_fetch_${Date.now()}@zipline.media`;
  const testPassword = 'TestPassword123!';
  let userId = null;

  try {
    console.log(`Creating test admin user ${testEmail}...`);
    const { data: userData, error: createUserError } = await supabaseService.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createUserError) throw createUserError;
    userId = userData.user.id;

    console.log('Inserting admin role...');
    const { error: insertRoleError } = await supabaseService
      .from('user_roles')
      .insert({ id: userId, email: testEmail, role: 'admin' });
    if (insertRoleError) throw insertRoleError;

    console.log('Signing in...');
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (signInError) throw signInError;

    const authenticatedClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await authenticatedClient.auth.setSession(signInData.session);

    console.log('Executing fetch queries...');
    const [jobsRes, clientsRes] = await Promise.all([
      authenticatedClient.from('jobs').select('*').order('shoot_date', { ascending: true }),
      authenticatedClient.from('clients').select('*')
    ]);

    console.log('Jobs response error:', jobsRes.error);
    console.log('Jobs data count:', jobsRes.data ? jobsRes.data.length : null);
    
    console.log('Clients response error:', clientsRes.error);
    console.log('Clients data count:', clientsRes.data ? clientsRes.data.length : null);

  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    if (userId) {
      console.log('Cleaning up test user and role...');
      await supabaseService.from('user_roles').delete().eq('id', userId);
      await supabaseService.auth.admin.deleteUser(userId);
    }
  }
}

runTest();
