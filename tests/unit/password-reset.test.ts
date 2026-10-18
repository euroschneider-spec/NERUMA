import { describe, expect, it } from 'vitest';
import { getResetCopy, MAX_PASSWORD, MIN_PASSWORD, passwordProblem, tokenHashPattern, validEmail } from '@/lib/password-reset';
import { locales } from '@/lib/i18n';

describe('passwordProblem', () => {
  const good = 'a-long-enough-password';
  it('accepts a password of 12 to 128 characters typed twice', () => {
    expect(passwordProblem(good, good)).toBeNull();
    expect(passwordProblem('x'.repeat(MIN_PASSWORD), 'x'.repeat(MIN_PASSWORD))).toBeNull();
    expect(passwordProblem('x'.repeat(MAX_PASSWORD), 'x'.repeat(MAX_PASSWORD))).toBeNull();
  });
  it('refuses one that is too short, too long, or typed differently the second time', () => {
    expect(passwordProblem('x'.repeat(MIN_PASSWORD - 1), 'x'.repeat(MIN_PASSWORD - 1))).toBe('short');
    expect(passwordProblem('', '')).toBe('short');
    expect(passwordProblem('x'.repeat(MAX_PASSWORD + 1), 'x'.repeat(MAX_PASSWORD + 1))).toBe('long');
    expect(passwordProblem(good, `${good} `)).toBe('mismatch');
  });
  it('checks the length before the match, so a short password is never reported as a typing mistake', () => {
    expect(passwordProblem('short', 'different')).toBe('short');
  });
});

describe('tokenHashPattern', () => {
  it('accepts the shape of a Supabase token hash and nothing that could be a path or a script', () => {
    expect(tokenHashPattern.test('pkce_6f1c0d0a9b3e4f5a8c7d2e1b0a9f8e7d6c5b4a39')).toBe(true);
    expect(tokenHashPattern.test('a'.repeat(64))).toBe(true);
    for (const bad of ['', 'short', '../../etc/passwd'.padEnd(20, 'a'), 'a'.repeat(16) + '<script>', 'a'.repeat(201), 'a b'.padEnd(20, 'a')]) expect(tokenHashPattern.test(bad), bad).toBe(false);
  });
});

describe('validEmail', () => {
  it('accepts an ordinary address and refuses the rest', () => {
    expect(validEmail('person@example.org')).toBe(true);
    for (const bad of ['', 'person', 'person@', '@example.org', 'a b@example.org', 'a@b', `${'x'.repeat(250)}@a.bc`]) expect(validEmail(bad), bad).toBe(false);
  });
});

describe('reset copy', () => {
  it('has every text in all three languages, none empty', () => {
    const english = getResetCopy('en');
    for (const locale of locales) {
      const copy = getResetCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort());
      for (const [key, text] of Object.entries(copy)) expect(text.trim(), `${locale}.${key}`).not.toBe('');
    }
  });
  it('never says whether an address has an account', () => {
    for (const locale of locales) {
      const { sent } = getResetCopy(locale);
      expect(sent, locale).not.toMatch(/\b(no account|not found|nu există|kein Konto gefunden|nicht gefunden)\b/i);
    }
  });
  it('states the same limits as the rules: 12 and 128', () => {
    for (const locale of locales) {
      const copy = getResetCopy(locale);
      expect(copy.short, locale).toContain(String(MIN_PASSWORD));
      expect(copy.long, locale).toContain(String(MAX_PASSWORD));
      expect(copy.hint, locale).toContain(String(MIN_PASSWORD));
    }
  });
});
