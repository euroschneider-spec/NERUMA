import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getSuperadminCopy } from '@/lib/superadmin';
import { getVerificationCopy } from '@/lib/verification';
import { getWorkspaceCopy } from '@/lib/workspace';
import { getDeletionCopy } from '@/lib/account-deletion';

/** The links between the pages of the administration area. */
export function AdminNav({ locale }: { locale: Locale }) {
  const t = getSuperadminCopy(locale);
  const links = [
    ['/admin', t.dashboard],
    ['/admin/organisations', getVerificationCopy(locale).admin],
    ['/admin/reports', getWorkspaceCopy(locale).reportsAdmin],
    ['/admin/deletions', getDeletionCopy(locale).adminTitle],
    ['/admin/accounts', t.accounts],
    ['/admin/administrators', t.administrators],
    ['/account', getOrganisationCopy(locale).account],
  ];
  return (
    <nav aria-label={t.title} className="button-row">
      {links.map(([path, label]) => <Link key={path} className="quiet-link" href={`/${locale}${path}`}>{label}</Link>)}
    </nav>
  );
}
