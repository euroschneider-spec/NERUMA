import { describe, it, expect } from 'vitest';
import { fill } from '@/lib/account-deletion';
import { locales } from '@/lib/i18n';
import { getSuperadminCopy, parseAccounts, parseOverview, parseProfile } from '@/lib/superadmin';

describe('parseOverview', () => {
  it('reads the six numbers', () => {
    expect(parseOverview({ pending_requests: 2, open_reports: 1, deletions_in_progress: 3, deletions_due: 1, accounts: 40, administrators: 2 }))
      .toEqual({ pendingRequests: 2, openReports: 1, deletionsInProgress: 3, deletionsDue: 1, accounts: 40, administrators: 2 });
  });
  it('turns anything odd into zero, and a non-object into null', () => {
    expect(parseOverview({ pending_requests: '2', open_reports: -1, accounts: NaN })).toMatchObject({ pendingRequests: 0, openReports: 0, accounts: 0 });
    expect(parseOverview(null)).toBeNull();
    expect(parseOverview('x')).toBeNull();
  });
});

describe('parseAccounts', () => {
  const row = { user_id: 'u1', email: 'a@example.test', created_at: '2026-10-01T10:00:00Z', last_sign_in_at: null, confirmed: true, is_admin: true, two_factor: false, deletion_pending: false, organisations: [{ id: 'o1', name: 'Museum', role: 'owner' }, { name: 'no id' }] };
  it('reads a page of accounts and drops what has no id', () => {
    const page = parseAccounts({ total: 3, rows: [row, { email: 'no id' }, null] });
    expect(page?.total).toBe(3);
    expect(page?.rows).toHaveLength(1);
    expect(page?.rows[0]).toMatchObject({ userId: 'u1', email: 'a@example.test', lastSignInAt: null, confirmed: true, isAdmin: true, twoFactor: false, deletionPending: false });
    expect(page?.rows[0].organisations).toEqual([{ id: 'o1', name: 'Museum', role: 'owner' }]);
  });
  it('fails closed when the answer is not a list', () => {
    expect(parseAccounts({ total: 1 })).toBeNull();
    expect(parseAccounts(undefined)).toBeNull();
  });
});

describe('parseProfile', () => {
  const base = { user_id: 'u1', email: 'a@example.test', created_at: '2026-10-01T10:00:00Z', last_sign_in_at: '2026-10-02T10:00:00Z', confirmed: true, is_admin: false, two_factor: true };
  it('reads the organisations with their status, the request and the deletion', () => {
    const profile = parseProfile({
      ...base,
      organisations: [{ id: 'o1', name: 'Museum', role: 'owner', status: 'approved' }],
      application: { status: 'pending', organisation: 'Museum', submitted_at: '2026-10-01T11:00:00Z' },
      deletion: { requested_at: '2026-10-03T10:00:00Z', delete_after: '2026-11-02T10:00:00Z', by_administrator: true },
    });
    expect(profile).toMatchObject({ userId: 'u1', twoFactor: true, deletionPending: true });
    expect(profile?.organisations).toEqual([{ id: 'o1', name: 'Museum', role: 'owner' }]);
    expect(profile?.organisationStatuses).toEqual({ o1: 'approved' });
    expect(profile?.application).toEqual({ status: 'pending', organisation: 'Museum', submittedAt: '2026-10-01T11:00:00Z' });
    expect(profile?.deletion).toEqual({ requestedAt: '2026-10-03T10:00:00Z', deleteAfter: '2026-11-02T10:00:00Z', byAdministrator: true });
  });
  it('has no deletion or request when there is none', () => {
    const profile = parseProfile({ ...base, deletion: null, application: null, organisations: [] });
    expect(profile).toMatchObject({ deletion: null, application: null, deletionPending: false, organisations: [] });
  });
  it('is null for no account or an answer without an id', () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ email: 'x' })).toBeNull();
  });
});

describe('superadmin copy', () => {
  it('has the same keys in English, Romanian and German, none empty', () => {
    const keys = Object.keys(getSuperadminCopy('en')).sort();
    for (const locale of locales) {
      const copy = getSuperadminCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(keys);
      for (const value of Object.values(copy)) expect(value.trim()).not.toBe('');
    }
  });
  it('keeps the same {placeholders} in every language', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    const english = getSuperadminCopy('en');
    for (const locale of locales) {
      const copy = getSuperadminCopy(locale);
      for (const key of Object.keys(english) as (keyof typeof english)[]) expect(placeholders(copy[key]), `${locale}.${key}`).toBe(placeholders(english[key]));
    }
  });
  it('fills the counts', () => {
    expect(fill(getSuperadminCopy('en').deletionsCount, { n: '3', due: '1' })).toBe('3 in progress, 1 due');
  });
});
