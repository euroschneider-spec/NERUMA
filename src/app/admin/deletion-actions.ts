'use server';

import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient, type SupabaseClient } from '@/lib/supabase/server';
import { fill, getDeletionCopy, longDate } from '@/lib/account-deletion';
import { uuidPattern } from '@/lib/workspace';
import { accountDeletionReady } from '@/lib/verification-server';

export type AdminDeletionState = { message: string; ok?: boolean };

// Every action here is also refused by the database for anyone but a platform administrator with the second factor.
async function administrator() {
  if (!authConfigured()) return null;
  const supabase = await createClient();
  if (!await confirmedUser(supabase) || !await accountDeletionReady(supabase)) return null;
  const admin = await supabase.rpc('is_platform_admin');
  return admin.error || admin.data !== true ? null : supabase;
}

// Files go first, through the Storage API (deleting a storage row in SQL would leave the file behind). The erase itself refuses to
// run while any remain, so a partial failure stops before the database is touched.
async function removeFiles(supabase: SupabaseClient, rpc: 'account_erasure_files' | 'organisation_erasure_files', args: Record<string, string>) {
  const listed = await supabase.rpc(rpc, args);
  if (listed.error || !Array.isArray(listed.data)) return false;
  const byBucket = new Map<string, string[]>();
  for (const file of listed.data as { bucket: string; key: string }[]) byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.key]);
  for (const [bucket, keys] of byBucket) {
    const removed = await supabase.storage.from(bucket).remove(keys);
    if (removed.error) return false;
  }
  return true;
}

const done = (locale: string) => {
  revalidatePath(`/${locale}/admin/deletions`);
  revalidatePath(`/${locale}/admin/reports`);
};

export async function startDeletionFor(locale: string, _previous: AdminDeletionState, form: FormData): Promise<AdminDeletionState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getDeletionCopy(locale);
  const email = String(form.get('email') || '').trim();
  if (!email || email.length > 254 || !email.includes('@')) return { message: t.noAccount };
  try {
    const supabase = await administrator();
    if (!supabase) return { message: t.adminError };
    const started = await supabase.rpc('request_account_deletion_for', { p_email: email });
    if (started.error) return { message: started.error.code === '22023' ? t.noAccount : t.adminError };
    done(locale);
    return { ok: true, message: fill(t.started, { date: longDate(String((started.data as { delete_after: string }).delete_after), locale) }) };
  } catch {
    return { message: t.adminError };
  }
}

export async function restoreAccount(locale: string, form: FormData): Promise<void> {
  const user = String(form.get('user') || '');
  if (!isLocale(locale) || !uuidPattern.test(user)) return;
  try {
    const supabase = await administrator();
    if (supabase) await supabase.rpc('restore_account', { p_user: user });
  } catch {
    // The list still shows the account as in progress.
  }
  done(locale);
}

export async function eraseAccount(locale: string, form: FormData): Promise<void> {
  const user = String(form.get('user') || '');
  if (!isLocale(locale) || !uuidPattern.test(user)) return;
  try {
    const supabase = await administrator();
    if (supabase && await removeFiles(supabase, 'account_erasure_files', { p_user: user })) await supabase.rpc('erase_account', { p_user: user });
  } catch {
    // The list still shows the account; erasing again picks up where it stopped.
  }
  done(locale);
}

export async function eraseOrganisation(locale: string, form: FormData): Promise<void> {
  const org = String(form.get('organisation') || '');
  if (!isLocale(locale) || !uuidPattern.test(org)) return;
  try {
    const supabase = await administrator();
    if (supabase && await removeFiles(supabase, 'organisation_erasure_files', { p_org: org })) await supabase.rpc('erase_held_organisation', { p_org: org });
  } catch {
    // As above.
  }
  done(locale);
}

export async function deleteProblemReport(locale: string, form: FormData): Promise<void> {
  const report = String(form.get('report') || '');
  if (!isLocale(locale) || !uuidPattern.test(report)) return;
  try {
    const supabase = await administrator();
    if (supabase) await supabase.rpc('delete_problem_report', { p_report: report });
  } catch {
    // The report stays in the list.
  }
  done(locale);
}
