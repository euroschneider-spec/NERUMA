import { getAuthFeedback } from '@/lib/auth-feedback';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import { OrganisationForm } from '@/components/organisation-form';
import { ResponsibilityNotice } from '@/components/responsibility-notice';
import { workspaceConfigured } from '@/lib/workspace-server';
import { getWorkspaceCopy } from '@/lib/workspace';
import { MandateDocuments } from '@/components/mandate-documents';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { evidenceReady, verificationReady } from '@/lib/verification-server';
import { getVerificationCopy, type OrganizationApplication } from '@/lib/verification';
import { getViewer } from '@/lib/viewer-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation account', robots: { index: false, follow: false } };
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const t=getOrganisationCopy(locale);const v=getVerificationCopy(locale);
  if (!authConfigured()) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p className="notice">{t.unavailable}</p><div className="content-body"><Link className="button" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></div></main>;
  const supabase=await createClient();const user=await confirmedUser(supabase);
  if(!user) redirect(`/${locale}/login`);
  if(!await verificationReady(supabase)) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p className="notice" role="status">{v.setup}</p><form action={signOut.bind(null,locale)}><button className="text-button">{t.signOut}</button></form></main>;
  const [viewer,applicationResult]=await Promise.all([
    getViewer(supabase,user.id),
    supabase.from('organization_applications').select('*').eq('applicant_id',user.id).maybeSingle(),
  ]);
  if(!viewer || applicationResult.error) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p role="alert">{t.authError}</p></main>;
  const ownOrganizations=viewer.memberships.map(membership=>({id:membership.organisation,name:membership.name}));
  const application=applicationResult.data as OrganizationApplication|null;
  const documentsEnabled=await evidenceReady(supabase);
  const documentsResult=documentsEnabled ? await supabase.from('organization_evidence_documents').select('*').eq('applicant_id',user.id).order('created_at').limit(30) : null;
  const documents=((documentsResult?.data||[]) as MandateDocument[]).filter(doc=>doc.uploaded_at && application?.evidence_document_ids?.includes(doc.id));
  const initialDocuments=documents.length ? documents : ((documentsResult?.data||[]) as MandateDocument[]).filter(doc=>doc.uploaded_at && !doc.application_id).slice(-3);
  const suggestions=user.user_metadata.verification_suggestion;
  const suggestion=suggestions && typeof suggestions==='object' ? suggestions as Record<string,unknown> : {};
  const field=(name:string,max:number)=>typeof suggestion[name]==='string' ? String(suggestion[name]).slice(0,max) : '';
  const initial=application ? {organisation:application.organization_name,type:application.organization_type,representative:application.representative_name,website:application.official_website,country:application.country_code,registry:application.registry_reference,representativeRole:application.representative_role,authorization:application.authorization_description,revision:Number(application.revision)} : {
    organisation:field('organisation',160) || String(user.user_metadata.organisation_name||'').slice(0,160),
    type:field('type',30) || String(user.user_metadata.organisation_type||'institution').slice(0,30),
    representative:field('representative',160) || String(user.user_metadata.display_name||'').slice(0,160),
    website:field('website',500),country:field('country',2),registry:field('registry',300),representativeRole:field('representativeRole',160),authorization:field('authorization',2000),
  };
  return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><div className="content-body">
    {viewer.isPlatformAdmin && <p><Link className="button" href={`/${locale}/admin/organisations`}>{v.admin}</Link></p>}
    {!application && !ownOrganizations.length && <p className="auth-feedback" role="status">{getAuthFeedback(locale).confirmed}</p>}
    <ResponsibilityNotice locale={locale}/>
    {application && <section className="notice" aria-labelledby="application-status"><h2 id="application-status">{v.statuses[application.status]}</h2><p>{application.organization_name}</p>{application.status==='pending' && <p>{getAuthFeedback(locale).pending}</p>}{application.applicant_note && <p>{application.applicant_note}</p>}{application.status!=='approved' && <p>{v.gate}</p>}</section>}
    {application && documentsEnabled && <MandateDocuments locale={locale} documents={documents}/>}
    {!documentsEnabled && !ownOrganizations.length && <p className="notice" role="status">{getEvidenceCopy(locale).setup}</p>}
    {ownOrganizations.length ? <><ul>{ownOrganizations.map(org=><li key={org.id}>{org.name}</li>)}</ul>{workspaceConfigured() ? <><p className="notice">{getWorkspaceCopy(locale).boundary}</p><Link className="button" href={`/${locale}/workspace`}>{getWorkspaceCopy(locale).workspace}</Link></> : <p className="notice">{t.liveBoundary}</p>}</> : null}
    {(!application || ['needs_information','rejected'].includes(application.status)) && !ownOrganizations.length && <OrganisationForm key={application?.revision || 'new'} locale={locale} mode="onboard" enabled={documentsEnabled && !documentsResult?.error} initial={initial} initialDocuments={initialDocuments}/>}
    <p><Link className="quiet-link" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></p>
    <form action={signOut.bind(null,locale)}><button className="text-button" type="submit">{t.signOut}</button></form>
  </div></main>;
}
