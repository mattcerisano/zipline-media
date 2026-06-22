const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/mattcerisano/Documents/Websites/zipline-media/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Query a single client to see the fields returned
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('*')
    .limit(1);
    
  if (clientsErr) {
    console.error('Error fetching clients:', clientsErr);
    process.exit(1);
  }
  
  console.log('Client record schema sample:');
  console.log(JSON.stringify(clients, null, 2));
}

main();
