'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { getWorkspaceCopy, parsePlaceDraft, parseReportMessage, uuidPattern } from '@/lib/workspace';
import { approvedOrganization, exploreListingReady, paymentsReady, problemReportsReady, publishingReady } from '@/lib/verification-server';
import { parseLanguageChecks, type LanguageCheck, type PublishResult, type UnpublishResult } from '@/lib/publishing';
import { responsibilityVersion } from '@/lib/organisation-copy';
import { organisationAccess, workspaceConfigured } from '@/lib/workspace-server';
import { managesInStripe } from '@/lib/billing';
import { getBillingStatus } from '@/lib/billing-server';
import { siteOrigin } from '@/lib/request-guards';
import { createCheckout, createPortal, stripeConfigured } from '@/lib/stripe-server';

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
    // A platform administrator on a visit saves too; the database then allows only corrections (no new steps, languages or locations).
    if(!await organisationAccess(supabase,user.id,org)) return {ok:false,error:'auth'};
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

/** The signed-in owner or admin of an approved organisation (and which of the two), or a platform administrator on a visit there, or null. The database checks the same again. */
async function publisher(org: string) {
  if (!workspaceConfigured() || !uuidPattern.test(org)) return null;
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user || !await approvedOrganization(supabase, org) || !await publishingReady(supabase)) return null;
  const access = await organisationAccess(supabase, user.id, org);
  if (!access) return null;
  return { supabase, owner: access === 'owner', visitor: access === 'visitor' };
}

/** Which languages could go live now, read from the saved version. */
export async function getPublicationCheck(org: string, place: string): Promise<LanguageCheck[] | null> {
  if (!uuidPattern.test(place)) return null;
  try {
    const supabase = (await publisher(org))?.supabase;
    if (!supabase) return null;
    const result = await supabase.rpc('publication_check', { org, place });
    return result.error ? null : parseLanguageChecks(result.data);
  } catch { return null; }
}

/** Publishes the saved revision the page showed. Every complete language goes live; the others wait. */
export async function publishPlace(org: string, place: string, revision: number, agreed: boolean): Promise<PublishResult> {
  if (!uuidPattern.test(place) || !Number.isSafeInteger(revision) || revision < 1 || agreed !== true) return { ok: false, error: 'invalid' };
  try {
    const access = await publisher(org);
    // A platform administrator never publishes; the database refuses it too.
    if (!access || access.visitor) return { ok: false, error: 'auth' };
    const supabase = access.supabase;
    const result = await supabase.rpc('publish_place', { org, place, expected_revision: revision, responsibility: responsibilityVersion });
    if (result.error) return { ok: false, error: result.error.code === '40001' ? 'conflict' : result.error.code === '42501' ? 'auth' : result.error.code === '22023' ? 'nothing' : result.error.code === 'P0402' ? 'plan' : 'error' };
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
    const supabase = (await publisher(org))?.supabase;
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

/** An owner or admin shows or hides one location in Explore. The database allows it only while a platform administrator has switched Explore on, and never to a visitor. */
export async function setPlaceExplore(org: string, place: string, shown: boolean): Promise<{ ok: boolean }> {
  if (!uuidPattern.test(place) || typeof shown !== 'boolean') return { ok: false };
  try {
    const access = await publisher(org);
    if (!access || access.visitor || !await exploreListingReady(access.supabase)) return { ok: false };
    const result = await access.supabase.rpc('set_place_explore', { org, place, p_shown: shown });
    if (result.error || result.data !== true) return { ok: false };
    for (const locale of ['en', 'ro', 'de']) {
      revalidatePath(`/${locale}/workspace`);
      revalidatePath(`/${locale}/explore`);
    }
    return { ok: true };
  } catch { return { ok: false }; }
}

/** Whether this organisation may publish now, and whether the person asking is an owner, for the publish dialog. The database decides again. */
export async function getPublishingAllowed(org: string): Promise<{ allowed: boolean; owner: boolean } | null> {
  try {
    const access = await publisher(org);
    if (!access) return null;
    const status = await getBillingStatus(access.supabase, org);
    // Before the payments migration publishing needs no plan.
    return { allowed: status ? status.allowed : !await paymentsReady(access.supabase), owner: access.owner };
  } catch { return null; }
}

/**
 * Plan & billing's one button: Stripe Checkout for an organisation without a running plan, Stripe's own page for one that has it.
 * Owners only; the database answers the plan, and the organisation's id goes to Stripe so the webhook knows whose payment it is.
 */
export async function openBilling(org: string, locale: string) {
  if (!isLocale(locale) || !uuidPattern.test(org)) redirect('/');
  const back = `/${locale}/workspace/billing?org=${org}`;
  let destination: string | null = null;
  try {
    const supabase = stripeConfigured() && workspaceConfigured() ? await createClient() : null;
    const user = supabase ? await confirmedUser(supabase) : null;
    const origin = await siteOrigin();
    if (supabase && user?.email && origin && await approvedOrganization(supabase, org)) {
      const role = await supabase.from('organization_members').select('role').eq('user_id', user.id).eq('organization_id', org).maybeSingle();
      const status = !role.error && role.data?.role === 'owner' ? await getBillingStatus(supabase, org) : null;
      if (status) destination = managesInStripe(status) && status.customer
        ? await createPortal({ customer: status.customer, locale, returnUrl: `${origin}${back}` })
        : await createCheckout({ org, customer: status.customer, email: user.email, locale, origin });
    }
  } catch { destination = null; }
  redirect(destination ?? `${back}&checkout=error`);
}
