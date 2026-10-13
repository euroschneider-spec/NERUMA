import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getPublishingCopy } from '@/lib/publishing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getPublishingCopy(isLocale(locale) ? locale : 'en').unavailableTitle, robots: { index: false, follow: false } };
}

/** Where a QR code leads while its guide is taken down. It never says which location it was. */
export default async function GuideUnavailable({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getPublishingCopy(locale);
  return <main id="main-content" className="container">
    <div className="page-heading"><h1>{t.unavailableTitle}</h1><p className="lead">{t.unavailableBody}</p></div>
    <p><Link className="button" href={`/${locale}`}>{t.backHome}</Link></p>
  </main>;
}
