'use server';

import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getResetCopy, MAX_PASSWORD, passwordProblem, tokenHashPattern, validEmail } from '@/lib/password-reset';
import { clearResetCookie, currentPasswordIsRight, hasResetCookie, setResetCookie } from '@/lib/password-reset-server';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { secondFactorCode } from '@/lib/two-factor';
import { forgetThisBrowser, getTwoFactorStatus, verifyTotp } from '@/lib/two-factor-server';
import { rememberDeviceReady } from '@/lib/verification-server';

export type ResetState = { message: string; sent?: boolean };

/**
 * Asks Supabase to email a reset link. The answer is the same for an address with an account, one without, and any error except a rate
 * limit, so this page can't be used to find out who has an account. The link itself is built by the email template (supabase/templates/recovery.html).
 */
export async function requestPasswordReset(locale: string, _previous: ResetState, form: FormData): Promise<ResetState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getResetCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const email = String(form.get('email') || '').trim();
  if (!validEmail(email)) return { message: t.error };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error && ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '')) return { message: t.rate };
  } catch { /* The same answer: nothing here says whether the address has an account. */ }
  return { message: t.sent, sent: true };
}

/**
 * The button on the page the email link opens. Only here is the one-time token used, never when the page is opened: a mail program that
 * opens links to check them would use it up. Success signs the person in for the new-password page only (see the cookie).
 */
export async function startPasswordReset(locale: string, tokenHash: string) {
  if (!isLocale(locale) || !authConfigured()) redirect('/');
  let ok = false;
  if (tokenHashPattern.test(tokenHash)) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
      if (!error) {
        await setResetCookie();
        ok = true;
      }
    } catch { /* An expired or used link looks like any other failure. */ }
  }
  redirect(ok ? `/${locale}/account/password` : `/${locale}/login/reset?link=expired`);
}

/**
 * Saves the new password for a session that came from a reset link. An account with two-factor gives its code first (Supabase refuses the change
 * without it). On success the person is signed out everywhere, remembered devices are forgotten, and sign-in says what happened.
 */
export async function setNewPassword(locale: string, _previous: ResetState, form: FormData): Promise<ResetState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getResetCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const password = String(form.get('password') || '');
  const problem = passwordProblem(password, String(form.get('repeat') || ''));
  if (problem) return { message: t[problem] };
  try {
    const supabase = await createClient();
    if (!await confirmedUser(supabase) || !await hasResetCookie()) return { message: t.error };
    const status = await getTwoFactorStatus(supabase);
    if (!status) return { message: t.error };
    if (status.enrolled && !status.passed) {
      const code = secondFactorCode(String(form.get('code') || ''));
      if (!code) return { message: t.wrongCode };
      const failure = await verifyTotp(supabase, code);
      if (failure) return { message: failure === 'wrong' ? t.wrongCode : t.error };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { message: error.code === 'same_password' ? t.same : error.code === 'weak_password' ? t.short : t.error };
    // From here the password is changed. What follows only tidies up, and the person signs in again whatever happens to it.
    try {
      if (await rememberDeviceReady(supabase)) await supabase.rpc('forget_devices', {});
      await forgetThisBrowser();
      await supabase.auth.signOut({ scope: 'global' });
    } catch { /* The new password works either way. */ }
  } catch {
    return { message: t.error };
  }
  await clearResetCookie();
  redirect(`/${locale}/login?password=changed`);
}

/**
 * A signed-in person changes their password from the account page (brief docs/briefs/2026-10-18-change-password.md). The current password is checked
 * without touching the person's session, and an account with two-factor gives its code too. The person stays
 * signed in here; every other device is signed out and remembered devices are forgotten.
 */
export async function changePassword(locale: string, _previous: ResetState, form: FormData): Promise<ResetState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getResetCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const current = String(form.get('current') || '');
  const password = String(form.get('password') || '');
  const problem = passwordProblem(password, String(form.get('repeat') || ''));
  if (problem) return { message: t[problem] };
  if (!current || current.length > MAX_PASSWORD) return { message: t.wrongPassword };
  try {
    const supabase = await createClient();
    const user = await confirmedUser(supabase);
    if (!user?.email) return { message: t.error };
    const status = await getTwoFactorStatus(supabase);
    if (!status) return { message: t.error };
    if (!await currentPasswordIsRight(user.email, current)) return { message: t.wrongPassword };
    if (status.enrolled) {
      // Supabase also refuses the change without a second-factor session; the code is asked for again so a left-open window can't change it.
      const code = secondFactorCode(String(form.get('code') || ''));
      if (!code) return { message: t.wrongCode };
      const failure = await verifyTotp(supabase, code);
      if (failure) return { message: failure === 'wrong' ? t.wrongCode : t.error };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { message: error.code === 'same_password' ? t.same : error.code === 'weak_password' ? t.short : t.error };
    // From here the password is changed. What follows only tidies up.
    try {
      if (await rememberDeviceReady(supabase)) await supabase.rpc('forget_devices', {});
      await forgetThisBrowser();
      await supabase.auth.signOut({ scope: 'others' });
    } catch { /* The new password works either way. */ }
    return { message: t.changedHere, sent: true };
  } catch {
    return { message: t.error };
  }
}
