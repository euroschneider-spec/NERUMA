import { describe, it, expect } from 'vitest';
import { config } from '@/proxy';
import { locales } from '@/lib/i18n';

// The proxy refreshes the session cookie. A page that reads the session but isn't listed here can't write the refreshed cookie, and the
// person is signed out when the access token expires.
describe('proxy matcher', () => {
  it('covers every page that reads the signed-in session, in every language', () => {
    for (const locale of locales) {
      for (const path of ['account', 'workspace', 'admin']) expect(config.matcher, `${locale}/${path}`).toContain(`/${locale}/${path}/:path*`);
      for (const path of ['login', 'register', 'login/verify']) expect(config.matcher, `${locale}/${path}`).toContain(`/${locale}/${path}`);
    }
  });
});
