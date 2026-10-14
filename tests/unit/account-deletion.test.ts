import { describe, it, expect } from 'vitest';
import { deletionDay, exportReadme, fill, getDeletionCopy, GRACE_DAYS, longDate, parseOrganisationHolds, parsePendingDeletions } from '@/lib/account-deletion';
import { locales } from '@/lib/i18n';

describe('the 30 days', () => {
  it('ends exactly 30 days after the request', () => {
    const asked = new Date('2026-10-14T10:00:00Z');
    expect(GRACE_DAYS).toBe(30);
    expect(deletionDay(asked).toISOString()).toBe('2026-11-13T10:00:00.000Z');
  });
  it('shows the date the way each language writes it', () => {
    expect(longDate('2026-11-13T10:00:00Z', 'en')).toBe('13 November 2026');
    expect(longDate('2026-11-13T10:00:00Z', 'ro')).toBe('13 noiembrie 2026');
    expect(longDate('2026-11-13T10:00:00Z', 'de')).toBe('13. November 2026');
  });
  it('uses NERUMA’s time zone, so a late-evening request isn’t shown a day early or late', () => {
    expect(longDate('2026-11-12T23:30:00Z', 'en')).toBe('13 November 2026');
  });
});

describe('fill', () => {
  it('puts values into their places and leaves unknown ones visible', () => {
    expect(fill('On {date}, {name}', { date: '1 May', name: 'Ana' })).toBe('On 1 May, Ana');
    expect(fill('On {date}', {})).toBe('On {date}');
  });
});

describe('what the administrator sees', () => {
  it('reads the list of deletions and drops anything malformed', () => {
    const list = parsePendingDeletions([
      { user_id: 'u1', email: 'a@example.test', requested_at: '2026-10-14T10:00:00Z', delete_after: '2026-11-13T10:00:00Z', due: false, by_administrator: true, organisations: [{ id: 'o1', name: 'Museum' }, 'bad'] },
      { email: 'no-id@example.test' },
      null,
    ]);
    expect(list).toEqual([{ userId: 'u1', email: 'a@example.test', requestedAt: '2026-10-14T10:00:00Z', deleteAfter: '2026-11-13T10:00:00Z', due: false, byAdministrator: true, organisations: [{ id: 'o1', name: 'Museum' }] }]);
    expect(parsePendingDeletions('nope')).toEqual([]);
  });
  it('reads the hidden organisations', () => {
    expect(parseOrganisationHolds([{ id: 'o1', name: 'Museum', held_since: 'x', delete_after: 'y', due: true, erased_at: null, former_owner_email: null }]))
      .toEqual([{ id: 'o1', name: 'Museum', heldSince: 'x', deleteAfter: 'y', due: true, erasedAt: null, formerOwnerEmail: null }]);
  });
});

describe('the letter in the export', () => {
  it('names the request date and the deletion date, in the person’s language', () => {
    const letter = exportReadme('de', { requestedAt: '2026-10-14T10:00:00Z', deleteAfter: '2026-11-13T10:00:00Z' }, new Date('2026-10-14T10:00:00Z'));
    expect(letter).toContain('14. Oktober 2026');
    expect(letter).toContain('13. November 2026');
    expect(letter).toContain('data.json');
  });
  it('says nothing about a deletion when there is none', () => {
    expect(exportReadme('en', null)).not.toContain('delete');
  });
});

describe('deletion copy', () => {
  it('has every text in every language, with the same placeholders', () => {
    const english = getDeletionCopy('en');
    for (const locale of locales) {
      const t = getDeletionCopy(locale);
      expect(Object.keys(t).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(t)) {
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        expect([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `${locale}.${key}`).toEqual([...english[key as keyof typeof english].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
      }
    }
  });
});
