'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { ThemeToggle } from './theme-toggle';
import { ToneSwitch } from './tone-switch';
import { LanguageMenu } from './language-menu';
import { Brand } from './site-header';

export type SidebarMembership = { organisation: string; name: string; roleLabel: string };
export type SidebarCopy = { dashboard: string; signOut: string; sidebarLabel: string; collapse: string; expand: string };

/** Remembered in this browser only; a convenience, so a missing or blocked storage simply means "open". */
const collapsedKey = 'neruma:sidebar-collapsed';

/** The organisation's own navigation: who and where you are, the way around, language, theme and sign out. */
export function OrgSidebar({ locale, memberships, copy, signOutAction }: {
  locale: Locale;
  memberships: SidebarMembership[];
  copy: SidebarCopy;
  signOutAction: () => Promise<void>;
}) {
  const path = usePathname();
  const chosen = useSearchParams().get('org');
  const current = memberships.find((membership) => membership.organisation === chosen) ?? memberships[0];
  const dashboard = `/${locale}/workspace${memberships.length > 1 ? `?org=${current.organisation}` : ''}`;
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
        <button type="button" className="app-collapse" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? copy.expand : copy.collapse} title={collapsed ? copy.expand : copy.collapse}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      <div className="app-org">
        <p className="app-org-name">{current.name}</p>
        <p className="app-org-role">{current.roleLabel}</p>
      </div>
      <nav className="app-nav" aria-label={copy.sidebarLabel}>
        <Link href={dashboard} aria-current={path === `/${locale}/workspace` ? 'page' : undefined} data-active={path.startsWith(`/${locale}/workspace`)}>
          <LayoutDashboard size={16} aria-hidden="true" />
          <span className="app-label">{copy.dashboard}</span>
        </Link>
      </nav>
      <div className="app-sidebar-foot">
        <LanguageMenu locale={locale} />
        <ToneSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        <form action={signOutAction}>
          <button type="submit" className="button button-small button-outline app-signout">
            <LogOut size={16} aria-hidden="true" />
            <span className="app-label">{copy.signOut}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
