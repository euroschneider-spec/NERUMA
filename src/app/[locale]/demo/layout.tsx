import { notFound } from 'next/navigation';
import { OrgSidebar } from '@/components/org-sidebar';
import { DemoStrip } from '@/components/demo-workspace';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { DEMO_ORG } from '@/lib/demo-workspace';
import { getWorkspaceCopy } from '@/lib/workspace';

// The sidebar reads the address; the demo is not worth prerendering around that.
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

/** The same shell a signed-in organisation gets, with a demo organisation and a way out instead of Sign out. */
export default async function DemoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getWorkspaceCopy(locale);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{getCopy(locale).skip}</a>
      <OrgSidebar
        locale={locale}
        base="demo"
        memberships={[{ organisation: DEMO_ORG, name: t.demoOrgName, roleLabel: t.roleOwner }]}
        copy={{
          dashboard: t.dashboard,
          signOut: getOrganisationCopy(locale).signOut,
          sidebarLabel: t.sidebarLabel,
          collapse: t.collapseSidebar,
          expand: t.expandSidebar,
          reading: getCopy(locale).settings,
        }}
        exit={{ href: `/${locale}/for-organisations`, label: t.leaveDemo }}
      />
      <div className="app-content">
        <DemoStrip locale={locale} />
        {children}
      </div>
    </div>
  );
}
