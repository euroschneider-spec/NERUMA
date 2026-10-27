import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, longDate } from '@/lib/i18n';
import { getBillingCopy, planState } from '@/lib/billing';
import { getBillingStatus } from '@/lib/billing-server';
import { fill } from '@/lib/publishing';
import { stripeConfigured } from '@/lib/stripe-server';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { RestoreButton } from '@/components/archive-controls';
import { LocationCards } from '@/components/location-cards';
import { getArchiveCopy } from '@/lib/archive-places';
import { listPlaces, organisationExplore, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { archivePlacesReady, exploreListingReady, publishingReady } from '@/lib/verification-server';

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
  // The "Show in Explore" switch exists once the Explore migration is installed; it works once a platform administrator has switched Explore on, and is greyed out until then.
  const exploreReady=!!organisation && workspaceConfigured() && await exploreListingReady(context.supabase);
  const exploreOn=exploreReady && await organisationExplore(context.supabase,organisation!.id);
  // A platform administrator on a visit corrects and takes down; archiving is the organisation's own.
  const visiting=context.visit?.organisation===organisation?.id;
  const archiving=!!organisation && workspaceConfigured() && !visiting && await archivePlacesReady(context.supabase);
  const archived=archiving ? await listPlaces(context.supabase,organisation.id,locale,true) : [];
  const a=getArchiveCopy(locale);
  const newPlaceHref=organisation ? `/${locale}/workspace/new?org=${organisation.id}` : '';
  // A failed payment, or no plan once payments are on: say so before anything else (docs/guides/PAYMENTS.md).
  const billing=organisation && workspaceConfigured() ? await getBillingStatus(context.supabase,organisation.id) : null;
  const plan=billing ? planState(billing) : null;
  const b=getBillingCopy(locale);
  const planNotice=!billing ? null : plan==='grace' ? fill(b.dashboardGrace,{date:longDate(billing.graceUntil!,locale)}) : billing.allowed ? null : plan==='ended' ? b.dashboardEnded : b.dashboardNone;
  // Adding a location is the organisation's own too (brief 2026-10-26).
  const owner=!visiting && context.memberships.find(m=>m.organisation===organisation?.id)?.role==='owner';
  return <main id="main-content" className="app-main">
    <div className="app-heading">
      <h1>{t.dashboard}</h1>
      {organisation && workspaceConfigured() && places.length>0 && !visiting && <Link className="button" href={newPlaceHref}>{t.newPlace}</Link>}
    </div>
    {planNotice && <p className="notice notice-warning">{planNotice}{owner && stripeConfigured() && <>{' '}<Link href={`/${locale}/workspace/billing?org=${organisation!.id}`}>{b.dashboardLink}</Link></>}</p>}
    {context.organisations.length>1 && <nav className="button-row" aria-label={getOrganisationCopy(locale).organisation}>{context.organisations.map(o=><Link key={o.id} className="quiet-link" href={`/${locale}/workspace?org=${o.id}`} aria-current={o.id===organisation?.id?'page':undefined}>{o.name}</Link>)}</nav>}
    {!workspaceConfigured() ? <p>{t.readyLater}</p> : !organisation ? <p>{t.forbidden}</p> : <section aria-labelledby="locations-heading">
      <h2 id="locations-heading">{t.locationsHeading}</h2>
      {!places.length ? <div className="empty-state"><p>{t.empty}</p>{!visiting && <Link className="button" href={newPlaceHref}>{t.newPlace}</Link>}</div> : <LocationCards places={places} locale={locale} base={`/${locale}/workspace`} sample={sampleOnly && !publishing ? 'all' : 'none'} qrCode="willow-museum" visits={sampleVisits} publishing={publishing} exploreOrg={visiting || !exploreReady ? undefined : organisation.id} exploreOn={exploreOn} archiveOrg={archiving ? organisation.id : undefined}/>}
      {archived.length>0 && <details className="archived-locations">
        <summary>{a.heading} ({archived.length})</summary>
        <p className="small-note">{a.hint}</p>
        <ul>{archived.map(place=><li key={place.id}><span>{place.name}</span> <RestoreButton locale={locale} org={organisation.id} place={place.id} name={place.name}/></li>)}</ul>
      </details>}
    </section>}
  </main>;
}
