import 'server-only';
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
