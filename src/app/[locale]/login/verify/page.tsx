import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { landingPath } from '@/lib/roles';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getTwoFactorCopy, twoFactorStep } from '@/lib/two-factor';
import { getBackupCodes, getTwoFactorStatus, twoFactorPath } from '@/lib/two-factor-server';
import { getViewer } from '@/lib/viewer-server';
import { signOut } from '@/app/auth/actions';
import { BackupCodeVerify, TwoFactorVerify } from '@/components/two-factor-verify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Two-factor sign-in', robots: { index: false, follow: false } };

export default async function VerifySecondFactor({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !authConfigured()) notFound();
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  const status = await getTwoFactorStatus(supabase);
  if (!status) redirect(`/${locale}/login`);
  const step = twoFactorStep(status);
  // Already through, or nothing to enter yet: go where that leads.
  if (step === 'setup') redirect(twoFactorPath(step, locale));
  if (!step) {
    const viewer = await getViewer(supabase, user.id);
    redirect(viewer ? landingPath(viewer, locale) : `/${locale}/account`);
  }
  const t = getTwoFactorCopy(locale);
  const backup = await getBackupCodes(supabase);
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">NERUMA</p>
        <h1>{t.verifyTitle}</h1>
        <p className="lead">{t.verifyIntro}</p>
      </div>
      <div className="content-body">
        <TwoFactorVerify locale={locale} />
        {backup.state === 'some' && backup.remaining > 0 && <BackupCodeVerify locale={locale} />}
        <p>{t.lost}</p>
        <form action={signOut.bind(null, locale)}>
          <button className="text-button" type="submit">{getOrganisationCopy(locale).signOut}</button>
        </form>
      </div>
    </main>
  );
}
