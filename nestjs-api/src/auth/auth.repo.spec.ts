import { resolveEffectivePermission } from './auth.repo.js';

describe('effective permission precedence', () => {
  it('allows a role grant when no user override exists', () => {
    expect(resolveEffectivePermission(null, true)).toBe(true);
  });

  it('allows an explicit user grant beyond the role baseline', () => {
    expect(resolveEffectivePermission(true, false)).toBe(true);
  });

  it('lets an explicit user deny override a role grant, including ADMIN', () => {
    expect(resolveEffectivePermission(false, true)).toBe(false);
  });

  it('denies by default when neither source grants', () => {
    expect(resolveEffectivePermission(null, false)).toBe(false);
  });
});
