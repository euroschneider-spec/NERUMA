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
export const evidenceReady=(supabase:SupabaseClient)=>schemaVersionIsOne(supabase,'mandate_evidence_schema_version');

export async function approvedOrganization(supabase:SupabaseClient,org:string):Promise<boolean> {
  if(!await verificationReady(supabase)) return false;
  const {data,error}=await supabase.from('organizations').select('id').eq('id',org).eq('approval_status','approved').maybeSingle();
  return !error && !!data;
}
