import { describe, it, expect } from 'vitest';
import { exampleLocales, isExampleQrCode, qrOrigin, requestedLocale } from '@/lib/qr';
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

describe('the address a printed code opens', () => {
  const asked = new URL('https://preview-abc.vercel.app/api/qr/x');
  it('is the site address when one is configured, whatever address the code was asked for on', () => {
    expect(qrOrigin(asked, 'https://neruma.eu')).toBe('https://neruma.eu');
    expect(qrOrigin(asked, 'https://neruma.eu/some/path')).toBe('https://neruma.eu');
  });
  it('is the address asked for when none is configured, or the setting is not an address', () => {
    expect(qrOrigin(asked, undefined)).toBe('https://preview-abc.vercel.app');
    expect(qrOrigin(asked, '')).toBe('https://preview-abc.vercel.app');
    expect(qrOrigin(asked, 'neruma.eu')).toBe('https://preview-abc.vercel.app');
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
