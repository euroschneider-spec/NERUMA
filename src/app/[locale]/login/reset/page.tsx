import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getResetCopy } from '@/lib/password-reset';
import { authConfigured } from '@/lib/supabase/config';
import { ResetRequestForm } from '@/components/password-reset-forms';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getResetCopy(isLocale(locale) ? locale : 'en').requestTitle, robots: { index: false, follow: false } };
}

/** Step 1 of a password reset: ask for the link. `?link=expired` comes from a used or expired link. */
export default async function ResetRequest({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ link?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { link } = await searchParams;
  const t = getResetCopy(locale);
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">NERUMA</p>
        <h1>{t.requestTitle}</h1>
        <p className="lead">{t.requestIntro}</p>
      </div>
      <div className="content-body">
        {link === 'expired' && <p className="auth-feedback" role="alert">{t.expired}</p>}
        <ResetRequestForm locale={locale} enabled={authConfigured()} />
        <p><Link href={`/${locale}/login`}>{t.back}</Link></p>
      </div>
    </main>
  );
}
