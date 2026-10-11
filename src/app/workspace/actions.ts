'use server';

import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getWorkspaceCopy, parsePlaceDraft, parseReportMessage, uuidPattern } from '@/lib/workspace';
import { approvedOrganization, problemReportsReady } from '@/lib/verification-server';
import { workspaceConfigured } from '@/lib/workspace-server';
import { isOrganisationRole } from '@/lib/roles';

export type SaveResult = {ok:true;revision:number} | {ok:false;error:'invalid'|'conflict'|'auth'|'error'};
export async function savePlaceDraft(org: string, locale: string, input: unknown): Promise<SaveResult> {
  if (!workspaceConfigured() || !isLocale(locale) || !uuidPattern.test(org)) return {ok:false,error:'invalid'};
  const draft=parsePlaceDraft(input,org);
  if (!draft) return {ok:false,error:'invalid'};
  try {
    const supabase=await createClient();
    const user=await confirmedUser(supabase);
    if(!user) return {ok:false,error:'auth'};
    if(!await approvedOrganization(supabase,org)) return {ok:false,error:'auth'};
    const role=await supabase.from('organization_members').select('role').eq('user_id',user.id).eq('organization_id',org).maybeSingle();
    if(role.error || !role.data || !isOrganisationRole(role.data.role)) return {ok:false,error:'auth'};
    const result=await supabase.rpc('save_place_draft',{org,place:draft.id,expected_revision:draft.revision,content_locale:locale,draft});
    if(result.error) return {ok:false,error:result.error.code==='40001'?'conflict':result.error.code==='42501'?'auth':'error'};
    const revision=Number(result.data);
    if(!Number.isSafeInteger(revision) || revision<=draft.revision) return {ok:false,error:'error'};
    revalidatePath(`/${locale}/workspace`);
    revalidatePath(`/${locale}/workspace/${draft.id}`);
    revalidatePath(`/${locale}/workspace/${draft.id}/preview`);
    return {ok:true,revision};
  } catch { return {ok:false,error:'error'}; }
}

export type ReportState = {message:string;done:boolean};
/** An owner or admin reports a problem to NERUMA. The database re-checks membership, approval, limits and the rate. */
export async function submitProblemReport(org: string, locale: string, _previous: ReportState, form: FormData): Promise<ReportState> {
  if (!isLocale(locale) || !uuidPattern.test(org)) return {message:'',done:false};
  const t=getWorkspaceCopy(locale);
  const message=parseReportMessage(form.get('message'));
  const placeValue=String(form.get('place') || '');
  if (!message || (placeValue!=='' && !uuidPattern.test(placeValue))) return {message:t.reportInvalid,done:false};
  try {
    const supabase=await createClient();
    if(!await confirmedUser(supabase) || !await problemReportsReady(supabase)) return {message:t.reportError,done:false};
    const result=await supabase.rpc('submit_problem_report',{org,place:placeValue || null,report_message:message,report_locale:locale});
    if(result.error) return {message:result.error.code==='54000'?t.reportTooMany:result.error.code==='22023'?t.reportInvalid:t.reportError,done:false};
    return {message:t.reportSaved,done:true};
  } catch { return {message:t.reportError,done:false}; }
}
