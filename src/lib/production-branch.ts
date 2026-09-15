/**
 * Guards production builds against shipping a branch other than `main`.
 *
 * On 2026-09-09 a preview of a months-stale feature branch was promoted to
 * production from the Vercel dashboard. Promoting a preview *rebuilds* it with
 * VERCEL_ENV=production, so this check turns that into a failed deploy instead
 * of a silent rollback of everything merged since the branch forked.
 *
 * Instant rollbacks — re-promoting an existing production deployment — don't
 * rebuild, so they still work as the recovery path.
 */
export const PRODUCTION_BRANCH = 'main';
export const OVERRIDE_VAR = 'ALLOW_NON_MAIN_PRODUCTION_BUILD';

type Env = Record<string, string | undefined>;

/** Returns why this build must not ship, or null when it's allowed. */
export function productionBranchError(env: Env): string | null {
  if (env.VERCEL_ENV !== 'production') return null;
  if (env[OVERRIDE_VAR] === '1') return null;

  const ref = env.VERCEL_GIT_COMMIT_REF;
  if (ref === PRODUCTION_BRANCH) return null;

  const source = ref ? `branch "${ref}"` : 'an unknown branch (no git metadata, e.g. `vercel --prod` from a local folder)';
  return [
    `Refusing to build production from ${source}.`,
    `Production must be built from "${PRODUCTION_BRANCH}" — merge the branch first.`,
    `To restore an earlier production build, use Instant Rollback instead (it doesn't rebuild).`,
    `If this really is intentional, set ${OVERRIDE_VAR}=1 for this deployment.`,
  ].join('\n');
}
