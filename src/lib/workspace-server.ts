import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Locale } from './i18n';
import { confirmedUser, createClient, type SupabaseClient } from './supabase/server';
import { authConfigured } from './supabase/config';
import { newZone, uuidPattern, type OwnField, type PlaceDraft, type PlaceSummary, type RemovableField } from './workspace';
import type { SensoryProfile } from './demo';
import { stepFieldsReady, verificationReady } from './verification-server';
import { getViewer } from './viewer-server';

export const workspaceConfigured = () => authConfigured() && process.env.VIANORAE_WORKSPACE_ENABLED === '1';
// Cached per request: the shell and the page both ask for the session, and it is only fetched once.
export const workspaceSession = cache(async (locale: Locale) => {
  if (!authConfigured()) redirect(`/${locale}/login`);
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  if(!await verificationReady(supabase)) redirect(`/${locale}/account`);
  const viewer = await getViewer(supabase, user.id);
  if (!viewer) throw new Error('workspace-unavailable');
  const organisations = viewer.memberships.map(m => ({ id: m.organisation, name: m.name }));
  if(!organisations.length) redirect(`/${locale}/account`);
  return { supabase, user, organisations, memberships: viewer.memberships };
});
export async function listPlaces(supabase: SupabaseClient, org: string, locale: Locale): Promise<PlaceSummary[]> {
  const { data, error } = await supabase.from('places').select('id,city,address,status,revision,updated_at,place_translations(name,locale)')
    .eq('organization_id',org).neq('status','archived').order('updated_at',{ascending:false}).limit(100);
  if (error) throw new Error('workspace-unavailable');
  return (data || []).map(row => {
    const translations = row.place_translations as {name:string;locale:string}[];
    const current = translations.find(t=>t.locale===locale);
    const fallback = translations[0];
    return {id:row.id,city:row.city,address:row.address || '',status:row.status,revision:Number(row.revision),updatedAt:row.updated_at,
      name:current?.name || (fallback ? `${fallback.name} (${fallback.locale.toUpperCase()})` : row.city)};
  });
}
type Translation = {zone_id:string;title:string;description:string;useful_note:string;next_step:string};
type Profile = {zone_id:string;sound_level:SensoryProfile['sound'];light_level:SensoryProfile['light'];crowding_level:SensoryProfile['crowding'];smell_level:SensoryProfile['smell'];temperature_level:SensoryProfile['temperature'];visual_complexity_level:SensoryProfile['visual']};
type OwnFieldRow = {id:string;zone_id:string;kind:OwnField['kind'];sort_order:number;answer:OwnField['answer']};
type OwnFieldText = {field_id:string;label:string;value:string};
type Media = {id:string;zone_id:string;storage_key:string;alt_text:Record<string,string>;rights:string;photographed_on:string|null};
export async function loadPlace(supabase: SupabaseClient, id: string, organisations: {id:string;name:string}[], locale: Locale) {
  if (!uuidPattern.test(id)) return null;
  const place = await supabase.from('places').select('id,organization_id,city,address,country_code,place_type,revision').eq('id',id).maybeSingle();
  if (place.error) throw new Error('workspace-unavailable');
  const row=place.data;
  if (!row || !organisations.some(o=>o.id===row.organization_id)) return null;
  const org = row.organization_id as string;
  // Before the fields migration the columns and tables don't exist: read without them and keep the controls hidden.
  const fieldsEnabled = await stepFieldsReady(supabase);
  const noRows = Promise.resolve({data:[],error:null});
  const results = await Promise.all([
    supabase.from('place_translations').select('name,short_description,arrival_info').eq('place_id',id).eq('organization_id',org).eq('locale',locale).maybeSingle(),
    supabase.from('zones').select(fieldsEnabled ? 'id,type,sort_order,hidden_fields' : 'id,type,sort_order').eq('place_id',id).eq('organization_id',org).neq('status','archived').order('sort_order'),
    supabase.from('zone_translations').select('zone_id,title,description,useful_note,next_step').eq('place_id',id).eq('organization_id',org).eq('locale',locale),
    supabase.from('sensory_profiles').select('zone_id,sound_level,light_level,crowding_level,smell_level,temperature_level,visual_complexity_level').eq('place_id',id).eq('organization_id',org),
    supabase.from('media_assets').select('id,zone_id,storage_key,alt_text,rights,photographed_on').eq('place_id',id).eq('organization_id',org).eq('active',true),
    supabase.from('guides').select('id').eq('place_id',id).eq('organization_id',org).eq('locale',locale).maybeSingle(),
    fieldsEnabled ? supabase.from('zone_fields').select('id,zone_id,kind,sort_order,answer').eq('place_id',id).eq('organization_id',org).eq('active',true).order('sort_order') : noRows,
    fieldsEnabled ? supabase.from('zone_field_translations').select('field_id,label,value').eq('place_id',id).eq('organization_id',org).eq('locale',locale) : noRows,
  ]);
  if (results.some(r=>r.error)) throw new Error('workspace-unavailable');
  const [translation,zonesResult,textResult,profileResult,mediaResult,guideResult,fieldResult,fieldTextResult] = results;
  // Own fields are shared by all languages; a field without text in this language opens empty, like a step name.
  const fieldTexts = new Map((fieldTextResult.data as unknown as OwnFieldText[]).map(f=>[f.field_id,f]));
  const ownFields = new Map<string,OwnField[]>();
  for (const f of fieldResult.data as unknown as OwnFieldRow[]) {
    const words = fieldTexts.get(f.id);
    ownFields.set(f.zone_id,[...(ownFields.get(f.zone_id) || []),{id:f.id,kind:f.kind,label:words?.label || '',value:words?.value || '',answer:f.answer}]);
  }
  const texts = new Map((textResult.data as unknown as Translation[]).map(z=>[z.zone_id,z]));
  const profiles = new Map((profileResult.data as unknown as Profile[]).map(z=>[z.zone_id,z]));
  const media = new Map((mediaResult.data as unknown as Media[]).filter(p=>p.zone_id).map(p=>[p.zone_id,p]));
  // A new translation starts from an existing guide's active steps, not retained zone history.
  const sourceGuide = guideResult.data ? guideResult : await supabase.from('guides').select('id')
    .eq('place_id',id).eq('organization_id',org).neq('status','archived').order('created_at').limit(1).maybeSingle();
  if (sourceGuide.error) throw new Error('workspace-unavailable');
  const stepResult = sourceGuide.data ? await supabase.from('guide_steps').select('zone_id,optional,draft_position')
    .eq('guide_id',sourceGuide.data.id).eq('organization_id',org).eq('active',true).order('draft_position').order('sort_order') : null;
  if (stepResult?.error) throw new Error('workspace-unavailable');
  const allZones = zonesResult.data as unknown as {id:string;type:string;sort_order:number;hidden_fields?:RemovableField[]}[];
  const zoneMap = new Map(allZones.map(z=>[z.id,z]));
  const ordered = stepResult ? (stepResult.data || []).map(s=>({zone:zoneMap.get(s.zone_id),optional:s.optional})).filter(s=>s.zone) : allZones.map(z=>({zone:z,optional:false}));
  const draft: PlaceDraft = {
    id,revision:Number(row.revision),name:translation.data?.name || '',city:row.city,address:row.address,
    countryCode:row.country_code || '',placeType:row.place_type as PlaceDraft['placeType'],
    description:translation.data?.short_description || '',arrivalInfo:translation.data?.arrival_info || '',
    zones:ordered.map(({zone,optional})=>{
      const z=zone!;const t=texts.get(z.id);const p=profiles.get(z.id);const image=media.get(z.id);
      return {id:z.id,type:z.type,title:t?.title || '',description:t?.description || '',note:t?.useful_note || '',next:t?.next_step || '',optional,hidden:z.hidden_fields || [],fields:ownFields.get(z.id) || [],
        sensory:p ? {sound:p.sound_level,light:p.light_level,crowding:p.crowding_level,smell:p.smell_level,temperature:p.temperature_level,visual:p.visual_complexity_level} : newZone().sensory,
        photo:image ? {id:image.id,storageKey:image.storage_key,alt:image.alt_text[locale] || '',rights:image.rights,photographedOn:image.photographed_on || ''} : undefined};
    }),
  };
  if (!draft.zones.length) draft.zones=[newZone()];
  return {org,draft,fieldsEnabled,persistedZoneIds:allZones.map(z=>z.id),missingTranslation:!translation.data || draft.zones.some(z=>!z.title || !z.description || z.fields.some(f=>!f.label))};
}
