-- A guide needs one step, not three (brief docs/briefs/2026-10-27-no-step-minimum.md). A language goes live when it has a name and at
-- least one step that is complete in it; steps that are not complete in that language (no name or description, or an own field without a
-- name) are left out of that language's guide, and the publish box says how many. The most a location can have stays 8. Photos only
-- need a description on steps that are in the guide. Apply ONLY to the VIANORAE project, after the Explore listing migration (2026-10-27).
begin;
do $$ begin
 if to_regprocedure('public.explore_listing_schema_version()') is null then
  raise exception 'STOP: the VIANORAE Explore listing migration must already be installed';
 end if;
end $$;

-- The stored guide itself also had to have 3 to 8 steps: now 1 to 8. Only the lower bound changes, so every guide already stored still passes.
alter table public.guide_versions drop constraint guide_versions_content_check;
alter table public.guide_versions add constraint guide_versions_content_check check(jsonb_typeof(content)='object' and content ? 'source_level'
 and content ? 'zones' and content->>'source_level'='venue_provided' and jsonb_typeof(content->'zones')='array' and jsonb_array_length(content->'zones') between 1 and 8);

-- One definition of "this step has its words in this language", used by the check and by what visitors are given.
create function private.step_complete(p_zone uuid, p_lang text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zone_translations zt where zt.zone_id=p_zone and zt.locale=p_lang and btrim(zt.title)<>'' and btrim(zt.description)<>'')
  and not exists(select 1 from public.zone_fields f where f.zone_id=p_zone and f.active
   and not exists(select 1 from public.zone_field_translations ft where ft.field_id=f.id and ft.locale=p_lang and btrim(ft.label)<>''));
$$;
revoke all on function private.step_complete(uuid,text) from public;
grant execute on function private.step_complete(uuid,text) to authenticated;

create or replace function public.publication_check(org uuid, place uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb:='[]'; lang text; g uuid; g_status public.record_status; steps integer; included integer; missing_text integer; missing_alt integer; has_name boolean;
begin
 if org is null or place is null or not private.has_role(org,array['owner','admin','editor']::public.organization_role[]) then
  raise exception 'Organisation editing is not allowed' using errcode='42501';
 end if;
 foreach lang in array array['en','ro','de'] loop
  select gd.id,gd.status into g,g_status from public.guides gd where gd.place_id=place and gd.organization_id=org and gd.locale=lang;
  if g is null then
   result:=result||jsonb_build_array(jsonb_build_object('locale',lang,'started',false,'ready',false,'published',false,'steps',0,'includedSteps',0,'missingText',0,'missingAlt',0,'hasName',false));
   continue;
  end if;
  select count(*) into steps from public.guide_steps s join public.zones z on z.id=s.zone_id
   where s.guide_id=g and s.active and z.status<>'archived';
  select count(*) into missing_text from public.guide_steps s join public.zones z on z.id=s.zone_id
   where s.guide_id=g and s.active and z.status<>'archived' and not private.step_complete(z.id,lang);
  included:=steps-missing_text;
  select count(*) into missing_alt from public.guide_steps s join public.zones z on z.id=s.zone_id
   join public.media_assets m on m.zone_id=z.id and m.active
   where s.guide_id=g and s.active and z.status<>'archived' and not 'photo'=any(z.hidden_fields) and private.step_complete(z.id,lang) and coalesce(btrim(m.alt_text->>lang),'')='';
  select exists(select 1 from public.place_translations pt where pt.place_id=place and pt.locale=lang and btrim(pt.name)<>'') into has_name;
  result:=result||jsonb_build_array(jsonb_build_object('locale',lang,'started',true,'published',g_status='published',
   'ready',has_name and included>=1 and steps<=8 and missing_alt=0,
   'steps',steps,'includedSteps',included,'missingText',missing_text,'missingAlt',missing_alt,'hasName',has_name));
  g:=null;
 end loop;
 return result;
end $$;

create or replace function private.guide_snapshot(guide uuid, place uuid, org uuid, lang text, guide_address text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'source_level','venue_provided','locale',lang,'slug',guide_address,
  'name',pt.name,'description',pt.short_description,'arrival',pt.arrival_info,
  'city',p.city,'address',p.address,'place_type',p.place_type,
  'zones',(select coalesce(jsonb_agg(step.content order by step.position),'[]'::jsonb) from (
   select s.draft_position as position, jsonb_build_object(
    'id',z.id,'title',zt.title,'description',zt.description,
    'note',case when 'note'=any(z.hidden_fields) then '' else zt.useful_note end,
    'next',case when 'next'=any(z.hidden_fields) then '' else zt.next_step end,
    'optional',s.optional and not 'optional'=any(z.hidden_fields),
    'sensory',jsonb_build_object(
     'sound',coalesce(sp.sound_level,'unknown'),'light',coalesce(sp.light_level,'unknown'),'crowding',coalesce(sp.crowding_level,'unknown'),
     'smell',coalesce(sp.smell_level,'unknown'),'temperature',coalesce(sp.temperature_level,'unknown'),'visual',coalesce(sp.visual_complexity_level,'unknown')),
    'photo',case when 'photo'=any(z.hidden_fields) or m.id is null then null
     else jsonb_build_object('key',m.storage_key,'alt',m.alt_text->>lang,'rights',m.rights,'photographedOn',m.photographed_on) end,
    'fields',coalesce((select jsonb_agg(jsonb_build_object('label',ft.label,'kind',f.kind,'value',ft.value,'answer',f.answer) order by f.sort_order)
     from public.zone_fields f join public.zone_field_translations ft on ft.field_id=f.id and ft.locale=lang
     where f.zone_id=z.id and f.active and ((f.kind='text' and btrim(ft.value)<>'') or (f.kind='yes_no' and f.answer<>'unanswered'))),'[]'::jsonb)
   ) as content
   from public.guide_steps s
   join public.zones z on z.id=s.zone_id and z.status<>'archived'
   join public.zone_translations zt on zt.zone_id=z.id and zt.locale=lang
   left join public.sensory_profiles sp on sp.zone_id=z.id
   left join public.media_assets m on m.zone_id=z.id and m.active
   where s.guide_id=guide and s.active and private.step_complete(z.id,lang)
  ) step))
 from public.places p join public.place_translations pt on pt.place_id=p.id and pt.locale=lang
 where p.id=place and p.organization_id=org;
$$;

create function public.one_step_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.one_step_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
