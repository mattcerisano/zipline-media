import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase client that uses the service role key to bypass RLS policies
const getServiceSupabase = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are missing on the server.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, gear_manifest } = body;

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID is required.' }, { status: 400 });
    }

    if (typeof gear_manifest !== 'object' || gear_manifest === null) {
      return NextResponse.json({ success: false, error: 'Invalid gear manifest format.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Perform update on jobs table
    const { data, error } = await supabase
      .from('jobs')
      .update({
        gear_manifest,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select('id, title')
      .single();

    if (error) {
      console.error('[Share Gear API] Database update error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Updated gear list for job: ${data.title}` });
  } catch (err: any) {
    console.error('[Share Gear API] POST handler crashed:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
