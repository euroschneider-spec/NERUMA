import { getAuthFeedback } from '@/lib/auth-feedback';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCopy, isLocale, longDate } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import { getSuperadminCopy } from '@/lib/superadmin';
import { OrganisationForm } from '@/components/organisation-form';
import { ResponsibilityNotice } from '@/components/responsibility-notice';
import { workspaceConfigured } from '@/lib/workspace-server';
import { getWorkspaceCopy } from '@/lib/workspace';
import { MandateDocuments } from '@/components/mandate-documents';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { evidenceReady, verificationReady } from '@/lib/verification-server';
import { getVerificationCopy, type OrganizationApplication } from '@/lib/verification';
import { getViewer } from '@/lib/viewer-server';
import { accountDeletionReady, twoFactorReady } from '@/lib/verification-server';
import { fill, getDeletionCopy } from '@/lib/account-deletion';
import { getBackupCodes, getRememberedDevices, getTwoFactorStatus } from '@/lib/two-factor-server';
import { RememberedDevices } from '@/components/remembered-devices';
import { twoFactorStep } from '@/lib/two-factor';
import { TwoFactorSetup } from '@/components/two-factor-setup';
import { BackupCodesPanel } from '@/components/backup-codes';
import { ChangePasswordForm } from '@/components/password-reset-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation account', robots: { index: false, follow: false } };
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const t=getOrganisationCopy(locale);const v=getVerificationCopy(locale);
  if (!authConfigured()) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p className="notice">{t.unavailable}</p><div className="content-body"><Link className="button" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></div></main>;
  const supabase=await createClient();const user=await confirmedUser(supabase);
  if(!user) redirect(`/${locale}/login`);
  if(!await verificationReady(supabase)) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p className="notice" role="status">{v.setup}</p><form action={signOut.bind(null,locale)}><button className="text-button">{t.signOut}</button></form></main>;
  // A locked account (deletion in progress) can do nothing here any more: it is told when it will be deleted, and can sign out.
  const deletion=await accountDeletionReady(supabase) ? (await supabase.rpc('my_account_deletion')).data as {delete_after?:string}|null : null;
  if(deletion?.delete_after){const d=getDeletionCopy(locale);const day=longDate(deletion.delete_after,locale);return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><div className="content-body"><section className="notice" aria-labelledby="account-locked"><h2 id="account-locked">{d.doneTitle}</h2><p>{fill(d.doneDate,{date:day})}</p><p>{fill(d.lostLink,{date:day})}</p><p>{fill(d.doneRestore,{date:day})}</p></section><form action={signOut.bind(null,locale)}><button className="text-button" type="submit">{t.signOut}</button></form></div></main>;}
  // An account with an authenticator app enters its code first; one that still has to set it up does that here.
  const twoFactor=await getTwoFactorStatus(supabase);
  // Until then the database hides the account's organisation, so the rest of the page would be misleading.
  const step=twoFactor && twoFactorStep(twoFactor);
  if(step==='verify') redirect(`/${locale}/login/verify`);
  if(step==='setup') return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><div className="content-body"><TwoFactorSetup locale={locale} enrolled={false} required/><form action={signOut.bind(null,locale)}><button className="text-button" type="submit">{t.signOut}</button></form></div></main>;
  const backup=twoFactor?.enrolled ? await getBackupCodes(supabase) : {state:'off'} as const;
  const devices=twoFactor?.enrolled && twoFactor.canRemember ? await getRememberedDevices(supabase) : null;
  const [viewer,applicationResult]=await Promise.all([
    getViewer(supabase,user.id),
    supabase.from('organization_applications').select('*').eq('applicant_id',user.id).maybeSingle(),
  ]);
  if(!twoFactor || !viewer || applicationResult.error) return <main id="main-content" className="container verification-page"><div className="page-heading"><h1>{t.account}</h1></div><p role="alert">{t.authError}</p></main>;
  const ownOrganizations=viewer.memberships.map(membership=>({id:membership.organisation,name:membership.name}));
  const application=applicationResult.data as OrganizationApplication|null;
  // A platform administrator with no organisation of their own is not applying for one: the registration side of this page is for everyone else.
  const operatorOnly=viewer.isPlatformAdmin && !application && !ownOrganizations.length;
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
    {viewer.isPlatformAdmin && <p><Link className="button" href={`/${locale}/admin`}>{getSuperadminCopy(locale).title}</Link></p>}
    {!operatorOnly && !application && !ownOrganizations.length && <p className="auth-feedback" role="status">{getAuthFeedback(locale).confirmed}</p>}
    {!operatorOnly && <ResponsibilityNotice locale={locale}/>}
    {application && <section className="notice" aria-labelledby="application-status"><h2 id="application-status">{v.statuses[application.status]}</h2><p>{application.organization_name}</p>{application.status==='pending' && <p>{getAuthFeedback(locale).pending}</p>}{application.applicant_note && <p>{application.applicant_note}</p>}{application.status!=='approved' && <p>{v.gate}</p>}</section>}
    {application && documentsEnabled && <MandateDocuments locale={locale} documents={documents}/>}
    {!operatorOnly && !documentsEnabled && !ownOrganizations.length && <p className="notice notice-warning" role="status">{getEvidenceCopy(locale).setup}</p>}
    {ownOrganizations.length ? <><ul>{ownOrganizations.map(org=><li key={org.id}>{org.name}</li>)}</ul>{workspaceConfigured() ? <><p className="notice">{getWorkspaceCopy(locale).boundary}</p><Link className="button" href={`/${locale}/workspace`}>{getWorkspaceCopy(locale).workspace}</Link></> : <p className="notice">{t.liveBoundary}</p>}</> : null}
    {!operatorOnly && (!application || ['needs_information','rejected'].includes(application.status)) && !ownOrganizations.length && <OrganisationForm key={application?.revision || 'new'} locale={locale} mode="onboard" enabled={documentsEnabled && !documentsResult?.error} initial={initial} initialDocuments={initialDocuments}/>}
    {await twoFactorReady(supabase) && <TwoFactorSetup locale={locale} enrolled={twoFactor.enrolled} required={false}>{backup.state!=='off' && <BackupCodesPanel locale={locale} backup={backup}/>}{devices && <RememberedDevices locale={locale} devices={devices}/>}</TwoFactorSetup>}
    <ChangePasswordForm locale={locale} needsCode={twoFactor.enrolled}/>
    {await accountDeletionReady(supabase) && <section className="notice" aria-labelledby="delete-account"><h2 id="delete-account">{getDeletionCopy(locale).sectionTitle}</h2><p>{getDeletionCopy(locale).sectionIntro}</p><p><Link className="quiet-link" href={`/${locale}/account/delete`}>{getDeletionCopy(locale).sectionLink}</Link></p></section>}
    <p><Link className="quiet-link" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></p>
    <form action={signOut.bind(null,locale)}><button className="text-button" type="submit">{t.signOut}</button></form>
  </div></main>;
}
