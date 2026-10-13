import 'server-only';
import { redirect } from 'next/navigation';
import type { Locale } from './i18n';
import type { SupabaseClient } from './supabase/server';
import { parseTwoFactorStatus, twoFactorStep, type TwoFactorStatus } from './two-factor';
import { twoFactorReady } from './verification-server';

// Before the migration nothing is required, and the database doesn't ask for a second factor either.
const notInstalled: TwoFactorStatus = { enrolled: false, required: false, deadline: null, passed: true };

/** The signed-in account's two-factor state, or null when the database couldn't answer. */
export async function getTwoFactorStatus(supabase: SupabaseClient): Promise<TwoFactorStatus | null> {
  if (!await twoFactorReady(supabase)) return notInstalled;
  const { data, error } = await supabase.rpc('two_factor_status');
  return error ? null : parseTwoFactorStatus(data);
}

export const twoFactorPath = (step: 'verify' | 'setup', locale: Locale) =>
  step === 'verify' ? `/${locale}/login/verify` : `/${locale}/account`;

/**
 * For pages behind sign-in other than the account page: sends a session that hasn't passed the second factor to the code
 * step or to setup. The database refuses such a session anyway; this only shows the right screen instead of an empty one.
 */
export async function requireSecondFactor(supabase: SupabaseClient, locale: Locale): Promise<TwoFactorStatus> {
  const status = await getTwoFactorStatus(supabase);
  if (!status) redirect(`/${locale}/login`);
  const step = twoFactorStep(status);
  if (step) redirect(twoFactorPath(step, locale));
  return status;
}
