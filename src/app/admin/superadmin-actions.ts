'use server';

import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getSuperadminCopy } from '@/lib/superadmin';
import { uuidPattern } from '@/lib/workspace';
import { superadminReady } from '@/lib/verification-server';

export type AdministratorState = { message: string; ok?: boolean };

// Every action here is also refused by the database for anyone but a platform administrator with the second factor.
async function administrator() {
  if (!authConfigured()) return null;
  const supabase = await createClient();
  if (!await confirmedUser(supabase) || !await superadminReady(supabase)) return null;
  const admin = await supabase.rpc('is_platform_admin');
  return admin.error || admin.data !== true ? null : supabase;
}

export async function addAdministrator(locale: string, _previous: AdministratorState, form: FormData): Promise<AdministratorState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getSuperadminCopy(locale);
  const email = String(form.get('email') || '').trim();
  if (!email || email.length > 254 || !email.includes('@')) return { message: t.noAccount };
  try {
    const supabase = await administrator();
    if (!supabase) return { message: t.addError };
    const added = await supabase.rpc('add_platform_admin', { p_email: email });
    if (added.error) return { message: added.error.code === '22023' ? t.noAccount : t.addError };
    revalidatePath(`/${locale}/admin`);
    revalidatePath(`/${locale}/admin/administrators`);
    return { ok: true, message: added.data === true ? t.added : t.alreadyAdmin };
  } catch {
    return { message: t.addError };
  }
}

export async function removeAdministrator(locale: string, form: FormData): Promise<void> {
  const user = String(form.get('user') || '');
  if (!isLocale(locale) || !uuidPattern.test(user)) return;
  try {
    const supabase = await administrator();
    if (supabase) await supabase.rpc('remove_platform_admin', { p_user: user });
  } catch {
    // The list still shows the administrator.
  }
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/admin/administrators`);
}
