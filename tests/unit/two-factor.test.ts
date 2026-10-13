import { describe, it, expect } from 'vitest';
import { backupCode, getTwoFactorCopy, groupedKey, parseTwoFactorStatus, secondFactorCode, twoFactorStep, upcomingDeadline, type TwoFactorStatus } from '@/lib/two-factor';
import { locales } from '@/lib/i18n';

const status = (overrides: Partial<TwoFactorStatus> = {}): TwoFactorStatus => ({ enrolled: false, required: false, deadline: null, passed: true, ...overrides });

describe('parseTwoFactorStatus', () => {
  it('reads what the database answers', () => {
    expect(parseTwoFactorStatus({ enrolled: true, required: false, deadline: '2026-11-13T09:00:00+00:00', passed: false }))
      .toEqual({ enrolled: true, required: false, deadline: '2026-11-13T09:00:00+00:00', passed: false });
  });
  it('fails closed on anything else', () => {
    expect(parseTwoFactorStatus(null)).toBeNull();
    expect(parseTwoFactorStatus('passed')).toBeNull();
    expect(parseTwoFactorStatus({ enrolled: true, required: false, deadline: null })).toBeNull();
    expect(parseTwoFactorStatus({ enrolled: 'yes', required: false, deadline: null, passed: true })).toBeNull();
  });
  it('drops a deadline that is not a date', () => {
    expect(parseTwoFactorStatus({ enrolled: false, required: false, deadline: 'soon', passed: true })?.deadline).toBeNull();
  });
});

describe('twoFactorStep', () => {
  it('lets a session that passed through', () => {
    expect(twoFactorStep(status())).toBeNull();
    expect(twoFactorStep(status({ enrolled: true, passed: true }))).toBeNull();
  });
  it('asks for the code when an authenticator app is set up', () => {
    expect(twoFactorStep(status({ enrolled: true, passed: false }))).toBe('verify');
  });
  it('sends an account that must have two-factor but has none to setup', () => {
    expect(twoFactorStep(status({ required: true, passed: false }))).toBe('setup');
  });
});

describe('secondFactorCode', () => {
  it('accepts six digits, with the space authenticator apps show', () => {
    expect(secondFactorCode('123456')).toBe('123456');
    expect(secondFactorCode(' 123 456 ')).toBe('123456');
  });
  it('rejects anything else', () => {
    for (const value of ['', '12345', '1234567', '12345a', '١٢٣٤٥٦', '123-456']) expect(secondFactorCode(value)).toBeNull();
  });
});

describe('backupCode', () => {
  it('accepts a code as typed, with spaces, dashes or capitals', () => {
    expect(backupCode('k4m9x7qp2ab8ht3z')).toBe('k4m9x7qp2ab8ht3z');
    expect(backupCode(' K4M9-X7QP 2AB8-HT3Z ')).toBe('K4M9X7QP2AB8HT3Z');
  });
  it('rejects what cannot be a backup code', () => {
    for (const value of ['', 'short', 'k4m9_x7qp_2ab8', 'k4m9x7qp2ab8ht3z'.repeat(3)]) expect(backupCode(value)).toBeNull();
  });
});

describe('groupedKey', () => {
  it('groups the setup key in fours', () => {
    expect(groupedKey('JBSWY3DPEHPK3PXPAB')).toBe('JBSW Y3DP EHPK 3PXP AB');
    expect(groupedKey('')).toBe('');
  });
});

describe('upcomingDeadline', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  it('shows the date while it is ahead and the account has no authenticator app', () => {
    expect(upcomingDeadline(status({ deadline: '2026-11-13T12:00:00Z' }), now)).toBe('2026-11-13T12:00:00Z');
  });
  it('shows nothing once it has passed, once set up, or when it does not apply', () => {
    expect(upcomingDeadline(status({ deadline: '2026-10-01T12:00:00Z' }), now)).toBeNull();
    expect(upcomingDeadline(status({ deadline: '2026-11-13T12:00:00Z', enrolled: true }), now)).toBeNull();
    expect(upcomingDeadline(status(), now)).toBeNull();
  });
});

describe('two-factor copy', () => {
  it('has every text in every language, and the banner has its date', () => {
    const keys = Object.keys(getTwoFactorCopy('en')).sort();
    for (const locale of locales) {
      const t = getTwoFactorCopy(locale);
      expect(Object.keys(t).sort()).toEqual(keys);
      expect(Object.values(t).every((value) => value.trim().length > 0)).toBe(true);
      expect(t.banner).toContain('{date}');
      expect(t.backupLeft).toContain('{left}');
      expect(t.backupLeft).toContain('{total}');
    }
  });
});
