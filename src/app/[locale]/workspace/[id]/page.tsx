import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { loadPlace, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { OnlineBuilder } from '@/components/online-builder';

export const dynamic='force-dynamic';
// The browser tab speaks the page's language too.
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;const t=getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return {title:t.edit,robots:{index:false,follow:false}};
}
export default async function EditPlace({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale)) notFound();const t=getWorkspaceCopy(locale);
  const context=await workspaceSession(locale);
  if(!workspaceConfigured()) return <main id="main-content" className="app-main"><div className="app-heading"><h1>{t.edit}</h1></div><p>{t.readyLater}</p></main>;
  const result=await loadPlace(context.supabase,id,context.organisations,locale);if(!result) notFound();
  return <main id="main-content" className="app-main"><div className="app-heading"><h1>{result.draft.name || t.edit}</h1></div>
    <OnlineBuilder key={`${id}:${locale}`} locale={locale} org={result.org} initial={result.draft} persistedZoneIds={result.persistedZoneIds} fieldsEnabled={result.fieldsEnabled} publication={result.publication} missingTranslation={result.missingTranslation} visiting={context.visit?.organisation===result.org}/>
  </main>;
}
