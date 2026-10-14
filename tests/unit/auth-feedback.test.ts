import { describe, it, expect } from 'vitest';
import { authErrorMessage, getAuthFeedback } from '@/lib/auth-feedback';
import { locales } from '@/lib/i18n';

// What a person reads when Supabase Auth refuses something. A wrong message sends them to the wrong fix
// (a weak password is not an email problem), and a raw error code must never reach the page.
describe.each(locales)('authErrorMessage (%s)', (locale) => {
  const t = getAuthFeedback(locale);
  const message = (code?: string, login = false) => authErrorMessage(locale, code, login);

  it('says plainly when the email service is rate-limited', () => {
    expect(message('over_email_send_rate_limit')).toBe(t.rate);
    expect(message('over_request_rate_limit', true)).toBe(t.rate);
  });
  it('explains an address that Supabase’s test email service cannot reach', () => {
    expect(message('email_address_not_authorized')).toBe(t.unauthorized);
  });
  it('asks for email confirmation when sign-in is refused for that reason', () => {
    expect(message('email_not_confirmed', true)).toBe(t.unconfirmed);
  });
  it('tells a person with a weak or breached password to choose another, not that the email failed', () => {
    for (const code of ['weak_password']) {
      expect(message(code)).toBe(t.weakPassword);
      expect(message(code)).not.toBe(t.emailError);
    }
  });
  it('tells a person when registration is switched off in the project, not that the email failed', () => {
    expect(message('signup_disabled')).toBe(t.signupOff);
    expect(message('email_provider_disabled')).toBe(t.signupOff);
  });
  it('gives the sign-in message for any other sign-in failure, and never echoes the code', () => {
    for (const code of [undefined, 'invalid_credentials', 'unexpected_failure', '<script>alert(1)</script>']) {
      expect(message(code, true)).toBe(t.loginError);
      expect(message(code, true)).not.toContain('invalid_credentials');
    }
  });
  it('does not reveal whether an account exists: wrong password and unknown email read the same', () => {
    expect(message('invalid_credentials', true)).toBe(message('user_not_found', true));
  });
  it('gives the generic message for any other registration failure', () => {
    for (const code of [undefined, 'unexpected_failure', 'user_already_exists']) expect(message(code)).toBe(t.emailError);
  });
  it('has every message text', () => {
    for (const value of Object.values(t)) expect(String(value).trim().length).toBeGreaterThan(0);
  });
});
