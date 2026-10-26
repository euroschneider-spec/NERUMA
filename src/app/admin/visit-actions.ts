'use server';

import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { uuidPattern } from '@/lib/workspace';
import { platformVisitReady } from '@/lib/verification-server';

// A platform administrator's visit to an organisation (brief 2026-10-26). The database refuses anyone else, with or without these checks.
async function administrator() {
  if (!authConfigured()) return null;
  const supabase = await createClient();
  if (!await confirmedUser(supabase) || !await platformVisitReady(supabase)) return null;
  const admin = await supabase.rpc('is_platform_admin');
  return admin.error || admin.data !== true ? null : supabase;
}

export async function startVisit(locale: string, form: FormData): Promise<void> {
  const org = String(form.get('organisation') || '');
  if (!isLocale(locale) || !uuidPattern.test(org)) redirect('/');
  let started = false;
  try {
    const supabase = await administrator();
    started = !!supabase && !(await supabase.rpc('start_organisation_visit', { org })).error;
  } catch {
    started = false;
  }
  redirect(started ? `/${locale}/workspace?org=${org}` : `/${locale}/admin/accounts?visit=error`);
}

export async function endVisit(locale: string): Promise<void> {
  if (!isLocale(locale)) redirect('/');
  try {
    const supabase = await administrator();
    if (supabase) await supabase.rpc('end_organisation_visit');
  } catch {
    // The visit ends by itself after eight hours.
  }
  redirect(`/${locale}/admin/accounts`);
}
