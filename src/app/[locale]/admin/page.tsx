import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { fill } from '@/lib/account-deletion';
import { getDeletionCopy } from '@/lib/account-deletion';
import { getSuperadminCopy, parseOverview } from '@/lib/superadmin';
import { requireAdministrator } from '@/lib/superadmin-server';
import { superadminReady } from '@/lib/verification-server';
import { getVerificationCopy } from '@/lib/verification';
import { getWorkspaceCopy } from '@/lib/workspace';
import { AdminNav } from '@/components/admin-nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration · NERUMA', robots: { index: false, follow: false } };

export default async function Administration({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getSuperadminCopy(locale);
  const { supabase } = await requireAdministrator(locale);
  const head = <div className="page-heading"><h1>{t.title}</h1><p className="lead">{t.intro}</p></div>;
  if (!await superadminReady(supabase)) {
    return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p className="notice notice-warning">{t.unavailable}</p></div></main>;
  }
  const overview = parseOverview((await supabase.rpc('admin_overview')).data);
  if (!overview) return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p role="alert">{t.error}</p></div></main>;
  const waiting = [
    { path: 'organisations', title: getVerificationCopy(locale).admin, line: fill(t.requestsCount, { n: String(overview.pendingRequests) }) },
    { path: 'reports', title: getWorkspaceCopy(locale).reportsAdmin, line: fill(t.reportsCount, { n: String(overview.openReports) }) },
    { path: 'deletions', title: getDeletionCopy(locale).adminTitle, line: fill(t.deletionsCount, { n: String(overview.deletionsInProgress), due: String(overview.deletionsDue) }) },
  ];
  const people = [
    { path: 'accounts', title: t.accounts, line: fill(t.accountsCount, { n: String(overview.accounts) }) },
    { path: 'administrators', title: t.administrators, line: fill(t.administratorsCount, { n: String(overview.administrators) }) },
  ];
  const section = (id: string, heading: string, items: typeof waiting) => (
    <section aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      <ul className="deletion-list">
        {items.map((item) => (
          <li key={item.path} className="verification-request">
            <h3><Link href={`/${locale}/admin/${item.path}`}>{item.title}</Link></h3>
            <p><strong>{item.line}</strong></p>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <main id="main-content" className="container verification-page">
      {head}
      <div className="content-body">
        <AdminNav locale={locale} />
        {section('admin-waiting', t.waiting, waiting)}
        {section('admin-people', t.people, people)}
      </div>
    </main>
  );
}
