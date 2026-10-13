'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { landingPath } from '@/lib/roles';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient, type SupabaseClient } from '@/lib/supabase/server';
import { getTwoFactorCopy, secondFactorCode } from '@/lib/two-factor';
import { getViewer } from '@/lib/viewer-server';
import { uuidPattern } from '@/lib/workspace';

export type TwoFactorState = { message: string; done?: boolean; factor?: string; qr?: string; secret?: string };

const wrongCode = (code: string | undefined) => code === 'mfa_verification_failed' || code === 'mfa_challenge_expired';

async function verifyCode(supabase: SupabaseClient, factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? (wrongCode(error.code) ? 'wrong' : 'error') : null;
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
    const viewer = await getViewer(supabase, user.id);
    if (viewer) destination = landingPath(viewer, locale);
  } catch {
    return { message: t.error };
  }
  redirect(destination);
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
    if (!await confirmedUser(supabase)) return { message: t.error };
    if (factorId) {
      if (!uuidPattern.test(factorId)) return { message: t.error };
      const code = secondFactorCode(String(form.get('code') || ''));
      if (!code) return { ...previous, message: t.invalid };
      const failure = await verifyCode(supabase, factorId, code);
      if (failure) return { ...previous, message: failure === 'wrong' ? t.wrong : t.error };
      revalidatePath(`/${locale}/account`);
      return { message: t.on, done: true };
    }
    // An earlier setup that was never confirmed would block a new one with the same name.
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) return { message: t.error };
    if (factors.data.totp.length) return { message: t.on, done: true };
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
