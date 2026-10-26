import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Locale } from './i18n';
import { confirmedUser, createClient, type SupabaseClient } from './supabase/server';
import { authConfigured } from './supabase/config';
import { newZone, placeAttention, uuidPattern, type OwnField, type PlaceDraft, type PlaceSummary, type RemovableField } from './workspace';
import type { SensoryProfile } from './demo';
import { publishingReady, stepFieldsReady, verificationReady } from './verification-server';
import type { Publication } from './publishing';
import { getViewer } from './viewer-server';
import { isOrganisationRole } from './roles';
import { requireSecondFactor } from './two-factor-server';

export const workspaceConfigured = () => authConfigured() && process.env.VIANORAE_WORKSPACE_ENABLED === '1';
// Cached per request: the shell and the page both ask for the session, and it is only fetched once.
export const workspaceSession = cache(async (locale: Locale) => {
  if (!authConfigured()) redirect(`/${locale}/login`);
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  if(!await verificationReady(supabase)) redirect(`/${locale}/account`);
  const twoFactor = await requireSecondFactor(supabase, locale);
  const viewer = await getViewer(supabase, user.id);
  if (!viewer) throw new Error('workspace-unavailable');
  // A platform administrator reaches an organisation only through a visit (brief 2026-10-26): they see that one organisation, as an admin.
  const visit = viewer.isPlatformAdmin ? await currentVisit(supabase) : null;
  const memberships = visit && !viewer.memberships.some(m => m.organisation === visit.organisation)
    ? [...viewer.memberships, { organisation: visit.organisation, name: visit.name, role: 'admin' as const }]
    : viewer.memberships;
  const organisations = memberships.map(m => ({ id: m.organisation, name: m.name }));
  if(!organisations.length) redirect(viewer.isPlatformAdmin ? `/${locale}/admin` : `/${locale}/account`);
  return { supabase, user, organisations, memberships, twoFactor, visit };
});

export type Visit = { organisation: string; name: string };
/** The organisation the signed-in platform administrator is visiting, or null. The database answers only for an administrator with the second factor. */
export async function currentVisit(supabase: SupabaseClient): Promise<Visit | null> {
  try {
    const { data, error } = await supabase.rpc('current_organisation_visit');
    if (error || !data || typeof data !== 'object') return null;
    const { organisation, name } = data as { organisation?: unknown; name?: unknown };
    return typeof organisation === 'string' && uuidPattern.test(organisation) && typeof name === 'string' ? { organisation, name } : null;
  } catch {
    return null;
  }
}

/** How the signed-in person reaches an organisation: their own role, or 'visitor' for a platform administrator on a visit there. */
export async function organisationAccess(supabase: SupabaseClient, userId: string, org: string): Promise<'owner' | 'admin' | 'visitor' | null> {
  const role = await supabase.from('organization_members').select('role').eq('user_id', userId).eq('organization_id', org).maybeSingle();
  if (role.error) return null;
  if (role.data) return isOrganisationRole(role.data.role) ? role.data.role : null;
  return (await currentVisit(supabase))?.organisation === org ? 'visitor' : null;
}

export async function listPlaces(supabase: SupabaseClient, org: string, locale: Locale): Promise<PlaceSummary[]> {
  // Before the publishing migration these columns and the QR table link don't exist: read without them.
  const publishing = await publishingReady(supabase);
  const base = 'id,city,address,status,revision,updated_at,place_translations(name,locale),zones(id,status,sort_order),media_assets(zone_id,storage_key,alt_text,active)' as const;
  const withPublishing = 'id,city,address,status,revision,updated_at,slug,published_revision,qr_redirects(public_code),place_translations(name,locale),zones(id,status,sort_order),media_assets(zone_id,storage_key,alt_text,active)';
  // The extra columns are read through `live` below, so the result is typed by the base select.
  const { data, error } = await supabase.from('places').select((publishing ? withPublishing : base) as typeof base)
    .eq('organization_id',org).neq('status','archived').order('updated_at',{ascending:false}).limit(100);
  if (error) throw new Error('workspace-unavailable');
  // A step's text hangs off the step, not the place, so it has no direct link to a place to embed through: read it on its own.
  const ids = (data || []).map(row => row.id as string);
  const written = ids.length ? await supabase.from('zone_translations').select('zone_id,place_id,title,description,locale').in('place_id',ids).eq('locale',locale) : {data:[],error:null};
  if (written.error) throw new Error('workspace-unavailable');
  const stepTexts = (written.data || []) as {zone_id:string;place_id:string;title:string;description:string;locale:string}[];
  return (data || []).map(row => {
    const translations = row.place_translations as {name:string;locale:string}[];
    const current = translations.find(t=>t.locale===locale);
    const fallback = translations[0];
    const steps = (row.zones as {id:string;status:string;sort_order:number}[]).filter(z=>z.status!=='archived').sort((a,b)=>a.sort_order-b.sort_order);
    const texts = stepTexts.filter(t=>t.place_id===row.id);
    const photos = (row.media_assets as {zone_id:string|null;storage_key:string;alt_text:Record<string,string>;active:boolean}[]).filter(p=>p.active);
    const firstPhoto = steps.map(s=>photos.find(p=>p.zone_id===s.id)).find(Boolean);
    const live = row as unknown as {slug?:string;published_revision?:number|string|null;qr_redirects?:{public_code:string}[]};
    const unpublished = publishing && row.status==='published' && live.published_revision!=null && Number(row.revision)>Number(live.published_revision);
    return {id:row.id,city:row.city,address:row.address || '',status:row.status,revision:Number(row.revision),updatedAt:row.updated_at,
      qrCode:live.qr_redirects?.[0]?.public_code,slug:publishing && live.slug && !live.slug.startsWith('place-') ? live.slug : undefined,
      name:current?.name || (fallback ? `${fallback.name} (${fallback.locale.toUpperCase()})` : row.city),
      photoKey:firstPhoto?.storage_key,
      attention:[...placeAttention(steps.map(s=>({id:s.id,hasText:texts.some(t=>t.zone_id===s.id && t.title.trim()!=='' && t.description.trim()!=='')})),photos.map(p=>({zoneId:p.zone_id,alt:p.alt_text[locale] || ''}))),...(unpublished ? ['unpublishedChanges' as const] : [])]};
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
  // Publishing state, once the 2026-10-13 migration exists: whether it is live, and at which address.
  let publication: Publication | undefined;
  if (await publishingReady(supabase)) {
    const live = await supabase.from('places').select('status,slug').eq('id',id).maybeSingle();
    if (!live.error && live.data) publication = {published:live.data.status==='published',slug:live.data.slug.startsWith('place-') ? undefined : live.data.slug};
  }
  return {org,draft,fieldsEnabled,publication,persistedZoneIds:allZones.map(z=>z.id),missingTranslation:!translation.data || draft.zones.some(z=>!z.title || !z.description || z.fields.some(f=>!f.label))};
}
