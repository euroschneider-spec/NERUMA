import { describe, it, expect } from 'vitest';
import { exampleLocales, isExampleQrCode, requestedLocale } from '@/lib/qr';
import { chooseLocale } from '@/lib/publishing';

describe('QR codes', () => {
  it('knows the example code and no other without the database', () => {
    expect(isExampleQrCode('willow-museum')).toBe(true);
    expect(isExampleQrCode('other')).toBe(false);
    expect(exampleLocales).toEqual(['en', 'ro', 'de']);
  });
  it('asks for a language only when the address names a supported one', () => {
    expect(requestedLocale(new URL('https://x.test/q/a'))).toBeNull();
    expect(requestedLocale(new URL('https://x.test/q/a?locale=fr'))).toBeNull();
    expect(requestedLocale(new URL('https://x.test/q/a?locale=ro'))).toBe('ro');
  });
});

describe('the language a scan opens in', () => {
  it('uses the one asked for when it is published', () => {
    expect(chooseLocale(['en', 'ro'], 'ro', 'de')).toBe('ro');
  });
  it('follows the phone languages in order of preference, among the published ones', () => {
    expect(chooseLocale(['en', 'ro'], null, 'de-DE,ro;q=0.8,en;q=0.5')).toBe('ro');
    expect(chooseLocale(['en', 'de'], null, 'de-AT,de;q=0.9')).toBe('de');
    expect(chooseLocale(['en', 'ro', 'de'], null, 'en-GB;q=0.4,ro;q=0.9')).toBe('ro');
  });
  it('falls back to the first published language when none matches, or the asked one is not published', () => {
    expect(chooseLocale(['ro', 'de'], null, 'fr-FR,fr;q=0.9')).toBe('ro');
    expect(chooseLocale(['ro', 'de'], 'en', null)).toBe('ro');
    expect(chooseLocale(['de'], null, 'ro')).toBe('de');
  });
  it('ignores languages the visitor refused (q=0) and unsupported tags', () => {
    expect(chooseLocale(['en', 'ro'], null, 'ro;q=0,en')).toBe('en');
    expect(chooseLocale(['ro', 'en'], null, '*')).toBe('ro');
  });
});
