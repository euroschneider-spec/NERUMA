import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Locale } from './i18n';
import type { SupabaseClient } from './supabase/server';
import { deviceTokenPattern, parseRememberedDevices, parseTwoFactorStatus, twoFactorStep, type BackupCodes, type RememberedDevice, type TwoFactorStatus } from './two-factor';
import { rememberDeviceReady, twoFactorReady } from './verification-server';

// Before the migration nothing is required, and the database doesn't ask for a second factor either.
const notInstalled: TwoFactorStatus = { enrolled: false, required: false, deadline: null, passed: true, canRemember: false };

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

// The remembered-device token. httpOnly, so page scripts never see it; strictly necessary for what the person asked for, so
// it needs no consent (TECH-TASKS §3), but the privacy page should list it.
const deviceCookie = 'neruma_device';
const thirtyDays = 30 * 24 * 60 * 60;

/** After the code: remembers this browser for 30 days. False when the account can't, or the database isn't ready. */
export async function rememberThisDevice(supabase: SupabaseClient): Promise<boolean> {
  if (!await rememberDeviceReady(supabase)) return false;
  const { data, error } = await supabase.rpc('remember_device');
  if (error || typeof data !== 'string' || !deviceTokenPattern.test(data)) return false;
  (await cookies()).set(deviceCookie, data, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: thirtyDays });
  return true;
}

/** After the password: lets this session through when the browser holds a valid token. A token that no longer works is dropped. */
export async function trustRememberedDevice(supabase: SupabaseClient): Promise<boolean> {
  const store = await cookies();
  const token = store.get(deviceCookie)?.value;
  if (!token) return false;
  if (!deviceTokenPattern.test(token) || !await rememberDeviceReady(supabase)) {
    store.delete(deviceCookie);
    return false;
  }
  const { data, error } = await supabase.rpc('trust_this_session', { device_token: token });
  if (error || data !== true) {
    store.delete(deviceCookie);
    return false;
  }
  return true;
}

/** The account's remembered devices, or null when the option doesn't exist yet or the database couldn't answer. */
export async function getRememberedDevices(supabase: SupabaseClient): Promise<RememberedDevice[] | null> {
  if (!await rememberDeviceReady(supabase)) return null;
  const { data, error } = await supabase.rpc('remembered_devices');
  return error ? null : parseRememberedDevices(data);
}

export async function forgetThisBrowser() {
  (await cookies()).delete(deviceCookie);
}
