import 'server-only';
import { landingPath } from '@/lib/roles';
import type { Locale } from '@/lib/i18n';
import type { SupabaseClient } from '@/lib/supabase/server';
import { twoFactorStep } from '@/lib/two-factor';
import { getTwoFactorStatus, twoFactorPath } from '@/lib/two-factor-server';
import { getViewer } from '@/lib/viewer-server';

// Where a signed-in person starts: the code step first if they owe one, otherwise the tier's own page.
// (The same decision is made when a password is accepted, in auth/actions.ts and two-factor-actions.ts.)
export async function landingFor(supabase: SupabaseClient, userId: string, locale: Locale) {
  const status = await getTwoFactorStatus(supabase);
  const step = status && twoFactorStep(status);
  if (step) return twoFactorPath(step, locale);
  const viewer = status ? await getViewer(supabase, userId) : null;
  return viewer ? landingPath(viewer, locale) : `/${locale}/account`;
}
