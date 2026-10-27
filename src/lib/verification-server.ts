import 'server-only';
import type { SupabaseClient } from './supabase/server';

// Each client lives for one request, so a schema check is asked once per request however many
// helpers depend on it. Any error answers false, so every caller still fails closed.
const schemaChecks=new WeakMap<SupabaseClient,Map<string,Promise<boolean>>>();
function schemaVersionIsOne(supabase:SupabaseClient,rpc:string):Promise<boolean> {
  let checks=schemaChecks.get(supabase);
  if(!checks) {checks=new Map();schemaChecks.set(supabase,checks);}
  let check=checks.get(rpc);
  if(!check) {
    check=(async()=>{try {const {data,error}=await supabase.rpc(rpc);return !error && data===1;} catch {return false;}})();
    checks.set(rpc,check);
  }
  return check;
}

export const verificationReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'organization_verification_schema_version');
// Fields per step (removed and own fields) exist only after the 2026-10-11 migration.
export const stepFieldsReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'step_fields_schema_version');
// Problem reports exist only after the 2026-10-12 migration.
export const problemReportsReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'problem_reports_schema_version');
// Publishing exists only after the 2026-10-13 migration; before it, Publish stays switched off.
export const publishingReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'publishing_schema_version');
// Two-factor sign-in exists only after the 2026-10-14 migration; before it, the database applies no such rule either.
export const twoFactorReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'two_factor_schema_version');
// Remembered devices exist only after the 2026-10-15 migration; before it, the option isn't offered.
export const rememberDeviceReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'remember_device_schema_version');
// Deleting an account exists only after the 2026-10-16 migration; before it, the account page offers no button.
export const accountDeletionReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'account_deletion_schema_version');
export const superadminReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'superadmin_schema_version');
export const accountProfileReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'account_profile_schema_version');
// Payments exist only after the 2026-10-18 migration; before it, Plan & billing says they aren't available yet.
export const paymentsReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'payments_schema_version');
// Platform administrators visiting an organisation exist only after the 2026-10-26 migration.
export const platformVisitReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'platform_visit_schema_version');
// Explore listing (switched on per organisation) exists only after the 2026-10-27 migration; before it, Explore lists every published place and no switch is shown.
export const exploreListingReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'explore_listing_schema_version');
// Archiving a location exists only after the 2026-10-27 archive migration; before it the dashboard has no Archive button.
export const archivePlacesReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'archive_places_schema_version');
export const evidenceReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'mandate_evidence_schema_version');

export async function approvedOrganization(supabase:SupabaseClient,org:string):Promise<boolean> {
  if(!await verificationReady(supabase)) return false;
  const {data,error}=await supabase.from('organizations').select('id').eq('id',org).eq('approval_status','approved').maybeSingle();
  return !error && !!data;
}
