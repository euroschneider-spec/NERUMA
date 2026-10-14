import { isLocale } from '@/lib/i18n';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { buildExport } from '@/lib/account-deletion-server';
import { getTwoFactorStatus } from '@/lib/two-factor-server';
import { uuidPattern } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const refuse = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

/** A platform administrator downloads everything held about one person, to send it to them (until there is an email provider). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get('user') || '';
  const asked = url.searchParams.get('locale') || 'en';
  const locale = isLocale(asked) ? asked : 'en';
  if (!authConfigured() || !uuidPattern.test(user)) return refuse(404);
  const supabase = await createClient();
  if (!await confirmedUser(supabase)) return refuse(401);
  const status = await getTwoFactorStatus(supabase);
  const admin = await supabase.rpc('is_platform_admin');
  if (!status?.passed || admin.error || admin.data !== true) return refuse(403);
  const archive = await buildExport(supabase, locale, { user });
  if (!archive) return refuse(404);
  return new Response(archive, { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="neruma-data-${user.slice(0, 8)}.zip"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
