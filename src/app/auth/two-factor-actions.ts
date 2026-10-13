'use server';

import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { landingPath } from '@/lib/roles';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient, type SupabaseClient } from '@/lib/supabase/server';
import { backupCode, getTwoFactorCopy, secondFactorCode } from '@/lib/two-factor';
import { newBackupCodes } from '@/lib/two-factor-server';
import { getViewer } from '@/lib/viewer-server';
import { uuidPattern } from '@/lib/workspace';

export type TwoFactorState = { message: string; done?: boolean; factor?: string; qr?: string; secret?: string; codes?: string[]; next?: string };

const wrongCode = (code: string | undefined) => code === 'mfa_verification_failed' || code === 'mfa_challenge_expired';

async function verifyCode(supabase: SupabaseClient, factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? (wrongCode(error.code) ? 'wrong' : 'error') : null;
}

// The account's usual start page, once the session has passed.
async function startPage(supabase: SupabaseClient, userId: string, locale: Parameters<typeof landingPath>[1]) {
  const viewer = await getViewer(supabase, userId);
  return viewer ? landingPath(viewer, locale) : `/${locale}/account`;
}

/** The code step after the password. Success moves the session to aal2 and opens the account's usual start page. */
export async function verifySecondFactor(locale: string, _previous: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getTwoFactorCopy(locale);
  if (!authConfigured()) return { message: t.error };
  const code = secondFactorCode(String(form.get('code') || ''));
  if (!code) return { message: t.invalid };
  let destination = `/${locale}/account`;
  try {
    const supabase = await createClient();
    const user = await confirmedUser(supabase);
    if (!user) return { message: t.error };
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp[0];
    if (factors.error || !factor) return { message: t.error };
    const failure = await verifyCode(supabase, factor.id, code);
    if (failure) return { message: failure === 'wrong' ? t.wrong : t.error };
    destination = await startPage(supabase, user.id, locale);
  } catch {
    return { message: t.error };
  }
  redirect(destination);
}

/** Instead of the app's code: one backup code, which Supabase accepts once and which also moves the session to aal2. */
export async function verifyBackupCode(locale: string, _previous: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getTwoFactorCopy(locale);
  if (!authConfigured()) return { message: t.error };
  const code = backupCode(String(form.get('code') || ''));
  if (!code) return { message: t.backupWrong };
  let destination = `/${locale}/account`;
  try {
    const supabase = await createClient();
    const user = await confirmedUser(supabase);
    if (!user) return { message: t.error };
    const { error } = await supabase.auth.mfa.recoveryCodes.verify({ code });
    if (error) {
      if (error.code === 'mfa_recovery_codes_locked') return { message: t.backupLocked };
      return { message: error.code === 'mfa_verification_failed' ? t.backupWrong : t.error };
    }
    destination = await startPage(supabase, user.id, locale);
  } catch {
    return { message: t.error };
  }
  redirect(destination);
}

/** Backup codes on the account page: the first set, or a new set that replaces the old one. Shown once, never stored by us. */
export async function makeBackupCodes(locale: string, _previous: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getTwoFactorCopy(locale);
  if (!authConfigured()) return { message: t.error };
  try {
    const supabase = await createClient();
    if (!await confirmedUser(supabase)) return { message: t.error };
    const codes = await newBackupCodes(supabase, form.get('replace') === '1');
    return codes ? { message: '', codes, next: `/${locale}/account` } : { message: t.error };
  } catch {
    return { message: t.error };
  }
}

/**
 * Setup on the account page, in two submissions: the first creates a new authenticator entry and returns its QR code
 * and key; the second confirms it with a code from the app, which also moves this session to aal2.
 */
export async function setUpTwoFactor(locale: string, previous: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getTwoFactorCopy(locale);
  if (!authConfigured()) return { message: t.error };
  const factorId = String(form.get('factor') || '');
  try {
    const supabase = await createClient();
    const user = await confirmedUser(supabase);
    if (!user) return { message: t.error };
    if (factorId) {
      if (!uuidPattern.test(factorId)) return { message: t.error };
      const code = secondFactorCode(String(form.get('code') || ''));
      if (!code) return { ...previous, message: t.invalid };
      const failure = await verifyCode(supabase, factorId, code);
      if (failure) return { ...previous, message: failure === 'wrong' ? t.wrong : t.error };
      // The session is at aal2 now, which Supabase requires for backup codes. The page isn't refreshed here, so the
      // codes stay on screen until the person continues.
      const codes = await newBackupCodes(supabase, false);
      return { message: t.on, done: true, codes: codes ?? undefined, next: await startPage(supabase, user.id, locale) };
    }
    // An earlier setup that was never confirmed would block a new one with the same name.
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) return { message: t.error };
    if (factors.data.totp.length) return { message: t.on, done: true, next: `/${locale}/account` };
    for (const unconfirmed of factors.data.all.filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified')) {
      await supabase.auth.mfa.unenroll({ factorId: unconfirmed.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NERUMA', issuer: 'NERUMA' });
    if (error || data.type !== 'totp') return { message: t.error };
    return { message: '', factor: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
  } catch {
    return { message: t.error };
  }
}
