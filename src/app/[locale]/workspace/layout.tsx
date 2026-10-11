import { notFound } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { problemReportsReady } from '@/lib/verification-server';
import { workspaceSession } from '@/lib/workspace-server';
import { signOut } from '@/app/auth/actions';
import { OrgSidebar } from '@/components/org-sidebar';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getWorkspaceCopy(locale);
  const context = await workspaceSession(locale);
  // Before the 2026-10-12 migration the button stays hidden, like the field controls before theirs.
  const reportsEnabled = await problemReportsReady(context.supabase);
  const roleLabels = { owner: t.roleOwner, admin: t.roleAdmin };
  const memberships = context.memberships.map((membership) => ({
    organisation: membership.organisation,
    name: membership.name,
    roleLabel: roleLabels[membership.role],
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
        }}
        signOutAction={signOut.bind(null, locale)}
      />
      <div className="app-content">{children}</div>
    </div>
  );
}
