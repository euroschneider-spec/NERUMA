import { describe, expect, it } from 'vitest';
import { getExploreListingCopy } from '@/lib/explore-listing';
import { locales } from '@/lib/i18n';
import { getVisitCopy, parseChangeLog } from '@/lib/platform-visit';
import { parseProfile } from '@/lib/superadmin';

describe('the words of the Explore feature', () => {
  it('exist in every language, with the organisation name where it is needed', () => {
    const english = getExploreListingCopy('en');
    for (const locale of locales) {
      const copy = getExploreListingCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(copy)) {
        expect(value.trim(), `${locale} ${key}`).not.toBe('');
        expect(value.includes('{name}'), `${locale} ${key}`).toBe(english[key as keyof typeof english].includes('{name}'));
      }
    }
  });
  it('are in the change log too: both switches and the entry they are about', () => {
    for (const locale of locales) {
      const copy = getVisitCopy(locale);
      expect(copy.actions.enable).not.toBe('');
      expect(copy.actions.disable).not.toBe('');
      expect(copy.entities.explore).toBeTruthy();
    }
  });
});

describe('the change log entries of the two switches', () => {
  const row = { id: 7, at: '2026-10-27T09:00:00Z', entity: 'explore', place_id: null, place_name: null, changes: {}, by: null };
  it('are read, with no changed fields and no administrator', () => {
    expect(parseChangeLog([{ ...row, action: 'enable' }, { ...row, id: 8, action: 'disable' }])).toEqual([
      { id: 7, at: '2026-10-27T09:00:00Z', entity: 'explore', placeName: '', action: 'enable', by: null, changes: [] },
      { id: 8, at: '2026-10-27T09:00:00Z', entity: 'explore', placeName: '', action: 'disable', by: null, changes: [] },
    ]);
  });
  it('still refuse an action nobody knows', () => {
    expect(parseChangeLog([{ ...row, action: 'rename' }])).toBeNull();
  });
});

describe('the account page knows whether Explore is on for each organisation', () => {
  const base = { user_id: 'u1', email: 'a@example.test', created_at: '2026-10-01T10:00:00Z', confirmed: true, is_admin: false, two_factor: true, deletion: null, application: null };
  it('reads it per organisation', () => {
    const profile = parseProfile({ ...base, organisations: [{ id: 'o1', name: 'A', role: 'owner', status: 'approved', explore: true }, { id: 'o2', name: 'B', role: 'owner', status: 'approved', explore: false }] });
    expect(profile?.organisationExplore).toEqual({ o1: true, o2: false });
  });
  it('knows nothing before the migration, so no switch is offered', () => {
    expect(parseProfile({ ...base, organisations: [{ id: 'o1', name: 'A', role: 'owner', status: 'approved' }] })?.organisationExplore).toEqual({});
  });
});
