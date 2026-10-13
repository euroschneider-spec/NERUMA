'use server';

import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getWorkspaceCopy, parsePlaceDraft, parseReportMessage, uuidPattern } from '@/lib/workspace';
import { approvedOrganization, problemReportsReady, publishingReady } from '@/lib/verification-server';
import { parseLanguageChecks, type LanguageCheck, type PublishResult, type UnpublishResult } from '@/lib/publishing';
import { responsibilityVersion } from '@/lib/organisation-copy';
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

/** The signed-in owner or admin of an approved organisation, or null. The database checks the same again. */
async function publisher(org: string) {
  if (!workspaceConfigured() || !uuidPattern.test(org)) return null;
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user || !await approvedOrganization(supabase, org) || !await publishingReady(supabase)) return null;
  const role = await supabase.from('organization_members').select('role').eq('user_id', user.id).eq('organization_id', org).maybeSingle();
  if (role.error || !role.data || (role.data.role !== 'owner' && role.data.role !== 'admin')) return null;
  return supabase;
}

/** Which languages could go live now, read from the saved version. */
export async function getPublicationCheck(org: string, place: string): Promise<LanguageCheck[] | null> {
  if (!uuidPattern.test(place)) return null;
  try {
    const supabase = await publisher(org);
    if (!supabase) return null;
    const result = await supabase.rpc('publication_check', { org, place });
    return result.error ? null : parseLanguageChecks(result.data);
  } catch { return null; }
}

/** Publishes the saved revision the page showed. Every complete language goes live; the others wait. */
export async function publishPlace(org: string, place: string, revision: number, agreed: boolean): Promise<PublishResult> {
  if (!uuidPattern.test(place) || !Number.isSafeInteger(revision) || revision < 1 || agreed !== true) return { ok: false, error: 'invalid' };
  try {
    const supabase = await publisher(org);
    if (!supabase) return { ok: false, error: 'auth' };
    const result = await supabase.rpc('publish_place', { org, place, expected_revision: revision, responsibility: responsibilityVersion });
    if (result.error) return { ok: false, error: result.error.code === '40001' ? 'conflict' : result.error.code === '42501' ? 'auth' : result.error.code === '22023' ? 'nothing' : 'error' };
    const data = result.data as { live?: unknown; slug?: unknown; code?: unknown } | null;
    const live = Array.isArray(data?.live) ? data.live.filter((locale): locale is 'en' | 'ro' | 'de' => isLocale(String(locale))) : [];
    if (!live.length || typeof data?.slug !== 'string' || typeof data?.code !== 'string') return { ok: false, error: 'error' };
    for (const locale of ['en', 'ro', 'de']) {
      revalidatePath(`/${locale}/workspace`);
      revalidatePath(`/${locale}/explore`);
      revalidatePath(`/${locale}/places/${data.slug}/guide`);
    }
    return { ok: true, live, slug: data.slug, code: data.code };
  } catch { return { ok: false, error: 'error' }; }
}

export async function unpublishPlace(org: string, place: string): Promise<UnpublishResult> {
  if (!uuidPattern.test(place)) return { ok: false };
  try {
    const supabase = await publisher(org);
    if (!supabase) return { ok: false };
    const result = await supabase.rpc('unpublish_place', { org, place });
    if (result.error) return { ok: false };
    for (const locale of ['en', 'ro', 'de']) {
      revalidatePath(`/${locale}/workspace`);
      revalidatePath(`/${locale}/explore`);
    }
    return { ok: true };
  } catch { return { ok: false }; }
}
