import { describe, expect, it } from 'vitest';
import { getArchiveCopy } from '@/lib/archive-places';
import { locales } from '@/lib/i18n';

describe('the words of archiving a location', () => {
  it('exist in every language, with the location name where it is needed', () => {
    const english = getArchiveCopy('en');
    for (const locale of locales) {
      const copy = getArchiveCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(copy)) {
        expect(value.trim(), `${locale} ${key}`).not.toBe('');
        expect(value.includes('{name}'), `${locale} ${key}`).toBe(english[key as keyof typeof english].includes('{name}'));
      }
    }
  });
  it('keep the visible button word inside its accessible name (WCAG 2.5.3)', () => {
    for (const locale of locales) {
      const copy = getArchiveCopy(locale);
      expect(copy.archiveAria.toLowerCase()).toContain(copy.archive.toLowerCase());
      expect(copy.restoreAria.toLowerCase()).toContain(copy.restore.toLowerCase());
    }
  });
});
