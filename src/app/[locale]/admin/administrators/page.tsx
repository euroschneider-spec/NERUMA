import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { fill } from '@/lib/account-deletion';
import { getSuperadminCopy, longDate, parseAccounts } from '@/lib/superadmin';
import { requireAdministrator } from '@/lib/superadmin-server';
import { superadminReady } from '@/lib/verification-server';
import { removeAdministrator } from '@/app/admin/superadmin-actions';
import { AddAdministratorForm } from '@/components/add-administrator-form';
import { AdminNav } from '@/components/admin-nav';
import { ConfirmForm } from '@/components/confirm-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrators · NERUMA', robots: { index: false, follow: false } };

export default async function Administrators({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getSuperadminCopy(locale);
  const { supabase, user } = await requireAdministrator(locale);
  const head = <div className="page-heading"><h1>{t.administrators}</h1><p className="lead">{t.adminsIntro}</p></div>;
  if (!await superadminReady(supabase)) {
    return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p className="notice notice-warning">{t.unavailable}</p></div></main>;
  }
  const result = parseAccounts((await supabase.rpc('admin_accounts', { p_search: null, p_limit: 100, p_offset: 0, p_admins_only: true })).data);
  if (!result) return <main id="main-content" className="container verification-page">{head}<div className="content-body"><AdminNav locale={locale} /><p role="alert">{t.error}</p></div></main>;
  const remove = removeAdministrator.bind(null, locale);
  return (
    <main id="main-content" className="container verification-page">
      {head}
      <div className="content-body">
        <AdminNav locale={locale} />
        <section aria-labelledby="administrators-list">
          <h2 id="administrators-list">{fill(t.administratorsCount, { n: String(result.total) })}</h2>
          <p className="note">{t.removeNote}</p>
          <ul className="deletion-list">
            {result.rows.map((row) => (
              <li key={row.userId} className="verification-request">
                <h3>{row.email}{row.userId === user.id && ` (${t.you})`}</h3>
                <p>{row.twoFactor ? t.twoFactorOn : t.twoFactorOff} · {fill(t.created, { date: longDate(row.createdAt, locale) })}</p>
                {row.userId !== user.id && result.total > 1 && (
                  <ConfirmForm action={remove} fields={{ user: row.userId }} label={t.remove} title={t.removeTitle} body={t.removeBody} confirm={t.remove} cancel={t.cancel} />
                )}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="administrators-add">
          <h2 id="administrators-add">{t.addTitle}</h2>
          <AddAdministratorForm locale={locale} />
        </section>
      </div>
    </main>
  );
}
