import 'server-only';
import { redirect } from 'next/navigation';
import type { Locale } from './i18n';
import type { SupabaseClient } from './supabase/server';
import { parseTwoFactorStatus, twoFactorStep, type BackupCodes, type TwoFactorStatus } from './two-factor';
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

/** The account's backup codes. Anything but a clear answer reads as 'off', so the app shows no backup-code controls. */
export async function getBackupCodes(supabase: SupabaseClient): Promise<BackupCodes> {
  try {
    const { data, error } = await supabase.auth.mfa.recoveryCodes.getStatus();
    if (error) return { state: error.code === 'mfa_factor_not_found' ? 'none' : 'off' };
    return { state: 'some', total: data.total, remaining: data.remaining };
  } catch {
    return { state: 'off' };
  }
}

/** A new set of backup codes for a session that has passed the second factor, or null when Supabase didn't make one. */
export async function newBackupCodes(supabase: SupabaseClient, replace: boolean): Promise<string[] | null> {
  try {
    const { data, error } = replace
      ? await supabase.auth.mfa.recoveryCodes.regenerate()
      : await supabase.auth.mfa.recoveryCodes.generate({ friendlyName: 'NERUMA backup codes' });
    return error ? null : data.codes;
  } catch {
    return null;
  }
}
