import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';

// Team member management for the internal command center. Admin-only:
// - GET    → list members (user_roles)
// - POST   → create a teammate account (email + temporary password + role)
// - PATCH  → change a member's role
// - DELETE → remove a member (auth user + role row)
//
// Accounts created here are for the internal team (admin/staff). Identity is
// always proven by the caller's bearer token; the target comes from the body.

const VALID_ROLES = ['admin', 'staff', 'client'] as const;
type Role = (typeof VALID_ROLES)[number];

// Mirrors the primary-administrator bypass used at login, so the org owner
// can manage the team even without a user_roles row.
const OWNER_EMAIL = 'matt@zipline.media';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(request: Request) {
  const caller = await getAuthedUser(request);
  if (!caller) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };

  const admin = getAdminClient();
  if (!admin) return { error: NextResponse.json({ error: 'Server is not configured.' }, { status: 500 }) };

  if (caller.email !== OWNER_EMAIL) {
    const { data } = await admin.from('user_roles').select('role').eq('id', caller.id).maybeSingle();
    if (data?.role !== 'admin') {
      return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }
  }
  return { caller, admin };
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  const { data, error } = await gate.admin
    .from('user_roles')
    .select('id, email, role')
    .order('email');
  if (error) {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
  return NextResponse.json({ members: data || [] });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const role: Role = VALID_ROLES.includes(body.role) ? body.role : 'staff';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Temporary password must be at least 8 characters.' }, { status: 400 });
  }

  // Create the auth account, pre-confirmed so the teammate can sign in
  // immediately with the temporary password the admin hands them.
  const { data: created, error: createErr } = await gate.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes('already') ? 'An account with this email already exists.' : 'Failed to create the account.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: roleErr } = await gate.admin
    .from('user_roles')
    .upsert({ id: created.user.id, email, role }, { onConflict: 'id' });
  if (roleErr) {
    console.error('Account created but role assignment failed:', roleErr);
    return NextResponse.json({ error: 'Account created, but assigning the role failed — set it manually.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: { id: created.user.id, email, role } });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const { userId, role } = body;
  if (!userId || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'userId and a valid role are required.' }, { status: 400 });
  }
  if (userId === gate.caller.id && role !== 'admin') {
    return NextResponse.json({ error: 'You cannot demote your own account.' }, { status: 400 });
  }

  const { error } = await gate.admin.from('user_roles').update({ role }).eq('id', userId);
  if (error) {
    return NextResponse.json({ error: 'Failed to update the role.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }
  if (userId === gate.caller.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }

  // Remove the login first, then the role row. OAuth grants are deleted
  // explicitly so a removed teammate leaves no usable token behind — every
  // provider table has to be listed here, so add to this list when one is added.
  const { error: authErr } = await gate.admin.auth.admin.deleteUser(userId);
  if (authErr && !authErr.message?.includes('not found')) {
    return NextResponse.json({ error: 'Failed to delete the account.' }, { status: 500 });
  }
  await gate.admin.from('user_roles').delete().eq('id', userId);
  await gate.admin.from('google_tokens').delete().eq('id', userId);
  await gate.admin.from('quickbooks_tokens').delete().eq('id', userId);

  return NextResponse.json({ success: true });
}
