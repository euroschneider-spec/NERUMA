import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { getVerificationCopy } from '@/lib/verification';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { closeProblemReport } from '@/app/admin/actions';
import { problemReportsReady, verificationReady } from '@/lib/verification-server';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { authConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problem reports · NERUMA', robots: { index: false, follow: false } };
type Report = { id: string; organization_id: string; place_id: string | null; reporter_email: string; locale: string; message: string; status: 'open' | 'closed'; created_at: string };
export default async function ProblemReports({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ closed?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !authConfigured()) notFound();
  const t = getWorkspaceCopy(locale);
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  if (!await verificationReady(supabase)) notFound();
  const admin = await supabase.rpc('is_platform_admin');
  if (admin.error || admin.data !== true) notFound();
  const base = `/${locale}/admin/reports`;
  const nav = (
    <nav aria-label={t.reportsAdmin} className="button-row">
      <Link className="quiet-link" href={base}>{t.reportsOpen}</Link>
      <Link className="quiet-link" href={`${base}?closed=1`}>{t.reportsHistory}</Link>
      <Link className="quiet-link" href={`/${locale}/admin/organisations`}>{getVerificationCopy(locale).admin}</Link>
    </nav>
  );
  if (!await problemReportsReady(supabase)) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.reportsAdmin}</h1></div>{nav}<p className="notice">{t.reportsUnavailable}</p></main>;
  const showClosed = (await searchParams).closed === '1';
  const reports = await supabase.from('problem_reports').select('*').eq('status', showClosed ? 'closed' : 'open').order('created_at', { ascending: !showClosed }).limit(100);
  const organisations = await supabase.from('organizations').select('id,name').limit(100);
  const places = await supabase.from('place_translations').select('place_id,name,locale').limit(100);
  if (reports.error || organisations.error || places.error) return <main id="main-content" className="container verification-page"><p role="alert">{getOrganisationCopy(locale).authError}</p></main>;
  const orgName = new Map((organisations.data || []).map((o) => [o.id as string, o.name as string]));
  const placeNames = new Map<string, string>();
  for (const row of (places.data || []) as { place_id: string; name: string; locale: string }[]) if (!placeNames.has(row.place_id) || row.locale === locale) placeNames.set(row.place_id, row.name);
  const rows = (reports.data || []) as Report[];
  return (
    <main id="main-content" className="container verification-page">
      <div className="page-heading"><h1>{t.reportsAdmin}</h1></div>
      <div className="content-body">
        {nav}
        {!rows.length && <p className="notice">{showClosed ? t.reportsClosedEmpty : t.reportsEmpty}</p>}
        {rows.map((report) => (
          <section key={report.id} className="verification-request" aria-labelledby={`report-${report.id}`}>
            <h2 id={`report-${report.id}`}>{orgName.get(report.organization_id) || report.organization_id}</h2>
            <dl className="verification-details">
              <dt>{t.reportFrom}</dt><dd><a href={`mailto:${report.reporter_email}`}>{report.reporter_email}</a></dd>
              {report.place_id && <><dt>{t.reportAbout}</dt><dd>{placeNames.get(report.place_id) || report.place_id}</dd></>}
              <dt>{t.reportSent}</dt><dd>{new Date(report.created_at).toLocaleString(locale, { timeZone: 'Europe/Berlin' })}</dd>
            </dl>
            <p className="report-message">{report.message}</p>
            {report.status === 'open' && (
              <form action={closeProblemReport.bind(null, locale)} className="button-row">
                <input type="hidden" name="report" value={report.id} />
                <button type="submit" className="button button-outline button-small">{t.reportClose}</button>
              </form>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
