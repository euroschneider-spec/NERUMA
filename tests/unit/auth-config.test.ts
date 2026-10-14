// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// supabase/config.toml drives local Supabase only; the hosted projects are set in the dashboard (docs/guides/TWO-FACTOR.md,
// TECH-TASKS §13). Keeping the file true to what the app assumes means a local run behaves like production, and the file
// can't switch something off by accident if it is ever pushed.
const toml = readFileSync('supabase/config.toml', 'utf8');
const section = (name: string) => {
  const start = toml.indexOf(`\n[${name}]`);
  if (start < 0) return '';
  const rest = toml.slice(start + 1);
  const next = rest.slice(1).search(/\n\[/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const value = (body: string, key: string) => body.split('\n').find((line) => line.startsWith(`${key} =`))?.split('=')[1]?.split('#')[0].trim();

describe('supabase/config.toml matches what the app assumes', () => {
  it('requires at least 12 characters and no forced character classes (TECH-TASKS §7)', () => {
    expect(Number(value(section('auth'), 'minimum_password_length'))).toBeGreaterThanOrEqual(12);
    expect(value(section('auth'), 'password_requirements')).toBe('""');
  });
  it('has no anonymous sign-ins: the database treats them as unconfirmed identities', () => {
    expect(value(section('auth'), 'enable_anonymous_sign_ins')).toBe('false');
  });
  it('lets people register with email and password, and requires them to confirm the address', () => {
    expect(value(section('auth'), 'enable_signup')).toBe('true');
    expect(value(section('auth.email'), 'enable_signup')).toBe('true');
    // The database relies on a confirmed email for every organisation action; unconfirmed accounts would skip the check.
    expect(value(section('auth.email'), 'enable_confirmations')).toBe('true');
  });
  it('turns on authenticator-app two-factor sign-in, and no phone or SMS factor', () => {
    expect(value(section('auth.mfa.totp'), 'enroll_enabled')).toBe('true');
    expect(value(section('auth.mfa.totp'), 'verify_enabled')).toBe('true');
    expect(value(section('auth.mfa.phone'), 'enroll_enabled')).toBe('false');
    expect(value(section('auth.mfa.phone'), 'verify_enabled')).toBe('false');
  });
  it('rotates refresh tokens and keeps access tokens short-lived', () => {
    expect(value(section('auth'), 'enable_refresh_token_rotation')).toBe('true');
    expect(Number(value(section('auth'), 'jwt_expiry'))).toBeLessThanOrEqual(3600);
  });
  it('allows no wildcard redirect address and no plain-http address other than loopback', () => {
    const redirects = value(section('auth'), 'additional_redirect_urls') ?? '';
    expect(redirects).not.toContain('*');
    for (const address of redirects.match(/"[^"]+"/g) ?? []) {
      if (address.startsWith('"http://')) expect(address).toMatch(/^"http:\/\/(127\.0\.0\.1|localhost)[:/"]/);
    }
  });
});
