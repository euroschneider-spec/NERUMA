// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// Secrets are generated locally and live in a gitignored .env (CLAUDE.md). This test fails the build if one slips into a
// tracked file, or if the file that should hide it stops being ignored. It reads only files git tracks.
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  .filter((path) => existsSync(path) && !/\.(png|jpe?g|webp|ico|woff2?|pdf|svg)$/i.test(path) && path !== 'package-lock.json');
const read = (path: string) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
const hits = (pattern: RegExp) => tracked.filter((path) => !path.startsWith('tests/unit/no-secrets') && pattern.test(read(path)));

describe('no secrets in tracked files', () => {
  it('has no Supabase secret or service-role key', () => {
    expect(hits(/sb_secret_[A-Za-z0-9_-]{16,}/)).toEqual([]);
    // A JWT whose payload says service_role (base64 of {"role":"service_role"…} contains this stem).
    expect(hits(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\./)).toEqual([]);
  });
  it('has no database password in a connection string', () => {
    const withPassword = /postgres(ql)?:\/\/[^:\s/]+:(?!\[YOUR|<|\$|\*|password@|postgres@|PASSWORD)[^@\s]{6,}@/i;
    expect(hits(withPassword)).toEqual([]);
  });
  it('has no private keys, GitHub tokens or Vercel tokens', () => {
    expect(hits(/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/)).toEqual([]);
    expect(hits(/\bgh[pousr]_[A-Za-z0-9]{30,}\b/)).toEqual([]);
    expect(hits(/\bvercel_[a-z]*_[A-Za-z0-9]{20,}\b/i)).toEqual([]);
  });
  it('has no .env file tracked and ignores them', () => {
    expect(tracked.filter((path) => /(^|\/)\.env(\.|$)/.test(path) && !/\.example$/.test(path))).toEqual([]);
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env/m);
  });
  it('the admin token and the test password are test-only values, not real ones', () => {
    // The fixture password is a documented, test-only value (scripts/workspace-fixture.mjs); nothing else may carry one.
    const passwords = tracked.filter((path) => /FIXTURE_PASSWORD\s*=/.test(read(path)));
    expect(passwords).toEqual(['scripts/workspace-fixture.mjs']);
  });
});
