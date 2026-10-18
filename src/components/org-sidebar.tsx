'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CreditCard, LayoutDashboard, LifeBuoy, LogOut, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { ThemeToggle } from './theme-toggle';
import { LanguageMenu } from './language-menu';
import { Brand } from './site-header';
import { ReadingButton } from './reading-settings';

export type SidebarMembership = { organisation: string; name: string; roleLabel: string; owner?: boolean };
export type SidebarCopy = { dashboard: string; signOut: string; sidebarLabel: string; collapse: string; expand: string; reading: string; report?: string; billing?: string };

/** Remembered in this browser only; a convenience, so a missing or blocked storage simply means "open". */
const collapsedKey = 'neruma:sidebar-collapsed';

/**
 * The organisation's own navigation: who and where you are, the way around, language, theme and sign out.
 * The demo uses the same sidebar: `base` is where its pages live, and `exit` replaces Sign out with a plain link.
 */
export function OrgSidebar({ locale, memberships, copy, signOutAction, base = 'workspace', exit }: {
  locale: Locale;
  memberships: SidebarMembership[];
  copy: SidebarCopy;
  signOutAction?: () => Promise<void>;
  base?: string;
  exit?: { href: string; label: string };
}) {
  const path = usePathname();
  const chosen = useSearchParams().get('org');
  const current = memberships.find((membership) => membership.organisation === chosen) ?? memberships[0];
  const home = `/${locale}/${base}`;
  const dashboard = `${home}${memberships.length > 1 ? `?org=${current.organisation}` : ''}`;
  const reportPath = `${home}/report`;
  const reportHref = `${reportPath}${memberships.length > 1 ? `?org=${current.organisation}` : ''}`;
  // Plan & billing is for owners: it shows only for an organisation the person owns.
  const billingPath = `${home}/billing`;
  const billingHref = `${billingPath}${memberships.length > 1 ? `?org=${current.organisation}` : ''}`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // Read after hydration so the server and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(collapsedKey) === '1') setCollapsed(true);
    } catch {
      // Storage blocked: the sidebar stays open.
    }
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(collapsedKey, next ? '1' : '0');
    } catch {
      // Still folds for this visit.
    }
  }
  return (
    <aside className="app-sidebar" aria-label={copy.sidebarLabel} data-collapsed={collapsed}>
      <div className="app-sidebar-top">
        <Link className="brand-link" href={`/${locale}`} aria-label="NERUMA"><Brand /></Link>
        <button type="button" className="app-collapse" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? copy.expand : copy.collapse} data-tip={collapsed ? copy.expand : copy.collapse}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      <div className="app-org">
        <p className="app-org-name">{current.name}</p>
        <p className="app-org-role">{current.roleLabel}</p>
      </div>
      <nav className="app-nav" aria-label={copy.sidebarLabel}>
        <Link href={dashboard} aria-current={path === home ? 'page' : undefined} data-active={path.startsWith(home) && path !== reportPath && path !== billingPath} data-tip={copy.dashboard}>
          <LayoutDashboard size={16} aria-hidden="true" />
          <span className="app-label">{copy.dashboard}</span>
        </Link>
        {copy.report && (
          <Link href={reportHref} aria-current={path === reportPath ? 'page' : undefined} data-active={path === reportPath} data-tip={copy.report}>
            <LifeBuoy size={16} aria-hidden="true" />
            <span className="app-label">{copy.report}</span>
          </Link>
        )}
        {copy.billing && current.owner && (
          <Link href={billingHref} aria-current={path === billingPath ? 'page' : undefined} data-active={path === billingPath} data-tip={copy.billing}>
            <CreditCard size={16} aria-hidden="true" />
            <span className="app-label">{copy.billing}</span>
          </Link>
        )}
      </nav>
      <div className="app-sidebar-foot">
        <LanguageMenu locale={locale} />
        <ThemeToggle locale={locale} />
        <ReadingButton label={copy.reading} className="app-reading"><SlidersHorizontal size={16} aria-hidden="true" /></ReadingButton>
        {exit ? (
          <Link className="button button-small button-outline app-signout" href={exit.href} data-tip={exit.label}>
            <LogOut size={16} aria-hidden="true" />
            <span className="app-label">{exit.label}</span>
          </Link>
        ) : (
          <form action={signOutAction}>
            <button type="submit" className="button button-small button-outline app-signout" data-tip={copy.signOut}>
              <LogOut size={16} aria-hidden="true" />
              <span className="app-label">{copy.signOut}</span>
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
