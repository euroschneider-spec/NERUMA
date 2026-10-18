import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getResetCopy, tokenHashPattern } from '@/lib/password-reset';
import { startPasswordReset } from '@/app/auth/password-actions';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getResetCopy(isLocale(locale) ? locale : 'en').continueTitle, robots: { index: false, follow: false } };
}

/**
 * The page the emailed link opens. It only shows a button: the one-time token is used when the button is pressed, not when the page loads,
 * so a mail program that opens links to check them can't use the link up.
 */
export default async function ResetContinue({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token_hash?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { token_hash: token } = await searchParams;
  if (!token || !tokenHashPattern.test(token)) notFound();
  const t = getResetCopy(locale);
  return (
    <main id="main-content" className="container">
      <div className="page-heading">
        <p className="eyebrow">NERUMA</p>
        <h1>{t.continueTitle}</h1>
        <p className="lead">{t.continueIntro}</p>
      </div>
      <div className="content-body">
        <form action={startPasswordReset.bind(null, locale, token)}>
          <button className="button" type="submit">{t.continueButton}</button>
        </form>
      </div>
    </main>
  );
}
