import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy } from '@/lib/workspace';
import { getVerificationCopy, type OrganizationApplication, type ReviewEvent } from '@/lib/verification';
import { MandateDocuments } from '@/components/mandate-documents';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { evidenceReady, verificationReady } from '@/lib/verification-server';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { authConfigured } from '@/lib/supabase/config';
import { OrganisationReviewForm } from '@/components/organisation-review-form';
import { requireSecondFactor } from '@/lib/two-factor-server';
import { getDeletionCopy } from '@/lib/account-deletion';

export const dynamic='force-dynamic';
export const metadata={title:'Organisation verification · NERUMA',robots:{index:false,follow:false}};
export default async function ReviewQueue({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string;history?:string}>}) {
  const {locale}=await params;if(!isLocale(locale)) notFound();if(!authConfigured()) notFound();
  const v=getVerificationCopy(locale);const t=getOrganisationCopy(locale);const supabase=await createClient();
  const user=await confirmedUser(supabase);if(!user) redirect(`/${locale}/login`);
  if(!await verificationReady(supabase)) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{v.admin}</h1></div><p className="notice">{v.setup}</p></main>;
  await requireSecondFactor(supabase,locale);
  const admin=await supabase.rpc('is_platform_admin');if(admin.error || admin.data!==true) notFound();
  const search=await searchParams;const history=search.history==='1';const requestedPage=Number(search.page||0);const page=Number.isSafeInteger(requestedPage) && requestedPage>=0 && requestedPage<=10000 ? requestedPage : 0;
  let query=supabase.from('organization_applications').select('*').order('submitted_at');
  query=history ? query.neq('status','pending') : query.eq('status','pending');
  const applications=await query.range(page*25,page*25+24);
  if(applications.error) return <main id="main-content" className="container verification-page"><p role="alert">{t.authError}</p></main>;
  const requests=(applications.data||[]) as OrganizationApplication[];
  const events=await supabase.from('organization_review_events').select('*').order('created_at',{ascending:false}).limit(100);
  if(events.error) return <main id="main-content" className="container verification-page"><p role="alert">{t.authError}</p></main>;
  const documentsEnabled=await evidenceReady(supabase);
  const documentResults=documentsEnabled ? await Promise.all(requests.map(request=>supabase.from('organization_evidence_documents').select('*').eq('application_id',request.id).limit(30))) : [];
  const documents=documentResults.flatMap(result=>result.data||[]) as MandateDocument[];
  const base=`/${locale}/admin/organisations`;
  return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{v.admin}</h1><p className="lead">{v.adminIntro}</p></div><div className="content-body">
    <nav aria-label={v.title} className="button-row"><Link className="quiet-link" href={base}>{v.statuses.pending}</Link><Link className="quiet-link" href={`${base}?history=1`}>{v.history}</Link><Link className="quiet-link" href={`/${locale}/admin/reports`}>{getWorkspaceCopy(locale).reportsAdmin}</Link><Link className="quiet-link" href={`/${locale}/admin/deletions`}>{getDeletionCopy(locale).adminTitle}</Link><Link className="quiet-link" href={`/${locale}/account`}>{t.account}</Link></nav>
    {!documentsEnabled && <p className="notice">{getEvidenceCopy(locale).setup}</p>}
    {!requests.length && <p className="notice">{v.empty}</p>}
    {requests.map(request=><section key={request.id} className="verification-request" aria-labelledby={`request-${request.id}`}>
      <h2 id={`request-${request.id}`}>{request.organization_name}</h2><p className="notice">{v.statuses[request.status]}</p>
      <dl className="verification-details"><dt>{t.email}</dt><dd>{request.applicant_email}</dd><dt>{t.representative}</dt><dd>{request.representative_name}</dd><dt>{v.role}</dt><dd>{request.representative_role}</dd><dt>{v.country}</dt><dd>{request.country_code}</dd><dt>{v.website}</dt><dd><a href={request.official_website} target="_blank" rel="noreferrer">{request.official_website}</a></dd><dt>{v.registry}</dt><dd>{request.registry_reference || '—'}</dd><dt>{v.authorization}</dt><dd>{request.authorization_description}</dd><dt>{v.submitted}</dt><dd>{new Date(request.submitted_at).toLocaleString(locale,{timeZone:'Europe/Berlin'})}</dd></dl>
      <MandateDocuments locale={locale} documents={documents.filter(doc=>request.evidence_document_ids?.includes(doc.id))}/>
      {documentsEnabled && !documentResults.some(result=>result.error) && <OrganisationReviewForm key={`${request.id}-${request.revision}`} locale={locale} application={{id:request.id,revision:request.revision,status:request.status}} self={request.applicant_id===user.id} documents={documents.filter(doc=>request.evidence_document_ids?.includes(doc.id))}/> }
      <details><summary>{v.history}</summary>{(events.data as ReviewEvent[]).filter(event=>event.application_id===request.id).map(event=><div key={event.id} className="notice"><p>{v.statuses[event.decision]} · {new Date(event.created_at).toLocaleString(locale,{timeZone:'Europe/Berlin'})} · {event.actor_id}</p><p>{event.verified_source}</p><p>{event.evidence_reference}</p><p>{event.applicant_note}</p>{!!event.reviewed_document_ids?.length && <MandateDocuments locale={locale} documents={documents.filter(doc=>event.reviewed_document_ids.includes(doc.id))}/>}</div>)}</details>
    </section>)}
    <nav className="button-row" aria-label={v.admin}>{page>0 && <Link href={`${base}?page=${page-1}&history=${history?1:0}`}>{v.previous}</Link>}{requests.length===25 && <Link href={`${base}?page=${page+1}&history=${history?1:0}`}>{v.next}</Link>}</nav>
  </div></main>;
}
