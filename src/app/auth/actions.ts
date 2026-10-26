'use server';

import { getAuthFeedback, authErrorMessage } from '@/lib/auth-feedback';
import { redirect } from 'next/navigation';
import { siteOrigin } from '@/lib/request-guards';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { applicationFromForm, getVerificationCopy } from '@/lib/verification';
import { uuidPattern } from '@/lib/workspace';
import { getEvidenceCopy } from '@/lib/mandate-evidence';
import { evidenceReady, verificationReady } from '@/lib/verification-server';
import { landingPath } from '@/lib/roles';
import { validEmail } from '@/lib/password-reset';
import { getViewer } from '@/lib/viewer-server';
import { currentVisit } from '@/lib/workspace-server';
import { twoFactorStep } from '@/lib/two-factor';
import { getTwoFactorStatus, trustRememberedDevice, twoFactorPath } from '@/lib/two-factor-server';

export type AuthState = { message: string; confirmation?:boolean };
const text = (form: FormData, key: string) => String(form.get(key) || '').trim();

// Where confirmation links point. Supabase's redirect allow-list still has to accept the result.
async function confirmationCallback(locale: string): Promise<string | null> {
  const origin = await siteOrigin();
  return origin ? `${origin}/auth/callback?locale=${locale}` : null;
}

export async function authenticate(locale: string, mode: 'register' | 'login', _previous: AuthState, form: FormData): Promise<AuthState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getOrganisationCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const email = text(form, 'email');
  const password = String(form.get('password') || '');
  if (!validEmail(email) || password.length > 128
    || password.length < (mode === 'register' ? 12 : 1)) return { message: t.invalidFields };
  const application = mode === 'register' ? applicationFromForm(form,locale) : null;
  if (mode === 'register' && !application) return {message:t.invalidFields};

  let signedIn = false;let loginError=t.authError;let destination=`/${locale}/account`;
  try {
    const supabase = await createClient();
    if (mode === 'register' && application) {
      if (!await verificationReady(supabase)) return {message:getVerificationCopy(locale).setup};
      const emailRedirectTo = await confirmationCallback(locale);
      if (!emailRedirectTo) return { message: t.authError };
      const { error } = await supabase.auth.signUp({ email, password, options: {
        emailRedirectTo,
        // These are editable profile suggestions only. They never grant roles or tenancy.
        data: { preferred_locale:locale, display_name: application.representative, organisation_name: application.organisation, organisation_type: application.type, verification_suggestion: application },
      } });
      return error ? {message:authErrorMessage(locale,error.code)} : {message:getAuthFeedback(locale).received,confirmation:true};
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    signedIn = !error;loginError=authErrorMessage(locale,error?.code,true);
    // Each tier starts where its work is. The destination is a convenience only; every
    // page behind it re-checks the role itself.
    // An account with an authenticator app, or one that must set it up, goes there first.
    if (signedIn && data.user) {
      let twoFactor = await getTwoFactorStatus(supabase);
      // A remembered device stands in for the code on this one session.
      if (twoFactor && twoFactorStep(twoFactor) === 'verify' && await trustRememberedDevice(supabase)) twoFactor = await getTwoFactorStatus(supabase);
      const step = twoFactor && twoFactorStep(twoFactor);
      const viewer = twoFactor && !step ? await getViewer(supabase, data.user.id) : null;
      if (step) destination = twoFactorPath(step, locale);
      else if (viewer) destination = landingPath(viewer, locale);
    }
  } catch { return { message: t.authError }; }
  if (signedIn) redirect(destination);
  return { message: loginError };
}

export async function onboardOrganisation(locale: string, _previous: AuthState, form: FormData): Promise<AuthState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getOrganisationCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const application=applicationFromForm(form,locale);
  const revision=Number(text(form,'revision')) || null;
  if (!application || (revision!==null && (!Number.isSafeInteger(revision) || revision<1))) return {message:t.invalidFields};
  try {
    const supabase = await createClient();
    if (!await confirmedUser(supabase)) return { message: t.authError };
    if (!await verificationReady(supabase)) return {message:getVerificationCopy(locale).setup};
    if(!await evidenceReady(supabase)) return {message:getEvidenceCopy(locale).setup};
    const documents=form.getAll('document').map(String);
    if(documents.length<1 || documents.length>3 || !documents.every(id=>uuidPattern.test(id)) || new Set(documents).size!==documents.length) return {message:getEvidenceCopy(locale).required};
    const result = await supabase.rpc('submit_organization_application', {application:{...application,documents},expected_revision:revision});
    if (result.error) return { message: result.error.code==='40001' ? getAuthFeedback(locale).stale : getAuthFeedback(locale).requestError };
  } catch { return { message: getAuthFeedback(locale).requestError }; }
  redirect(`/${locale}/account`);
}

export async function signOut(locale: string) {
  if (!isLocale(locale)) return;
  if (authConfigured()) {
    const supabase = await createClient();
    // A platform administrator's visit ends with their session (brief 2026-10-26); anyone else has no visit and nothing happens.
    try {
      if (await currentVisit(supabase)) await supabase.rpc('end_organisation_visit');
    } catch {
      // The visit still ends by itself after eight hours.
    }
    await supabase.auth.signOut();
  }
  redirect(`/${locale}/login`);
}

export async function resendConfirmation(locale:string,_previous:AuthState,form:FormData):Promise<AuthState> {
 if(!isLocale(locale)) return {message:'Invalid language.'};
 const t=getOrganisationCopy(locale);if(!authConfigured()) return {message:t.unavailable};
 const email=text(form,'email');if(!validEmail(email)) return {message:t.invalidFields};
 try {
  const emailRedirectTo=await confirmationCallback(locale);if(!emailRedirectTo) return {message:getAuthFeedback(locale).emailError};
  const supabase=await createClient();const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo}});
  return {message:error?authErrorMessage(locale,error.code):getAuthFeedback(locale).resent,confirmation:!error};
 } catch {return {message:getAuthFeedback(locale).emailError};}
}
