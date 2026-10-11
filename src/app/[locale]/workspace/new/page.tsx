import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy, newPlace } from '@/lib/workspace';
import { workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { OnlineBuilder } from '@/components/online-builder';

export const dynamic='force-dynamic';
export const metadata={title:'Create a location',robots:{index:false,follow:false}};
export default async function NewPlace({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{org?:string}>}) {
  const {locale}=await params;if(!isLocale(locale)) notFound();
  const t=getWorkspaceCopy(locale);const context=await workspaceSession(locale);const {org:chosen}=await searchParams;
  const organisation=chosen ? context.organisations.find(o=>o.id===chosen) : context.organisations[0];
  if(chosen && !organisation) notFound();
  return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">{organisation?.name || 'NERUMA'}</p><h1>{t.newPlace}</h1></div><div className="content-body">
    {!workspaceConfigured() ? <p className="notice">{t.readyLater}</p> : !organisation ? <p>{t.forbidden}</p> : <OnlineBuilder locale={locale} org={organisation.id} initial={newPlace()} persistedZoneIds={[]}/>}
  </div></main>;
}
