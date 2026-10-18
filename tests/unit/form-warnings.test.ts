import { describe, expect, it } from 'vitest';
import { getWarningCopy, warningFor, type CheckedField } from '@/lib/form-warnings';
import { locales } from '@/lib/i18n';

const field = (over: Partial<CheckedField> & { problem?: keyof CheckedField['validity'] } = {}): CheckedField => {
  const { problem, ...rest } = over;
  return {
    name: 'organisation', type: 'text', minLength: 12,
    validity: { valueMissing: false, tooShort: false, typeMismatch: false, patternMismatch: false, badInput: false, ...(problem ? { [problem]: true } : {}) },
    ...rest,
  };
};

describe('warningFor', () => {
  const copy = getWarningCopy('en');
  it('names the field that is missing', () => {
    expect(warningFor(field({ problem: 'valueMissing' }), 'Organisation name', copy)).toBe('Fill in “Organisation name”.');
  });
  it('asks for a tick instead of naming a long sentence', () => {
    expect(warningFor(field({ problem: 'valueMissing', type: 'checkbox', name: 'authority' }), 'I confirm a very long sentence', copy)).toBe('Tick this box to continue.');
  });
  it('says how many characters are needed', () => {
    expect(warningFor(field({ problem: 'tooShort' }), 'Password', copy)).toBe('Use at least 12 characters.');
  });
  it('says what format a field wants, and falls back to a general sentence for a field without one', () => {
    expect(warningFor(field({ problem: 'typeMismatch', name: 'email' }), 'Email', copy)).toBe(copy.format.email);
    expect(warningFor(field({ problem: 'patternMismatch', name: 'website' }), 'Website', copy)).toBe(copy.format.website);
    expect(warningFor(field({ problem: 'patternMismatch', name: 'something-else' }), 'Other', copy)).toBe(copy.invalid);
  });
});

describe('warning copy', () => {
  it('has every text in all three languages, none empty, with the same placeholders', () => {
    const english = getWarningCopy('en');
    for (const locale of locales) {
      const copy = getWarningCopy(locale);
      expect(Object.keys(copy.format).sort(), locale).toEqual(Object.keys(english.format).sort());
      for (const key of ['missing', 'tick', 'tooShort', 'invalid'] as const) {
        expect(copy[key].trim(), `${locale}.${key}`).not.toBe('');
        expect(copy[key].match(/\{\w+\}/g) ?? [], `${locale}.${key}`).toEqual(english[key].match(/\{\w+\}/g) ?? []);
      }
      for (const [name, text] of Object.entries(copy.format)) expect(text.trim(), `${locale}.format.${name}`).not.toBe('');
    }
  });
});
