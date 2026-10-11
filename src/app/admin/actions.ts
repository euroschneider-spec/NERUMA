'use server';
import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n';
import { getVerificationCopy } from '@/lib/verification';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { evidenceReady, problemReportsReady, verificationReady } from '@/lib/verification-server';
import { uuidPattern } from '@/lib/workspace';
import type { AuthState } from '@/app/auth/actions';

export async function reviewOrganization(locale:string,_previous:AuthState,form:FormData):Promise<AuthState> {
  if(!isLocale(locale)) return {message:'Invalid language.'};
  const v=getVerificationCopy(locale);const value=(key:string)=>String(form.get(key)||'').trim();
  const id=value('application');const revision=Number(value('revision'));const decision=value('decision');
  const source=value('source');const evidence=value('evidence');const note=value('note');
  const reviewed=form.getAll('reviewedDocument').map(String);
  const entity=form.get('entity')==='on';const mandate=form.get('mandate')==='on';
  if(!uuidPattern.test(id) || !Number.isSafeInteger(revision) || revision<1 || !['approved','needs_information','rejected','suspended'].includes(decision)
    || reviewed.length>3 || !reviewed.every(id=>uuidPattern.test(id)) || (decision==='approved' && !reviewed.length)
    || note.length<10 || note.length>2000 || source.length>1000 || evidence.length>2000
    || (decision==='approved' && (!entity || !mandate || source.length<10 || evidence.length<20))) return {message:v.error};
  try {
    const supabase=await createClient();
    if(!await confirmedUser(supabase) || !await verificationReady(supabase) || !await evidenceReady(supabase)) return {message:v.error};
    const admin=await supabase.rpc('is_platform_admin');if(admin.error || admin.data!==true) return {message:v.error};
    const result=await supabase.rpc('review_organization_application',{application_id:id,expected_revision:revision,decision,entity_confirmed:entity,mandate_confirmed:mandate,verified_source:source,evidence_reference:evidence,applicant_note:note,reviewed_documents:reviewed});
    if(result.error) return {message:v.error};
    revalidatePath(`/${locale}/admin/organisations`);revalidatePath(`/${locale}/account`);revalidatePath(`/${locale}/workspace`);
    return {message:v.audit};
  } catch {return {message:v.error};}
}

/** The platform administrator closes one report. The database refuses anyone else and a report that is already closed. */
export async function closeProblemReport(locale:string,form:FormData):Promise<void> {
  const id=String(form.get('report')||'');
  if(!isLocale(locale) || !uuidPattern.test(id)) return;
  try {
    const supabase=await createClient();
    if(!await confirmedUser(supabase) || !await problemReportsReady(supabase)) return;
    await supabase.rpc('close_problem_report',{report:id});
  } catch {
    // Nothing to show: the list still shows the report as open.
  }
  revalidatePath(`/${locale}/admin/reports`);
}
