import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getVerificationCopy } from '@/lib/verification';
import { getSuperadminCopy } from '@/lib/superadmin';
import { getWorkspaceCopy } from '@/lib/workspace';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { accountDeletionReady, verificationReady } from '@/lib/verification-server';
import { requireSecondFactor } from '@/lib/two-factor-server';
import { fill, getDeletionCopy, longDate, parseOrganisationHolds, parsePendingDeletions } from '@/lib/account-deletion';
import { eraseAccount, eraseOrganisation, restoreAccount } from '@/app/admin/deletion-actions';
import { ConfirmForm } from '@/components/confirm-form';
import { StartDeletionForm } from '@/components/start-deletion-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account deletions · NERUMA', robots: { index: false, follow: false } };

export default async function AccountDeletions({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !authConfigured()) notFound();
  const t = getDeletionCopy(locale);
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  if (!await verificationReady(supabase)) notFound();
  await requireSecondFactor(supabase, locale);
  const admin = await supabase.rpc('is_platform_admin');
  if (admin.error || admin.data !== true) notFound();
  const nav = (
    <nav aria-label={t.adminTitle} className="button-row">
      <Link className="quiet-link" href={`/${locale}/admin`}>{getSuperadminCopy(locale).dashboard}</Link>
      <Link className="quiet-link" href={`/${locale}/admin/organisations`}>{getVerificationCopy(locale).admin}</Link>
      <Link className="quiet-link" href={`/${locale}/admin/reports`}>{getWorkspaceCopy(locale).reportsAdmin}</Link>
      <Link className="quiet-link" href={`/${locale}/account`}>{getOrganisationCopy(locale).account}</Link>
    </nav>
  );
  if (!await accountDeletionReady(supabase)) {
    return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.adminTitle}</h1></div><div className="content-body">{nav}<p className="notice">{t.unavailable}</p></div></main>;
  }
  const [pendingResult, holdsResult] = await Promise.all([supabase.rpc('account_deletions'), supabase.rpc('organisation_holds')]);
  if (pendingResult.error || holdsResult.error) return <main id="main-content" className="container verification-page"><p role="alert">{t.adminError}</p></main>;
  const pending = parsePendingDeletions(pendingResult.data);
  const holds = parseOrganisationHolds(holdsResult.data);
  const restore = restoreAccount.bind(null, locale);
  const erase = eraseAccount.bind(null, locale);
  const eraseOrg = eraseOrganisation.bind(null, locale);
  return (
    <main id="main-content" className="container verification-page">
      <div className="page-heading">
        <h1>{t.adminTitle}</h1>
        <p className="lead">{t.adminIntro}</p>
      </div>
      <div className="content-body">
        {nav}
        <section aria-labelledby="deletions-pending">
          <h2 id="deletions-pending">{t.pending}</h2>
          {!pending.length && <p className="note">{t.none}</p>}
          <ul className="deletion-list">
            {pending.map((entry) => (
              <li key={entry.userId} className="verification-request">
                <h3>{entry.email}</h3>
                <p>{fill(t.requested, { date: longDate(entry.requestedAt, locale) })} · {entry.byAdministrator ? t.byAdmin : t.bySelf}</p>
                <p><strong>{entry.due ? t.dueNow : fill(t.dueOn, { date: longDate(entry.deleteAfter, locale) })}</strong></p>
                {entry.organisations.length > 0 && <p>{fill(t.alsoHeld, { names: entry.organisations.map((org) => org.name).join(', ') })}</p>}
                <div className="button-row">
                  <a className="quiet-link" href={`/api/admin/export?user=${entry.userId}&locale=${locale}`} download>{t.downloadTheirs}</a>
                  {entry.due ? (
                    <ConfirmForm action={erase} fields={{ user: entry.userId }} label={t.erase} title={t.eraseTitle} body={t.eraseBody} confirm={t.erase} cancel={t.cancel} />
                  ) : (
                    <ConfirmForm action={restore} fields={{ user: entry.userId }} label={t.restoreButton} title={t.restoreTitle} body={t.restoreBody} confirm={t.restoreButton} cancel={t.cancel} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="deletions-holds">
          <h2 id="deletions-holds">{t.holds}</h2>
          {!holds.length && <p className="note">{t.holdsNone}</p>}
          <ul className="deletion-list">
            {holds.map((hold) => (
              <li key={hold.id} className="verification-request">
                <h3>{hold.name}</h3>
                {hold.formerOwnerEmail && <p>{fill(t.formerOwner, { email: hold.formerOwnerEmail })}</p>}
                {hold.erasedAt ? (
                  <p>{fill(t.erasedOn, { date: longDate(hold.erasedAt, locale) })}</p>
                ) : (
                  <>
                    <p><strong>{hold.due ? t.dueNow : fill(t.dueOn, { date: longDate(hold.deleteAfter, locale) })}</strong></p>
                    {hold.due && <ConfirmForm action={eraseOrg} fields={{ organisation: hold.id }} label={t.eraseOrganisation} title={t.eraseOrganisationTitle} body={t.eraseOrganisationBody} confirm={t.eraseOrganisation} cancel={t.cancel} />}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="deletions-start">
          <h2 id="deletions-start">{t.start}</h2>
          <StartDeletionForm locale={locale} />
        </section>
      </div>
    </main>
  );
}
