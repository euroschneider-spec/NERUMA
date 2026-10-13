import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { LocationCards } from '@/components/location-cards';
import { listPlaces, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { publishingReady } from '@/lib/verification-server';

export const dynamic='force-dynamic';
// The browser tab speaks the page's language too.
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;const t=getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return {title:t.dashboard,robots:{index:false,follow:false}};
}
// Design sample for dev:mock only: real locations get a code and counts when publishing exists (DECISIONS.md, "QR codes").
const sampleOnly = process.env.VIANORAE_FIXTURE_DEMO_DATA==='1';
const sampleVisits = 128;
export default async function Workspace({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{org?:string}>}) {
  const {locale}=await params;if(!isLocale(locale)) notFound();
  const t=getWorkspaceCopy(locale);
  const context=await workspaceSession(locale);
  const {org:chosen}=await searchParams;
  const organisation=chosen ? context.organisations.find(o=>o.id===chosen) : context.organisations[0];
  if(chosen && !organisation) notFound();
  const places=organisation && workspaceConfigured() ? await listPlaces(context.supabase,organisation.id,locale) : [];
  const publishing=await publishingReady(context.supabase);
  const newPlaceHref=organisation ? `/${locale}/workspace/new?org=${organisation.id}` : '';
  return <main id="main-content" className="app-main">
    <div className="app-heading">
      <h1>{t.dashboard}</h1>
      {organisation && workspaceConfigured() && places.length>0 && <Link className="button" href={newPlaceHref}>{t.newPlace}</Link>}
    </div>
    {context.organisations.length>1 && <nav className="button-row" aria-label={getOrganisationCopy(locale).organisation}>{context.organisations.map(o=><Link key={o.id} className="quiet-link" href={`/${locale}/workspace?org=${o.id}`} aria-current={o.id===organisation?.id?'page':undefined}>{o.name}</Link>)}</nav>}
    {!workspaceConfigured() ? <p>{t.readyLater}</p> : !organisation ? <p>{t.forbidden}</p> : <section aria-labelledby="locations-heading">
      <h2 id="locations-heading">{t.locationsHeading}</h2>
      {!places.length ? <div className="empty-state"><p>{t.empty}</p><Link className="button" href={newPlaceHref}>{t.newPlace}</Link></div> : <LocationCards places={places} locale={locale} base={`/${locale}/workspace`} sample={sampleOnly && !publishing ? 'all' : 'none'} qrCode="willow-museum" visits={sampleVisits} publishing={publishing}/>}
    </section>}
  </main>;
}
