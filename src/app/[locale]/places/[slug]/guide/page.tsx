import { notFound } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { GuestGuide } from '@/components/guest-guide';

// The one example guide. Real places get the same address shape once publishing exists.
export function generateStaticParams() { return [{ slug: 'willow-museum' }]; }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: isLocale(locale) ? getCopy(locale).guide : 'Guide' };
}
export default async function PlaceGuide({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || slug !== 'willow-museum') notFound();
  const t = getCopy(locale);
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">{t.guideEyebrow}</p>
        <h1>{t.guideTitle}</h1>
        <p className="lead">{t.guideIntro}</p>
      </div>
      {/* Framed at phone width on larger screens; on phones the frame is dropped and the guide uses the page. */}
      <div className="guide-frame">
        <div className="guide-device">
          <GuestGuide locale={locale} />
        </div>
      </div>
    </main>
  );
}
