'use server';

import { randomUUID } from 'node:crypto';
import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { deletionDay, EXPORT_LINK_DAYS, getDeletionCopy } from '@/lib/account-deletion';
import { buildExport } from '@/lib/account-deletion-server';
import { secondFactorCode } from '@/lib/two-factor';
import { accountDeletionReady } from '@/lib/verification-server';

export type DeleteAccountState = { message: string; done?: boolean; link?: string; deleteAfter?: string };

/**
 * The person deletes their own account (docs/briefs/2026-10-13-delete-account.md). In this order, so a failure leaves nothing
 * locked: sign in again with the password (and the two-factor code), build the export and keep it behind a private 7-day link,
 * and only then lock the account. The database refuses the lock without that fresh sign-in.
 */
export async function deleteMyAccount(locale: string, _previous: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  if (!isLocale(locale)) return { message: 'Invalid language.' };
  const t = getDeletionCopy(locale);
  if (!authConfigured()) return { message: t.unavailable };
  const password = String(form.get('password') || '');
  if (form.get('understand') !== 'on') return { message: t.mustConfirm };
  if (!password || password.length > 128) return { message: t.wrongPassword };
  try {
    const supabase = await createClient();
    const user = await confirmedUser(supabase);
    if (!user?.email || !await accountDeletionReady(supabase)) return { message: t.unavailable };
    const signedIn = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (signedIn.error) return { message: t.wrongPassword };
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) return { message: t.error };
    const factor = factors.data.totp[0];
    if (factor) {
      const code = secondFactorCode(String(form.get('code') || ''));
      if (!code) return { message: t.codeNeeded };
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verified.error) return { message: t.wrongCode };
    }
    const requestedAt = new Date();
    const archive = await buildExport(supabase, locale, { deletion: { requestedAt: requestedAt.toISOString(), deleteAfter: deletionDay(requestedAt).toISOString() } });
    if (!archive) return { message: t.error };
    const key = `${user.id}/${randomUUID()}.zip`;
    const exports = supabase.storage.from('vianorae-account-exports');
    const uploaded = await exports.upload(key, archive, { contentType: 'application/zip', upsert: false });
    if (uploaded.error) return { message: t.error };
    const signed = await exports.createSignedUrl(key, EXPORT_LINK_DAYS * 86400, { download: 'neruma-data.zip' });
    if (signed.error || !signed.data?.signedUrl) return { message: t.error };
    const locked = await supabase.rpc('request_account_deletion');
    if (locked.error) return { message: t.error };
    const deleteAfter = String((locked.data as { delete_after?: string } | null)?.delete_after || deletionDay(requestedAt).toISOString());
    // No sign-out here: the page would re-render as signed out and lose the link. The account can do nothing any more (sign-in
    // and token refresh are refused, and the database refuses every right), and every page now says it is locked.
    return { message: '', done: true, link: signed.data.signedUrl, deleteAfter };
  } catch {
    return { message: t.error };
  }
}
