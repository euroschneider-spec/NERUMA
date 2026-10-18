import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// "This session came from a password-reset link" (brief docs/briefs/2026-10-18-password-reset.md). The new-password page needs it, so a
// normal signed-in session can't change the password without the current one. httpOnly, 15 minutes, listed on the privacy page.
const resetCookie = 'neruma_reset';
const fifteenMinutes = 15 * 60;

export async function setResetCookie() {
  (await cookies()).set(resetCookie, '1', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: fifteenMinutes });
}
export async function hasResetCookie() {
  return (await cookies()).get(resetCookie)?.value === '1';
}
export async function clearResetCookie() {
  (await cookies()).delete(resetCookie);
}

/**
 * Whether this is the account's current password. Signs in with a client that keeps nothing, so the person's own session (and its
 * two-factor level) is left as it is; the extra session this opens is closed again at once.
 */
export async function currentPasswordIsRight(email: string, password: string) {
  const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return true;
}
