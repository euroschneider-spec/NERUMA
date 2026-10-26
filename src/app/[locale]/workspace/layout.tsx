import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCopy, isLocale, longDate } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { paymentsReady, platformVisitReady, problemReportsReady } from '@/lib/verification-server';
import { getBillingCopy } from '@/lib/billing';
import { stripeConfigured } from '@/lib/stripe-server';
import { workspaceSession } from '@/lib/workspace-server';
import { signOut } from '@/app/auth/actions';
import { OrgSidebar } from '@/components/org-sidebar';
import { getTwoFactorCopy, upcomingDeadline } from '@/lib/two-factor';
import { getVisitCopy } from '@/lib/platform-visit';
import { fill } from '@/lib/publishing';
import { endVisit } from '@/app/admin/visit-actions';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getWorkspaceCopy(locale);
  const context = await workspaceSession(locale);
  // Before the 2026-10-12 migration the button stays hidden, like the field controls before theirs.
  // A platform administrator on a visit reports nothing and has no billing: those belong to the organisation.
  const visit = context.visit;
  const v = getVisitCopy(locale);
  const reportsEnabled = !visit && await problemReportsReady(context.supabase);
  // The change log appears once its migration is installed, for every organisation.
  const logEnabled = await platformVisitReady(context.supabase);
  // Plan & billing appears once Stripe is set up and the payments migration is installed (docs/guides/PAYMENTS.md).
  const billingEnabled = !visit && stripeConfigured() && await paymentsReady(context.supabase);
  // Until two-factor is required for owners and admins, those without it see the date it starts.
  const deadline = upcomingDeadline(context.twoFactor);
  const twoFactor = getTwoFactorCopy(locale);
  const roleLabels = { owner: t.roleOwner, admin: t.roleAdmin };
  const memberships = context.memberships.map((membership) => ({
    organisation: membership.organisation,
    name: membership.name,
    roleLabel: visit?.organisation === membership.organisation ? v.roleLabel : roleLabels[membership.role],
    owner: membership.role === 'owner' && visit?.organisation !== membership.organisation,
  }));
  return (
    <div className={visit ? 'admin-area' : undefined}>
    {visit && (
      <div className="admin-strip" role="region" aria-label={v.stripTitle}>
        <div className="container admin-strip-inner">
          <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <p><strong>{v.stripTitle}</strong> · {fill(v.stripBody, { name: visit.name })}</p>
          <form action={endVisit.bind(null, locale)}>
            <button type="submit" className="button button-small button-outline">{v.leave}</button>
          </form>
        </div>
      </div>
    )}
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{getCopy(locale).skip}</a>
      <OrgSidebar
        locale={locale}
        memberships={memberships}
        copy={{
          dashboard: t.dashboard,
          signOut: getOrganisationCopy(locale).signOut,
          sidebarLabel: t.sidebarLabel,
          collapse: t.collapseSidebar,
          expand: t.expandSidebar,
          reading: getCopy(locale).settings,
          report: reportsEnabled ? t.reportProblem : undefined,
          billing: billingEnabled ? getBillingCopy(locale).title : undefined,
          log: logEnabled ? v.logNav : undefined,
          backToAdmin: visit ? v.backToAdmin : undefined,
        }}
        signOutAction={signOut.bind(null, locale)}
        leaveVisitAction={visit ? endVisit.bind(null, locale) : undefined}
      />
      <div className="app-content">
        {deadline && (
          <p className="notice notice-warning two-factor-banner">
            {twoFactor.banner.replace('{date}', longDate(deadline, locale))}{' '}
            <Link href={`/${locale}/account#two-factor-title`}>{twoFactor.bannerLink}</Link>
          </p>
        )}
        {children}
      </div>
    </div>
    </div>
  );
}
