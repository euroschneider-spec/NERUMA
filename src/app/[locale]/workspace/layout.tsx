import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCopy, isLocale, longDate } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { paymentsReady, problemReportsReady } from '@/lib/verification-server';
import { getBillingCopy } from '@/lib/billing';
import { stripeConfigured } from '@/lib/stripe-server';
import { workspaceSession } from '@/lib/workspace-server';
import { signOut } from '@/app/auth/actions';
import { OrgSidebar } from '@/components/org-sidebar';
import { getTwoFactorCopy, upcomingDeadline } from '@/lib/two-factor';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getWorkspaceCopy(locale);
  const context = await workspaceSession(locale);
  // Before the 2026-10-12 migration the button stays hidden, like the field controls before theirs.
  const reportsEnabled = await problemReportsReady(context.supabase);
  // Plan & billing appears once Stripe is set up and the payments migration is installed (docs/guides/PAYMENTS.md).
  const billingEnabled = stripeConfigured() && await paymentsReady(context.supabase);
  // Until two-factor is required for owners and admins, those without it see the date it starts.
  const deadline = upcomingDeadline(context.twoFactor);
  const twoFactor = getTwoFactorCopy(locale);
  const roleLabels = { owner: t.roleOwner, admin: t.roleAdmin };
  const memberships = context.memberships.map((membership) => ({
    organisation: membership.organisation,
    name: membership.name,
    roleLabel: roleLabels[membership.role],
    owner: membership.role === 'owner',
  }));
  return (
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
        }}
        signOutAction={signOut.bind(null, locale)}
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
  );
}
