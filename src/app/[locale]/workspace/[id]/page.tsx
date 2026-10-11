import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { loadPlace, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { OnlineBuilder } from '@/components/online-builder';

export const dynamic='force-dynamic';
export const metadata={title:'Edit organisation draft',robots:{index:false,follow:false}};
export default async function EditPlace({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale)) notFound();const t=getWorkspaceCopy(locale);
  const context=await workspaceSession(locale);
  if(!workspaceConfigured()) return <main id="main-content" className="container"><div className="page-heading"><h1>{t.edit}</h1></div><p>{t.readyLater}</p></main>;
  const result=await loadPlace(context.supabase,id,context.organisations,locale);if(!result) notFound();
  return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">{context.organisations.find(o=>o.id===result.org)?.name}</p><h1>{result.draft.name || t.edit}</h1></div><div className="content-body">
    <OnlineBuilder key={`${id}:${locale}`} locale={locale} org={result.org} initial={result.draft} persistedZoneIds={result.persistedZoneIds} missingTranslation={result.missingTranslation}/>
  </div></main>;
}
