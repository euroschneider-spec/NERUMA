import { describe, expect, it } from 'vitest';
import { formatChangeValue, getVisitCopy, parseChangeLog } from '@/lib/platform-visit';
import { locales } from '@/lib/i18n';

const row = { id: 7, at: '2026-10-26T10:15:00Z', entity: 'zone_translations', place_name: 'Visit museum', action: 'edit', by: null, changes: { title: { from: 'Entrance', to: 'Main entrance' } } };

describe('the change log as the database returns it', () => {
  it('reads an entry with its before and after', () => {
    expect(parseChangeLog([row])).toEqual([{
      id: 7, at: '2026-10-26T10:15:00Z', entity: 'zone_translations', placeName: 'Visit museum', action: 'edit', by: null,
      changes: [{ field: 'title', from: 'Entrance', to: 'Main entrance', hasFrom: true }],
    }]);
  });
  it('knows an added record has no "before"', () => {
    const [entry] = parseChangeLog([{ ...row, action: 'add', changes: { alt_text: { to: { en: 'A door' } } } }])!;
    expect(entry.changes).toEqual([{ field: 'alt_text', from: undefined, to: { en: 'A door' }, hasFrom: false }]);
  });
  it('shows the administrator only when the database gave one', () => {
    expect(parseChangeLog([{ ...row, by: 'support@example.test' }])![0].by).toBe('support@example.test');
    expect(parseChangeLog([{ ...row, by: 5 }])![0].by).toBeNull();
  });
  it('refuses anything that is not a list of entries', () => {
    expect(parseChangeLog(null)).toBeNull();
    expect(parseChangeLog({})).toBeNull();
    expect(parseChangeLog([{ ...row, action: 'delete' }])).toBeNull();
    expect(parseChangeLog([{ ...row, changes: 'x' }])).toBeNull();
    expect(parseChangeLog([{ ...row, id: '7' }])).toBeNull();
    expect(parseChangeLog([])).toEqual([]);
  });
});

describe('a changed value as a person reads it', () => {
  it('shows text as it is, and says "empty" for nothing', () => {
    expect(formatChangeValue('  Main entrance ', '(empty)')).toBe('Main entrance');
    expect(formatChangeValue('', '(empty)')).toBe('(empty)');
    expect(formatChangeValue(null, '(empty)')).toBe('(empty)');
    expect(formatChangeValue(undefined, '(empty)')).toBe('(empty)');
  });
  it('writes a language-by-language object and a list out', () => {
    expect(formatChangeValue({ en: 'A door', ro: 'O ușă' }, '-')).toBe('en: A door; ro: O ușă');
    expect(formatChangeValue(['photo', 'note'], '-')).toBe('photo, note');
    expect(formatChangeValue(false, '-')).toBe('false');
  });
  it('cuts a very long value', () => {
    const shown = formatChangeValue('x'.repeat(1000), '-');
    expect(shown.length).toBe(401);
    expect(shown.endsWith('…')).toBe(true);
  });
});

describe('the words of a visit in every language', () => {
  it('has every label in all three, so nothing falls back to a database name', () => {
    const english = getVisitCopy('en');
    for (const locale of locales) {
      const copy = getVisitCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort());
      expect(Object.keys(copy.fields).sort()).toEqual(Object.keys(english.fields).sort());
      expect(Object.keys(copy.entities).sort()).toEqual(Object.keys(english.entities).sort());
      expect(Object.keys(copy.actions).sort()).toEqual(['add', 'edit', 'take_down']);
      expect(copy.stripBody).toContain('{name}');
    }
  });
});
