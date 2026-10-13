-- Apply ONLY to VIANORAE project ywbcsvswisorlgajbkev, after its foundation.
-- Additive changes only. No accounts, guides or stored files are deleted.
begin;
do $$ begin
 if to_regprocedure('public.create_organisation(text,text,text,boolean,text)') is null
   or to_regclass('public.organization_acknowledgements') is null then
  raise exception 'STOP: the dedicated VIANORAE foundation must already be installed';
 end if;
end $$;
alter table public.places add column revision bigint not null default 0 check(revision>=0);
alter table public.places add column updated_at timestamptz not null default now();
alter table public.zone_translations add column next_step text not null default '' check(length(next_step)<=2000);
alter table public.guide_steps add column active boolean not null default true;
alter table public.guide_steps add column draft_position integer not null default 0 check(draft_position>=0);
update public.guide_steps set draft_position=sort_order;
alter table public.media_assets add column active boolean not null default true;
alter table public.media_assets add column photographed_on date check(photographed_on<=current_date);
create unique index media_assets_active_zone_idx on public.media_assets(zone_id) where active and zone_id is not null;

-- Verified identity is read from Auth, never editable profile metadata.
create function private.workspace_editor(org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
  and private.has_role(org,array['owner','admin','editor']::public.organization_role[]);
$$;
revoke all on function private.workspace_editor(uuid) from public,anon;
grant execute on function private.workspace_editor(uuid) to authenticated;
create function private.draft_text(document jsonb, field text, minimum integer, maximum integer)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare value text;
begin
 if jsonb_typeof(document->field) is distinct from 'string' then
  raise exception 'Invalid draft field' using errcode='22023';
 end if;
 value:=btrim(document->>field);
 if length(value) not between minimum and maximum then
  raise exception 'Invalid draft field length' using errcode='22023';
 end if;
 return value;
end $$;
revoke all on function private.draft_text(jsonb,text,integer,integer) from public,anon;
grant execute on function private.draft_text(jsonb,text,integer,integer) to authenticated;

-- Only valid organisation/place/zone/asset paths are accepted. Cast after validation.
create function private.can_access_workspace_photo(object_name text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare org uuid; place uuid; zone uuid;
begin
 if object_name is null or object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then return false; end if;
 begin
  org:=split_part(object_name,'/',1)::uuid;
  place:=split_part(object_name,'/',2)::uuid;
  zone:=split_part(object_name,'/',3)::uuid;
  perform split_part(split_part(object_name,'/',4),'.',1)::uuid;
 exception when invalid_text_representation then return false;
 end;
 return private.workspace_editor(org) and exists(select 1 from public.zones z
  where z.id=zone and z.place_id=place and z.organization_id=org and z.status<>'archived');
end $$;
revoke all on function private.can_access_workspace_photo(text) from public,anon;
grant execute on function private.can_access_workspace_photo(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vianorae-private-photos','vianorae-private-photos',false,3145728,array['image/webp'])
 on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from storage.buckets where id='vianorae-private-photos'
  and public=false and file_size_limit=3145728 and allowed_mime_types=array['image/webp']) then
  raise exception 'STOP: unexpected configuration for the VIANORAE private photo bucket';
 end if;
end $$;
create policy vianorae_photo_read on storage.objects for select to authenticated
 using(bucket_id='vianorae-private-photos' and private.can_access_workspace_photo(name));
create policy vianorae_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='vianorae-private-photos' and private.can_access_workspace_photo(name));
-- No UPDATE or DELETE policy: replacing a photo creates a new immutable object.

create function public.workspace_schema_version() returns integer
 language sql immutable security invoker set search_path='' as $$ select 1 $$;
revoke all on function public.workspace_schema_version() from public;
grant execute on function public.workspace_schema_version() to anon,authenticated;

-- One transaction and optimistic revision protect complete multilingual drafts.
-- This invoker function retains RLS; it never accepts status, role or publication data.
create function public.save_place_draft(org uuid, place uuid, expected_revision bigint, content_locale text, draft jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare
 current_revision bigint; next_revision bigint; guide uuid; zone jsonb; photo jsonb; v_zone uuid; asset_id uuid;
 ids uuid[]:='{}'; channel text; level text; position integer:=0; affected integer; photo_day date;
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
  insert into public.zones as existing(id,place_id,organization_id,type,sort_order)
   values(v_zone,place,org,btrim(zone->>'type'),position)
   on conflict(id) do update set type=excluded.type,sort_order=excluded.sort_order
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
notify pgrst,'reload schema';
commit;
