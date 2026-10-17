import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { fill } from '@/lib/account-deletion';
import { ACCOUNTS_PER_PAGE, getSuperadminCopy, longDate, parseAccounts } from '@/lib/superadmin';
import { requireAdministrator } from '@/lib/superadmin-server';
import { superadminReady } from '@/lib/verification-server';
import { AdminNav } from '@/components/admin-nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts · NERUMA', robots: { index: false, follow: false } };

export default async function Accounts({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { q = '', page: pageParam = '1' } = await searchParams;
  const search = q.trim().slice(0, 254);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(pageParam)) || 1));
  const t = getSuperadminCopy(locale);
  const { supabase } = await requireAdministrator(locale);
  const head = <div className="page-heading"><h1>{t.accounts}</h1></div>;
  if (!await superadminReady(supabase)) {
    return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p className="notice notice-warning">{t.unavailable}</p></div></main>;
  }
  const result = parseAccounts((await supabase.rpc('admin_accounts', { p_search: search || null, p_limit: ACCOUNTS_PER_PAGE, p_offset: (page - 1) * ACCOUNTS_PER_PAGE })).data);
  if (!result) return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p role="alert">{t.error}</p></div></main>;
  const pages = Math.max(1, Math.ceil(result.total / ACCOUNTS_PER_PAGE));
  const link = (target: number) => `/${locale}/admin/accounts?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(target) })}`;
  return (
    <main id="main-content" className="container verification-page">
      {head}
      <div className="content-body">
        <AdminNav locale={locale} />
        <form method="get" role="search" className="organisation-form">
          <div className="form-field">
            <label htmlFor="account-search">{t.search}</label>
            <input id="account-search" type="search" name="q" defaultValue={search} maxLength={254} autoComplete="off" />
          </div>
          <div className="button-row">
            <button className="button" type="submit">{t.searchButton}</button>
            {search && <Link className="quiet-link" href={`/${locale}/admin/accounts`}>{t.clear}</Link>}
          </div>
        </form>
        <p role="status">{fill(t.results, { n: String(result.total) })}</p>
        {!result.rows.length && <p className="note">{t.none}</p>}
        <ul className="deletion-list">
          {result.rows.map((row) => (
            <li key={row.userId} className="verification-request">
              <h2>{row.email}</h2>
              <p>
                {[
                  row.isAdmin && t.adminBadge,
                  row.twoFactor ? t.twoFactorOn : t.twoFactorOff,
                  !row.confirmed && t.notConfirmed,
                  row.deletionPending && t.deletionPending,
                ].filter(Boolean).join(' · ')}
              </p>
              <p>{fill(t.created, { date: longDate(row.createdAt, locale) })} · {row.lastSignInAt ? fill(t.lastSignIn, { date: longDate(row.lastSignInAt, locale) }) : t.never}</p>
              <p>{row.organisations.length ? row.organisations.map((org) => `${org.name} (${org.role})`).join(', ') : t.noOrganisation}</p>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <nav aria-label={fill(t.page, { page: String(page), pages: String(pages) })} className="button-row">
            {page > 1 && <Link className="quiet-link" href={link(page - 1)}>{t.previous}</Link>}
            <span>{fill(t.page, { page: String(page), pages: String(pages) })}</span>
            {page < pages && <Link className="quiet-link" href={link(page + 1)}>{t.next}</Link>}
          </nav>
        )}
      </div>
    </main>
  );
}
