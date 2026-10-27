'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { exploreListingReady } from '@/lib/verification-server';
import { uuidPattern } from '@/lib/workspace';

// A platform administrator switches Explore on or off for one organisation (brief 2026-10-27). The database refuses anyone else,
// with or without these checks, and writes the switch to the organisation's change log.
export async function setOrganisationExplore(locale: string, form: FormData): Promise<void> {
  const org = String(form.get('organisation') || '');
  const account = String(form.get('account') || '');
  const enabled = form.get('enabled') === 'true';
  if (!isLocale(locale) || !uuidPattern.test(org) || !uuidPattern.test(account)) redirect('/');
  let saved = false;
  try {
    if (authConfigured()) {
      const supabase = await createClient();
      const admin = await confirmedUser(supabase) && await exploreListingReady(supabase) ? await supabase.rpc('is_platform_admin') : null;
      saved = !!admin && !admin.error && admin.data === true && !(await supabase.rpc('set_organisation_explore', { org, p_enabled: enabled })).error;
    }
  } catch {
    saved = false;
  }
  if (saved) for (const code of ['en', 'ro', 'de']) revalidatePath(`/${code}/explore`);
  redirect(`/${locale}/admin/accounts/${account}${saved ? '' : '?explore=error'}`);
}
