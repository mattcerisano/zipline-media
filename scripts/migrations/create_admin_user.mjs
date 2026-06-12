import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function updateUser() {
  console.log('Fetching user...');
  
  // First, get the user ID
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  const user = users.find(u => u.email === 'matt@zipline.media');
  
  if (!user) {
     console.log('User not found.');
     return;
  }

  console.log('Updating password for:', user.email);
  
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: 'zipline2026', email_confirm: true }
  );

  if (error) {
    console.error('Error updating user:', error);
  } else {
    console.log('Successfully updated password!');
  }
}

updateUser();