import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { fill } from '@/lib/account-deletion';
import { getSuperadminCopy } from '@/lib/superadmin';
import { requireAdministrator } from '@/lib/superadmin-server';

// Every administration page sits in this frame: the strip says whose view this is, and `admin-area` gives the area its own yellow.
// Same gate as the pages (a plain 404 for anyone else), so the strip is never shown to a person who isn't a platform administrator.
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { user } = await requireAdministrator(locale);
  const t = getSuperadminCopy(locale);
  return (
    <div className="admin-area">
      <div className="admin-strip">
        <div className="container admin-strip-inner">
          <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <p><strong>{t.stripTitle}</strong> · {fill(t.signedInAs, { email: user.email ?? '' })}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
