-- Fields per step (brief docs/briefs/2026-10-11-step-fields.md). Additive only: nothing is deleted.
-- Removed offered fields are listed per zone and stay stored; own fields are a short text or a yes / no question.
-- Apply ONLY to the VIANORAE project, after the online builder migration (2026-10-07).
begin;
do $$ begin
 if to_regprocedure('public.save_place_draft(uuid,uuid,bigint,text,jsonb)') is null then
  raise exception 'STOP: the VIANORAE online builder migration must already be installed';
 end if;
end $$;
alter table public.zones add column hidden_fields text[] not null default '{}'
 check(hidden_fields <@ array['photo','note','next','optional']::text[]);
create table public.zone_fields (
 id uuid primary key default gen_random_uuid(), zone_id uuid not null, place_id uuid not null, organization_id uuid not null,
 kind text not null check(kind in ('text','yes_no')), sort_order integer not null check(sort_order between 0 and 4),
 answer text not null default 'unanswered' check(answer in ('unanswered','yes','no')), active boolean not null default true,
 unique(id,zone_id,place_id,organization_id),
 foreign key(zone_id,place_id,organization_id) references public.zones(id,place_id,organization_id)
);
create index zone_fields_zone_idx on public.zone_fields(zone_id,sort_order);
create index zone_fields_org_idx on public.zone_fields(organization_id);
create table public.zone_field_translations (
 field_id uuid not null, zone_id uuid not null, place_id uuid not null, organization_id uuid not null,
 locale text not null check(locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
 label text not null check(length(label) between 1 and 80), value text not null default '' check(length(value)<=500),
 primary key(field_id,locale),
 foreign key(field_id,zone_id,place_id,organization_id) references public.zone_fields(id,zone_id,place_id,organization_id)
);
create index zone_field_translations_org_idx on public.zone_field_translations(organization_id);
alter table public.zone_fields enable row level security;
revoke all on public.zone_fields from anon, authenticated;
alter table public.zone_field_translations enable row level security;
revoke all on public.zone_field_translations from anon, authenticated;
grant select,insert,update on public.zone_fields,public.zone_field_translations to authenticated;
create policy zone_fields_read on public.zone_fields for select to authenticated using(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy zone_fields_insert on public.zone_fields for insert to authenticated with check(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy zone_fields_update on public.zone_fields for update to authenticated using(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[])) with check(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create trigger zone_fields_tenant before update on public.zone_fields for each row execute function private.keep_tenant();
create trigger zone_fields_audit after insert or update on public.zone_fields for each row execute function private.audit_change();
create policy zone_field_translations_read on public.zone_field_translations for select to authenticated using(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy zone_field_translations_insert on public.zone_field_translations for insert to authenticated with check(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy zone_field_translations_update on public.zone_field_translations for update to authenticated using(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[])) with check(private.has_role(organization_id,array['owner','admin','editor']::public.organization_role[]));
create trigger zone_field_translations_tenant before update on public.zone_field_translations for each row execute function private.keep_tenant();

-- Same signature and checks as before, plus hidden fields and own fields per zone.
create or replace function public.save_place_draft(org uuid, place uuid, expected_revision bigint, content_locale text, draft jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare
 current_revision bigint; next_revision bigint; guide uuid; zone jsonb; photo jsonb; v_zone uuid; asset_id uuid;
 ids uuid[]:='{}'; channel text; level text; position integer:=0; affected integer; photo_day date;
 field jsonb; v_field uuid; field_ids uuid[]:='{}'; field_kind text; field_position integer; hidden text[];
 venue_name text; venue_city text; venue_address text; country text; kind text; summary text; arrival text;
begin
 if org is null or place is null or auth.uid() is null or not private.workspace_editor(org) then
  raise exception 'Organisation editing is not allowed' using errcode='42501';
 end if;
 if expected_revision is null or expected_revision<0 or content_locale is null
   or content_locale not in ('en','ro','de') or jsonb_typeof(draft) is distinct from 'object'
   or pg_column_size(draft)>100000 or jsonb_typeof(draft->'zones') is distinct from 'array' then
  raise exception 'Invalid draft' using errcode='22023';
 end if;
 if jsonb_array_length(draft->'zones') not between 1 and 8 then
  raise exception 'A draft needs one to eight zones' using errcode='22023';
 end if;
 venue_name:=private.draft_text(draft,'name',1,160);
 venue_city:=private.draft_text(draft,'city',1,160);
 venue_address:=private.draft_text(draft,'address',0,500);
 country:=private.draft_text(draft,'countryCode',0,2);
 kind:=private.draft_text(draft,'placeType',1,30);
 summary:=private.draft_text(draft,'description',0,2000);
 arrival:=private.draft_text(draft,'arrivalInfo',0,2000);
 if (country<>'' and country!~'^[A-Z]{2}$') or kind not in ('institution','museum','hotel','cultural','public_service','other') then
  raise exception 'Invalid place details' using errcode='22023';
 end if;
 for zone in select value from jsonb_array_elements(draft->'zones') loop
  if jsonb_typeof(zone) is distinct from 'object' then raise exception 'Invalid zone' using errcode='22023'; end if;
  v_zone:=private.draft_text(zone,'id',36,36)::uuid;
  if v_zone=any(ids) then raise exception 'Duplicate zone' using errcode='22023'; end if;
  ids:=array_append(ids,v_zone);
  perform private.draft_text(zone,'title',1,160),private.draft_text(zone,'description',1,2000),
   private.draft_text(zone,'note',0,2000),private.draft_text(zone,'next',0,2000),private.draft_text(zone,'type',1,60);
  if jsonb_typeof(zone->'optional') is distinct from 'boolean' or jsonb_typeof(zone->'sensory') is distinct from 'object' then
   raise exception 'Invalid zone details' using errcode='22023';
  end if;
  foreach channel in array array['sound','light','crowding','smell','temperature','visual'] loop
   level:=private.draft_text(zone->'sensory',channel,1,20);
   if level not in ('unknown','low','moderate','high','variable') then raise exception 'Invalid sensory level' using errcode='22023'; end if;
  end loop;
  photo:=zone->'photo';
  if photo is not null and photo<>'null'::jsonb then
   if jsonb_typeof(photo) is distinct from 'object' then raise exception 'Invalid photo' using errcode='22023'; end if;
   asset_id:=private.draft_text(photo,'id',36,36)::uuid;
   if private.draft_text(photo,'storageKey',1,180)<>org::text||'/'||place::text||'/'||v_zone::text||'/'||asset_id::text||'.webp' then
    raise exception 'Photo belongs to a different zone' using errcode='42501';
   end if;
   perform private.draft_text(photo,'alt',1,500),private.draft_text(photo,'rights',1,500);
   photo_day:=private.draft_text(photo,'photographedOn',10,10)::date;
   if to_char(photo_day,'YYYY-MM-DD')<>photo->>'photographedOn' or photo_day>current_date then
    raise exception 'Invalid photography date' using errcode='22023';
   end if;
  end if;
  -- Fields an organisation removed from this step (shared by all languages). A draft without the key hides nothing.
  if zone ? 'hidden' and (jsonb_typeof(zone->'hidden') is distinct from 'array' or exists(select 1 from jsonb_array_elements(zone->'hidden') h
    where jsonb_typeof(h) is distinct from 'string' or h#>>'{}' not in ('photo','note','next','optional'))) then
   raise exception 'Invalid hidden fields' using errcode='22023';
  end if;
  -- The organisation's own fields: up to five, a short text or a yes / no question.
  if zone ? 'fields' then
   if jsonb_typeof(zone->'fields') is distinct from 'array' or jsonb_array_length(zone->'fields')>5 then
    raise exception 'A step has up to five own fields' using errcode='22023';
   end if;
   for field in select value from jsonb_array_elements(zone->'fields') loop
    if jsonb_typeof(field) is distinct from 'object' then raise exception 'Invalid field' using errcode='22023'; end if;
    v_field:=private.draft_text(field,'id',36,36)::uuid;
    if v_field=any(field_ids) then raise exception 'Duplicate field' using errcode='22023'; end if;
    field_ids:=array_append(field_ids,v_field);
    field_kind:=private.draft_text(field,'kind',1,10);
    perform private.draft_text(field,'label',1,80);
    if field_kind='text' then
     perform private.draft_text(field,'value',0,500);
    elsif field_kind='yes_no' then
     if private.draft_text(field,'answer',1,12) not in ('unanswered','yes','no') then raise exception 'Invalid answer' using errcode='22023'; end if;
    else
     raise exception 'Invalid field kind' using errcode='22023';
    end if;
   end loop;
  end if;
 end loop;
 -- Serialize attempts to create the same place, including retries after network loss.
 perform pg_advisory_xact_lock(hashtextextended(place::text,0));
 select p.revision into current_revision from public.places p where p.id=place and p.organization_id=org for update;
 if not found then
  if expected_revision<>0 then raise exception 'Draft revision changed' using errcode='40001'; end if;
  insert into public.places(id,organization_id,slug,city,address,country_code,place_type)
   values(place,org,'place-'||place::text,venue_city,venue_address,nullif(country,''),kind) on conflict(id) do nothing;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Place is not available' using errcode='42501'; end if;
  current_revision:=0;
 end if;
 if current_revision<>expected_revision then raise exception 'Draft revision changed' using errcode='40001'; end if;
 insert into public.place_translations(place_id,organization_id,locale,name,short_description,arrival_info)
  values(place,org,content_locale,venue_name,summary,arrival)
  on conflict(place_id,locale) do update set name=excluded.name,short_description=excluded.short_description,arrival_info=excluded.arrival_info;
 insert into public.guides(place_id,organization_id,locale) values(place,org,content_locale)
  on conflict(place_id,locale) do update set locale=excluded.locale returning id into guide;
 update public.guide_steps set active=false where guide_id=guide and organization_id=org;
 -- Shared photos change only for zones present in this language's draft.
 update public.media_assets set active=false where place_id=place and organization_id=org and zone_id=any(ids);
 for zone in select value from jsonb_array_elements(draft->'zones') loop
  v_zone:=(zone->>'id')::uuid;
  select coalesce(array_agg(distinct h order by h),'{}') into hidden from jsonb_array_elements_text(coalesce(zone->'hidden','[]'::jsonb)) h;
  insert into public.zones as existing(id,place_id,organization_id,type,sort_order,hidden_fields)
   values(v_zone,place,org,btrim(zone->>'type'),position,hidden)
   on conflict(id) do update set type=excluded.type,sort_order=excluded.sort_order,hidden_fields=excluded.hidden_fields
    where existing.place_id=place and existing.organization_id=org;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Zone is not available' using errcode='42501'; end if;
  insert into public.zone_translations(zone_id,place_id,organization_id,locale,title,description,useful_note,next_step)
   values(v_zone,place,org,content_locale,btrim(zone->>'title'),btrim(zone->>'description'),btrim(zone->>'note'),btrim(zone->>'next'))
   on conflict(zone_id,locale) do update set title=excluded.title,description=excluded.description,useful_note=excluded.useful_note,next_step=excluded.next_step;
  insert into public.sensory_profiles(zone_id,place_id,organization_id,sound_level,light_level,crowding_level,smell_level,temperature_level,visual_complexity_level)
   values(v_zone,place,org,(zone->'sensory'->>'sound')::public.sensory_level,(zone->'sensory'->>'light')::public.sensory_level,
    (zone->'sensory'->>'crowding')::public.sensory_level,(zone->'sensory'->>'smell')::public.sensory_level,
    (zone->'sensory'->>'temperature')::public.sensory_level,(zone->'sensory'->>'visual')::public.sensory_level)
   on conflict(zone_id) do update set sound_level=excluded.sound_level,light_level=excluded.light_level,
    crowding_level=excluded.crowding_level,smell_level=excluded.smell_level,temperature_level=excluded.temperature_level,visual_complexity_level=excluded.visual_complexity_level;
  insert into public.guide_steps(guide_id,place_id,organization_id,zone_id,sort_order,draft_position,optional,active)
   values(guide,place,org,v_zone,(select coalesce(max(s.sort_order),-1)+1 from public.guide_steps s where s.guide_id=guide),position,(zone->>'optional')::boolean,true)
   on conflict(guide_id,zone_id) do update set draft_position=excluded.draft_position,optional=excluded.optional,active=true;
  -- Own fields: which exist, their order and yes / no answers are shared; label and text are per language.
  -- A field left out of the draft is switched off, never deleted.
  update public.zone_fields set active=false where zone_id=v_zone and organization_id=org;
  field_position:=0;
  for field in select value from jsonb_array_elements(coalesce(zone->'fields','[]'::jsonb)) loop
   v_field:=(field->>'id')::uuid;
   insert into public.zone_fields as existing(id,zone_id,place_id,organization_id,kind,sort_order,answer,active)
    values(v_field,v_zone,place,org,field->>'kind',field_position,case when field->>'kind'='yes_no' then field->>'answer' else 'unanswered' end,true)
    on conflict(id) do update set sort_order=excluded.sort_order,answer=excluded.answer,active=true
     where existing.zone_id=v_zone and existing.place_id=place and existing.organization_id=org and existing.kind=excluded.kind;
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'Field is not available' using errcode='42501'; end if;
   insert into public.zone_field_translations(field_id,zone_id,place_id,organization_id,locale,label,value)
    values(v_field,v_zone,place,org,content_locale,btrim(field->>'label'),case when field->>'kind'='text' then btrim(field->>'value') else '' end)
    on conflict(field_id,locale) do update set label=excluded.label,value=excluded.value;
   field_position:=field_position+1;
  end loop;
  photo:=zone->'photo';
  if photo is not null and photo<>'null'::jsonb then
   asset_id:=(photo->>'id')::uuid;
   if not exists(select 1 from storage.objects o where o.bucket_id='vianorae-private-photos' and o.name=photo->>'storageKey') then
    raise exception 'The photograph must be uploaded first' using errcode='22023';
   end if;
   insert into public.media_assets as existing(id,organization_id,place_id,zone_id,storage_key,alt_text,rights,photographed_on,active)
    values(asset_id,org,place,v_zone,photo->>'storageKey',jsonb_build_object(content_locale,btrim(photo->>'alt')),btrim(photo->>'rights'),(photo->>'photographedOn')::date,true)
    on conflict(id) do update set alt_text=existing.alt_text||excluded.alt_text,rights=excluded.rights,photographed_on=excluded.photographed_on,active=true
     where existing.organization_id=org and existing.place_id=place and existing.zone_id=v_zone and existing.storage_key=excluded.storage_key;
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'Photo is not available' using errcode='42501'; end if;
  end if;
  position:=position+1;
 end loop;
 next_revision:=current_revision+1;
 update public.places set city=venue_city,address=venue_address,country_code=nullif(country,''),place_type=kind,
  revision=next_revision,updated_at=now() where id=place and organization_id=org;
 return next_revision;
end $$;
revoke all on function public.save_place_draft(uuid,uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.save_place_draft(uuid,uuid,bigint,text,jsonb) to authenticated;
-- The app shows the field controls only once this answers 1, so it never saves fields into a database without them.
create function public.step_fields_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
revoke all on function public.step_fields_schema_version() from public;
grant execute on function public.step_fields_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
