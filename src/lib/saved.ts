import { toast } from '@/components/Feedback';

type WriteResult = { error: { message: string } | null };

/**
 * Runs a Supabase write and returns its result only if the write landed.
 *
 * Supabase doesn't throw when a write is refused — a dropped connection, an
 * expired session or a permission rule all come back as `{ error }` — so the
 * `try { await supabase…update() } catch {}` pattern this replaces never
 * caught anything. The screen showed the change, the database never had it,
 * and it quietly disappeared on the next reload.
 *
 * On failure this shows a toast and resolves null, so the caller can put the
 * screen back: `if (!(await saved(write, 'delete the task'))) reload();`.
 * `what` finishes the sentence "Couldn't …".
 */
export async function saved<T extends WriteResult>(write: PromiseLike<T>, what: string): Promise<T | null> {
  let detail: string;
  try {
    const result = await write;
    if (!result.error) return result;
    detail = result.error.message;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }
  console.error(`Couldn't ${what}:`, detail);
  toast(`Couldn't ${what} — the change wasn't saved. Check your connection and try again.`, 'error');
  return null;
}
