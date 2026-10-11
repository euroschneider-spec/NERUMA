import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy, newPlace } from '@/lib/workspace';
import { workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { stepFieldsReady } from '@/lib/verification-server';
import { OnlineBuilder } from '@/components/online-builder';

export const dynamic='force-dynamic';
// The browser tab speaks the page's language too.
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;const t=getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return {title:t.newPlace,robots:{index:false,follow:false}};
}
export default async function NewPlace({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{org?:string}>}) {
  const {locale}=await params;if(!isLocale(locale)) notFound();
  const t=getWorkspaceCopy(locale);const context=await workspaceSession(locale);const {org:chosen}=await searchParams;
  const organisation=chosen ? context.organisations.find(o=>o.id===chosen) : context.organisations[0];
  if(chosen && !organisation) notFound();
  const fieldsEnabled=workspaceConfigured() && await stepFieldsReady(context.supabase);
  return <main id="main-content" className="app-main"><div className="app-heading"><h1>{t.newPlace}</h1></div>
    {!workspaceConfigured() ? <p className="notice">{t.readyLater}</p> : !organisation ? <p>{t.forbidden}</p> : <OnlineBuilder locale={locale} org={organisation.id} initial={newPlace()} persistedZoneIds={[]} fieldsEnabled={fieldsEnabled}/>}
  </main>;
}
