'use client';
import { useParams } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
export default function WorkspaceError({reset}:{reset:()=>void}) {
  const params=useParams();const language=String(params.locale);const locale=isLocale(language)?language:'en';const t=getWorkspaceCopy(locale);
  return <main id="main-content" className="container"><div className="page-heading"><h1>{t.workspace}</h1></div><p role="alert">{t.error}</p><div className="button-row"><button className="button" onClick={reset}>{locale==='ro'?'Încearcă din nou':locale==='de'?'Erneut versuchen':'Try again'}</button></div></main>;
}
