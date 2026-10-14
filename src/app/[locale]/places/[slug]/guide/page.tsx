import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuestGuide } from '@/components/guest-guide';
import { getCopy, isLocale, localeNames, longDate } from '@/lib/i18n';
import { fill, getPublishingCopy, guideFromPublished, slugPattern } from '@/lib/publishing';
import { getPublishedGuide } from '@/lib/published-server';

// The example guide keeps its address; every other address is a published guide, read fresh on each visit.
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return { title: 'Guide' };
  if (slug === 'willow-museum') return { title: getCopy(locale).guide };
  const guide = slugPattern.test(slug) ? await getPublishedGuide(slug, locale) : null;
  if (guide?.status === 'published') return { title: guide.content.name };
  return { title: getPublishingCopy(locale).unavailableTitle, robots: { index: false, follow: false } };
}
export default async function PlaceGuide({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (slug === 'willow-museum') {
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
  const guide = slugPattern.test(slug) ? await getPublishedGuide(slug, locale) : null;
  if (!guide) notFound();
  const t = getPublishingCopy(locale);
  // A guide that is down never says what it was.
  if (guide.status === 'unavailable') return (
    <main id="main-content" className="container">
      <div className="page-heading"><h1>{t.unavailableTitle}</h1><p className="lead">{t.unavailableBody}</p></div>
      <p><Link className="button" href={`/${locale}`}>{t.backHome}</Link></p>
    </main>
  );
  const { content } = guide;
  const published = guideFromPublished(content);
  const date = guide.publishedAt ? longDate(guide.publishedAt, locale) : '';
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">{t.guideEyebrow}</p>
        <h1>{content.name}</h1>
        {[content.description, [content.address, content.city].filter(Boolean).join(', ')].filter(Boolean).map((line) => <p key={line} className="lead">{line}</p>)}
        {guide.locale !== locale && <p className="notice" lang={locale}>{fill(t.otherLanguage, { language: localeNames[guide.locale] })}</p>}
        {guide.locales.length > 1 && <p className="small-note">{t.alsoIn} {guide.locales.filter((other) => other !== locale).map((other, i) =>
          <span key={other}>{i > 0 && ' · '}<Link href={`/${other}/places/${slug}/guide`} hrefLang={other} lang={other}>{localeNames[other]}</Link></span>)}</p>}
      </div>
      <div className="guide-frame">
        <div className="guide-device" lang={guide.locale}>
          <GuestGuide locale={guide.locale} published={published} publishedOn={date} />
        </div>
      </div>
    </main>
  );
}
