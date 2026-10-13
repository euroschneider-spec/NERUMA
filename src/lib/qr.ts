import { isLocale, locales, type Locale } from './i18n';

/** The example guide's own code: it needs no database. Real codes are looked up (`resolve_qr`). */
export const EXAMPLE_QR_CODE = 'willow-museum';
export const isExampleQrCode = (code: string) => code === EXAMPLE_QR_CODE;
export const exampleLocales: Locale[] = [...locales];

/** A locale asked for in the address (`?locale=`), or null: a printed code carries none, the phone decides. */
export function requestedLocale(url: URL): string | null {
  const requested = url.searchParams.get('locale');
  return requested && isLocale(requested) ? requested : null;
}
