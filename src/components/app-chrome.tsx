'use client';
import { usePathname } from 'next/navigation';

/**
 * The visitor site wears the public header and footer. The signed-in organisation workspace has its own
 * shell (a sidebar, see app/[locale]/workspace/layout.tsx), so the public chrome steps aside there.
 */
export function AppChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  if (/^\/(en|ro|de)\/workspace(\/|$)/.test(path)) return <>{children}</>;
  return (
    <>
      {header}
      {children}
      {footer}
    </>
  );
}
