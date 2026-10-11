import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { problemReportsReady } from '@/lib/verification-server';
import { listPlaces, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { ProblemReportForm } from '@/components/problem-report-form';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return { title: t.reportProblem, robots: { index: false, follow: false } };
}
export default async function ReportProblem({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ org?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getWorkspaceCopy(locale);
  const context = await workspaceSession(locale);
  const { org: chosen } = await searchParams;
  const organisation = chosen ? context.organisations.find((o) => o.id === chosen) : context.organisations[0];
  if (!organisation || !workspaceConfigured() || !await problemReportsReady(context.supabase)) notFound();
  const places = await listPlaces(context.supabase, organisation.id, locale);
  const back = `/${locale}/workspace${context.organisations.length > 1 ? `?org=${organisation.id}` : ''}`;
  return (
    <main id="main-content" className="app-main">
      <div className="app-heading">
        <div>
          <h1>{t.reportHeading}</h1>
          <p className="lead">{t.reportIntro}</p>
        </div>
        <Link className="quiet-link" href={back}>{t.reportBack}</Link>
      </div>
      <ProblemReportForm org={organisation.id} locale={locale} places={places.map((place) => ({ id: place.id, name: place.name }))} backHref={back} />
    </main>
  );
}
