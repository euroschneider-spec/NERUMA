import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { fill, getDeletionCopy } from '@/lib/account-deletion';
import { getSuperadminCopy, longDate, parseProfile } from '@/lib/superadmin';
import { requireAdministrator } from '@/lib/superadmin-server';
import { accountProfileReady } from '@/lib/verification-server';
import { getVerificationCopy } from '@/lib/verification';
import { uuidPattern } from '@/lib/workspace';
import { AdminNav } from '@/components/admin-nav';
import { ExploreToggle } from '@/components/explore-toggle';
import { VisitButton } from '@/components/visit-button';
import { getExploreListingCopy } from '@/lib/explore-listing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account · NERUMA', robots: { index: false, follow: false } };

export default async function AccountProfile({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ explore?: string }> }) {
  const { locale, id } = await params;
  const { explore } = await searchParams;
  if (!isLocale(locale) || !uuidPattern.test(id)) notFound();
  const t = getSuperadminCopy(locale);
  const { supabase, user } = await requireAdministrator(locale);
  const shell = (body: React.ReactNode) => (
    <main id="main-content" className="container verification-page">
      <div className="page-heading"><h1>{t.accounts}</h1></div>
      <div className="content-body"><AdminNav locale={locale} />{body}</div>
    </main>
  );
  if (!await accountProfileReady(supabase)) return shell(<p className="notice notice-warning">{t.unavailable}</p>);
  const result = await supabase.rpc('admin_account', { p_user: id });
  if (result.error) return shell(<p role="alert">{t.error}</p>);
  if (result.data === null) notFound();
  const profile = parseProfile(result.data);
  if (!profile) return shell(<p role="alert">{t.error}</p>);
  const v = getVerificationCopy(locale);
  const d = getDeletionCopy(locale);
  const statuses = v.statuses as Record<string, string>;
  const states = [
    profile.isAdmin && t.adminBadge,
    profile.confirmed ? t.confirmedYes : t.notConfirmed,
    profile.twoFactor ? t.twoFactorOn : t.twoFactorOff,
  ].filter(Boolean);
  return (
    <main id="main-content" className="container verification-page">
      <div className="page-heading">
        <p><Link className="quiet-link" href={`/${locale}/admin/accounts`}>{t.backToAccounts}</Link></p>
        <h1 className="account-heading">{profile.email}{profile.userId === user.id && ` (${t.you})`}</h1>
        <p className="lead">{t.viewingAs}</p>
      </div>
      <div className="content-body">
        <AdminNav locale={locale} />
        <section aria-labelledby="profile-status">
          <h2 id="profile-status">{t.profileStatus}</h2>
          <p>{states.join(' · ')}</p>
          <p>{fill(t.created, { date: longDate(profile.createdAt, locale) })} · {profile.lastSignInAt ? fill(t.lastSignIn, { date: longDate(profile.lastSignInAt, locale) }) : t.never}</p>
          {profile.deletion && (
            <p>
              <strong>{t.deletionPending}</strong> · {fill(d.requested, { date: longDate(profile.deletion.requestedAt, locale) })} · {profile.deletion.byAdministrator ? d.byAdmin : d.bySelf} · {new Date(profile.deletion.deleteAfter) <= new Date() ? d.dueNow : fill(d.dueOn, { date: longDate(profile.deletion.deleteAfter, locale) })}
            </p>
          )}
        </section>
        <section aria-labelledby="profile-organisations">
          <h2 id="profile-organisations">{t.organisationsTitle}</h2>
          {explore === 'error' && <p role="alert">{getExploreListingCopy(locale).adminError}</p>}
          {!profile.organisations.length && <p className="note">{t.noOrganisation}</p>}
          <ul className="deletion-list">
            {profile.organisations.map((org) => (
              <li key={org.id} className="verification-request">
                <h3>{org.name}</h3>
                <p>{org.role} · {statuses[profile.organisationStatuses[org.id]] ?? profile.organisationStatuses[org.id]}</p>
                {profile.organisationStatuses[org.id] === 'approved' && org.id in profile.organisationExplore && <ExploreToggle locale={locale} organisation={org.id} account={id} name={org.name} enabled={profile.organisationExplore[org.id]} />}
                {profile.organisationStatuses[org.id] === 'approved' && <VisitButton locale={locale} organisation={org.id} label={t.visit} ariaLabel={fill(t.visitAria, { name: org.name })} />}
              </li>
            ))}
          </ul>
        </section>
        {profile.application && (
          <section aria-labelledby="profile-application">
            <h2 id="profile-application">{t.applicationTitle}</h2>
            <p><strong>{profile.application.organisation}</strong> · {statuses[profile.application.status] ?? profile.application.status}</p>
            <p>{fill(t.submittedOn, { date: longDate(profile.application.submittedAt, locale) })}</p>
          </section>
        )}
      </div>
    </main>
  );
}
