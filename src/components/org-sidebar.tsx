'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, LogOut } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { ThemeToggle } from './theme-toggle';
import { ToneSwitch } from './tone-switch';
import { LanguageMenu } from './language-menu';
import { Brand } from './site-header';

export type SidebarMembership = { organisation: string; name: string; roleLabel: string };
export type SidebarCopy = { dashboard: string; signOut: string; sidebarLabel: string };

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
  return (
    <aside className="app-sidebar" aria-label={copy.sidebarLabel}>
      <Link className="brand-link" href={`/${locale}`} aria-label="NERUMA"><Brand /></Link>
      <div className="app-org">
        <p className="app-org-name">{current.name}</p>
        <p className="app-org-role">{current.roleLabel}</p>
      </div>
      <nav className="app-nav" aria-label={copy.sidebarLabel}>
        <Link href={dashboard} aria-current={path === `/${locale}/workspace` ? 'page' : undefined} data-active={path.startsWith(`/${locale}/workspace`)}>
          <LayoutDashboard size={16} aria-hidden="true" />
          {copy.dashboard}
        </Link>
      </nav>
      <div className="app-sidebar-foot">
        <LanguageMenu locale={locale} />
        <ToneSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        <form action={signOutAction}>
          <button type="submit" className="button button-small button-outline app-signout">
            <LogOut size={16} aria-hidden="true" />
            {copy.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
