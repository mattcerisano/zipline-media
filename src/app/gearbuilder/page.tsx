import { redirect } from 'next/navigation';

/**
 * Retired. /gearbuilder used to be a standalone copy of the Gear Builder behind
 * a password checked in the browser — the password shipped in the public JS
 * bundle and the unlock was a localStorage flag anyone could set. The same tool
 * lives in the Command Center behind Supabase auth, so old bookmarks land there
 * with the Gear Builder tab selected.
 */
export default function GearBuilderPage() {
  redirect('/command-center?tab=gear');
}
