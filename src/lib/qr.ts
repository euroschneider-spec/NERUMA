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

/**
 * The address a printed code opens. VIANORAE_SITE_URL, when set, is the only answer, so a code made from a preview or an old
 * address still carries the site's own; without it (local runs, previews) the address the code was asked for on.
 */
export function qrOrigin(requestUrl: URL, configured: string | undefined): string {
  if (configured && /^https?:\/\//.test(configured)) {
    try {
      return new URL(configured).origin;
    } catch {
      return requestUrl.origin;
    }
  }
  return requestUrl.origin;
}
