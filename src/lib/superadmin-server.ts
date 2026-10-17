import 'server-only';
import { notFound, redirect } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { requireSecondFactor } from '@/lib/two-factor-server';
import { verificationReady } from '@/lib/verification-server';

// The gate for every page of the administration area: signed in, second factor done, platform administrator. Anyone else gets
// a plain 404, so the area does not announce itself. The database refuses the same people again on every call.
export async function requireAdministrator(locale: Locale) {
  if (!authConfigured()) notFound();
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  if (!await verificationReady(supabase)) notFound();
  await requireSecondFactor(supabase, locale);
  const admin = await supabase.rpc('is_platform_admin');
  if (admin.error || admin.data !== true) notFound();
  return { supabase, user };
}
