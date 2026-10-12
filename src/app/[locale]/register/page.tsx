import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { verificationReady } from '@/lib/verification-server';
import { getVerificationCopy } from '@/lib/verification';
import { OrganisationForm } from '@/components/organisation-form';
import { ResponsibilityNotice } from '@/components/responsibility-notice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation registration', robots: { index: false, follow: false } };
export default async function Register({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const t = getOrganisationCopy(locale);
  const v = getVerificationCopy(locale);
  const enabled=authConfigured() && await verificationReady(await createClient());
  return <main id="main-content" className="container">
    <div className="page-heading"><p className="eyebrow">NERUMA</p><h1>{v.request}</h1><p className="lead">{v.intro}</p></div>
    <div className="content-body form-column"><ResponsibilityNotice locale={locale}/>
      {authConfigured() && !enabled && <p className="notice" role="status">{v.setup}</p>}
      <OrganisationForm locale={locale} mode="register" enabled={enabled}/>
      <div className="button-row"><Link className="quiet-link" href={`/${locale}/login`}>{t.login}</Link><Link className="quiet-link" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></div>
    </div>
  </main>;
}
