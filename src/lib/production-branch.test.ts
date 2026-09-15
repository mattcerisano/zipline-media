import { describe, expect, it } from 'vitest';
import { OVERRIDE_VAR, productionBranchError } from './production-branch';

describe('productionBranchError', () => {
  it('allows production builds of main', () => {
    expect(productionBranchError({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' })).toBeNull();
  });

  it('blocks a promoted preview of a feature branch', () => {
    const err = productionBranchError({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feature/social-shotlist-quickbooks' });
    expect(err).toContain('feature/social-shotlist-quickbooks');
  });

  it('blocks production builds with no git metadata', () => {
    expect(productionBranchError({ VERCEL_ENV: 'production' })).toContain('unknown branch');
  });

  it('ignores preview deployments and local builds', () => {
    expect(productionBranchError({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' })).toBeNull();
    expect(productionBranchError({})).toBeNull();
  });

  it('can be overridden deliberately', () => {
    expect(productionBranchError({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'hotfix', [OVERRIDE_VAR]: '1' })).toBeNull();
  });
});
