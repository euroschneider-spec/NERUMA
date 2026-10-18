'use client';
import { useParams, usePathname } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
export default function WorkspaceError({reset}:{reset:()=>void}) {
  const params=useParams();const language=String(params.locale);const locale=isLocale(language)?language:'en';const t=getWorkspaceCopy(locale);
  // The dashboard is the workspace address itself; every other page under it is named generally.
  const onDashboard=usePathname()===`/${locale}/workspace`;
  return <main id="main-content" className="container"><div className="page-heading"><h1>{t.workspace}</h1></div><p role="alert">{onDashboard?t.loadErrorDashboard:t.loadError}</p><div className="button-row"><button className="button" onClick={reset}>{locale==='ro'?'Încearcă din nou':locale==='de'?'Erneut versuchen':'Try again'}</button></div></main>;
}
