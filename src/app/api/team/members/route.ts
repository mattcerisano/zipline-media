import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';
import { APP_ROLES, type AppRole } from '@/lib/roles';
import { isOwnerEmail } from '@/lib/api-owner';
import { hasAnyRole, POST_ROLES } from '@/lib/crew-roles';

// Team member management for the internal command center. Admin-only:
// - GET    → list members (user_roles), with the contact each is linked to
// - POST   → create an account (email + temporary password + role + contact)
// - PATCH  → change a member's role, or relink them to a contact
// - DELETE → remove a member (auth user + role row)
//
// Identity is always proven by the caller's bearer token; the target comes from
// the body.
//
// The contact link is what makes a freelance editor's account work at all.
// Assignment on the Edit Tracker is jobs.editor_id → contacts.id, and row-level
// security hands an editor the cards whose editor_id matches the contact their
// account is linked to (migration 20260822000000). An editor account with no
// link is an account that opens onto an empty board, so creating one here
// requires the link and will make the Rolodex entry if it doesn't exist yet.

const VALID_ROLES = APP_ROLES;
type Role = AppRole;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LEN = 120;

/**
 * Work out which Rolodex contact an account should be tied to.
 *
 * Either an existing contact was picked, or a name was typed and the contact is
 * created here — with the email the account is being created under, so the
 * fallback match in current_contact_id() lines up with the explicit link.
 */
async function resolveContact(
  admin: SupabaseClient,
  {
    contactId,
    contactName,
    email,
    ensureAssignable = false,
  }: { contactId?: unknown; contactName?: unknown; email: string; ensureAssignable?: boolean }
): Promise<{ id: string; created?: boolean } | { error: string }> {
  if (typeof contactId === 'string' && contactId) {
    if (!UUID_RE.test(contactId)) return { error: 'That contact id is not valid.' };
    const { data } = await admin
      .from('contacts')
      .select('id, primary_role, secondary_roles')
      .eq('id', contactId)
      .maybeSingle();
    if (!data) return { error: 'That contact no longer exists.' };

    // The card's Editor dropdown only offers people who hold a post role, so a
    // contact linked to an editor account but titled "Producer" could never be
    // given a card — the account would work and still see nothing. Adding the
    // hat rather than replacing their title keeps them billed as what they are
    // everywhere else (see crew-roles).
    if (ensureAssignable && !hasAnyRole(data, POST_ROLES)) {
      const secondary = Array.isArray(data.secondary_roles) ? data.secondary_roles : [];
      await admin
        .from('contacts')
        .update({ secondary_roles: [...secondary, 'Editor'] })
        .eq('id', data.id);
    }
    return { id: data.id as string };
  }

  const name = typeof contactName === 'string' ? contactName.trim().slice(0, MAX_NAME_LEN) : '';
  if (!name) return { error: 'Pick a Rolodex contact, or give a name to create one.' };

  const { data, error } = await admin
    .from('contacts')
    .insert([{ name, email, primary_role: 'Editor', is_favorite: false }])
    .select('id')
    .single();
  if (error || !data) return { error: 'Could not create the Rolodex contact.' };
  return { id: data.id as string, created: true };
}

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

  // Mirrors the primary-administrator bypass used at login, so the org owner
  // can manage the team even without a user_roles row.
  if (!isOwnerEmail(caller.email)) {
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
    .select('id, email, role, contact_id')
    .order('email');
  if (error) {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }

  // Name the linked contact, so the roster can say who an editor's board is
  // filtered by rather than showing a bare id.
  const linkedIds = Array.from(
    new Set((data || []).map(m => m.contact_id).filter((id): id is string => !!id))
  );
  const names = new Map<string, string>();
  if (linkedIds.length > 0) {
    const { data: linked } = await gate.admin.from('contacts').select('id, name').in('id', linkedIds);
    for (const contact of linked || []) names.set(contact.id as string, contact.name as string);
  }

  return NextResponse.json({
    members: (data || []).map(m => ({ ...m, contact_name: m.contact_id ? names.get(m.contact_id) || null : null })),
  });
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

  // Resolve the Rolodex link before creating the login, so a failure here
  // doesn't leave an account behind that nobody asked for. Required for an
  // editor — the link is what decides which cards they can see, and without it
  // they would sign in to an empty board — and optional for everyone else,
  // whose access doesn't depend on it.
  let contactId: string | null = null;
  let createdContact = false;
  if (role === 'editor' || body.contactId || body.contactName) {
    const link = await resolveContact(gate.admin, {
      contactId: body.contactId,
      contactName: body.contactName,
      email,
      ensureAssignable: role === 'editor',
    });
    if ('error' in link) {
      return NextResponse.json({ error: link.error }, { status: 400 });
    }
    contactId = link.id;
    createdContact = !!link.created;
  }

  // Create the auth account, pre-confirmed so the teammate can sign in
  // immediately with the temporary password the admin hands them.
  const { data: created, error: createErr } = await gate.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // Roll back a Rolodex entry made a moment ago for an account that then
    // couldn't be created — otherwise retrying a duplicate email leaves a
    // duplicate contact behind each time. An existing contact is left alone.
    if (createdContact && contactId) {
      await gate.admin.from('contacts').delete().eq('id', contactId);
    }
    const msg = createErr?.message?.includes('already') ? 'An account with this email already exists.' : 'Failed to create the account.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: roleErr } = await gate.admin
    .from('user_roles')
    .upsert({ id: created.user.id, email, role, contact_id: contactId }, { onConflict: 'id' });
  if (roleErr) {
    console.error('Account created but role assignment failed:', roleErr);
    return NextResponse.json({ error: 'Account created, but assigning the role failed — set it manually.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    member: { id: created.user.id, email, role, contact_id: contactId },
  });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  const body = await request.json().catch(() => ({}));
  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }

  const { data: target } = await gate.admin
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const update: { role?: Role; contact_id?: string | null } = {};

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'That is not a valid role.' }, { status: 400 });
    }
    if (userId === gate.caller.id && body.role !== 'admin') {
      return NextResponse.json({ error: 'You cannot demote your own account.' }, { status: 400 });
    }
    update.role = body.role;
  }

  // Relinking, or clearing the link with an explicit null. Clearing an editor's
  // link empties their board rather than opening it up, which is the safe way
  // round: they lose sight of the cards, not the studio.
  if (body.contactId !== undefined) {
    if (body.contactId === null || body.contactId === '') {
      update.contact_id = null;
    } else {
      const link = await resolveContact(gate.admin, {
        contactId: body.contactId,
        email: '',
        ensureAssignable: (update.role ?? target?.role) === 'editor',
      });
      if ('error' in link) {
        return NextResponse.json({ error: link.error }, { status: 400 });
      }
      update.contact_id = link.id;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { error } = await gate.admin.from('user_roles').update(update).eq('id', userId);
  if (error) {
    return NextResponse.json({ error: 'Failed to update the member.' }, { status: 500 });
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
