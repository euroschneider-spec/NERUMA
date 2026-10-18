import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getResetCopy } from '@/lib/password-reset';
import { hasResetCookie } from '@/lib/password-reset-server';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getTwoFactorStatus } from '@/lib/two-factor-server';
import { SetPasswordForm } from '@/components/password-reset-forms';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getResetCopy(isLocale(locale) ? locale : 'en').setTitle, robots: { index: false, follow: false } };
}

/** Step 3 of a password reset. Only reachable straight after a reset link: any other visit goes to the account page. */
export default async function SetPassword({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !authConfigured()) notFound();
  const supabase = await createClient();
  if (!await confirmedUser(supabase)) redirect(`/${locale}/login`);
  if (!await hasResetCookie()) redirect(`/${locale}/account`);
  const status = await getTwoFactorStatus(supabase);
  if (!status) redirect(`/${locale}/login/reset?link=expired`);
  const t = getResetCopy(locale);
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">NERUMA</p>
        <h1>{t.setTitle}</h1>
        <p className="lead">{t.setIntro}</p>
      </div>
      <div className="content-body">
        <SetPasswordForm locale={locale} needsCode={status.enrolled && !status.passed} />
      </div>
    </main>
  );
}
