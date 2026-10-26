-- A platform administrator visits an organisation (brief docs/briefs/2026-10-26-superadmin-visits-organisation.md).
-- Until now private.has_role() let ANY platform administrator act as an owner of ANY organisation. From here a platform administrator
-- has no access to an organisation's content until they start a visit, and during a visit they act as an admin: they may correct
-- what is there and take a guide down, never publish, create a location, add a step or manage members. Every change is written to
-- organization_change_log, which the organisation reads. Apply ONLY to the VIANORAE project, after the payments migration (2026-10-18).
begin;
do $$ begin
 if to_regprocedure('public.payments_schema_version()') is null then
  raise exception 'STOP: the VIANORAE payments migration must already be installed';
 end if;
end $$;

-- 1. The visit: one row per platform administrator, for one organisation, valid for eight hours.
create table private.admin_visits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 started_at timestamptz not null default now()
);
revoke all on private.admin_visits from public,anon,authenticated;

create function private.visiting(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select org is not null and private.is_platform_admin() and exists(select 1 from private.admin_visits v
  where v.user_id=(select auth.uid()) and v.organization_id=org and v.started_at>now()-interval '8 hours');
$$;
revoke all on function private.visiting(uuid) from public,anon;
grant execute on function private.visiting(uuid) to authenticated;

-- 2. Access. A platform administrator passes only while visiting, and only as an admin: roles that exclude admin and editor
-- (owner-only policies: members, organisation details) stay closed to them.
create or replace function private.has_role(org uuid, roles public.organization_role[])
returns boolean language sql stable security definer set search_path='' as $$
 select private.organization_approved(org) and exists(select 1 from auth.users u where u.id=(select auth.uid())
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) and private.second_factor_ok() and
 (exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=(select auth.uid()) and m.role=any(roles))
 or (('admin'::public.organization_role=any(roles) or 'editor'::public.organization_role=any(roles)) and private.visiting(org)));
$$;

-- The problem-reports page names organisations and places for every report without a visit.
create policy org_platform_read on public.organizations for select to authenticated using((select private.is_platform_admin()));
create policy place_translations_platform_read on public.place_translations for select to authenticated using((select private.is_platform_admin()));

-- 3. Starting, ending and reading the visit.
create function public.start_organisation_visit(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select o.name into v_name from public.organizations o where o.id=org and o.approval_status='approved';
 if not found then raise exception 'Organisation is not available' using errcode='42501'; end if;
 insert into private.admin_visits(user_id,organization_id,started_at) values((select auth.uid()),org,now())
  on conflict(user_id) do update set organization_id=excluded.organization_id,started_at=excluded.started_at;
 return jsonb_build_object('organisation',org,'name',v_name);
end $$;
revoke all on function public.start_organisation_visit(uuid) from public,anon;
grant execute on function public.start_organisation_visit(uuid) to authenticated;

create function public.end_organisation_visit() returns boolean language plpgsql security definer set search_path='' as $$
declare v_rows integer;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 delete from private.admin_visits where user_id=(select auth.uid());
 get diagnostics v_rows=row_count;
 return v_rows>0;
end $$;
revoke all on function public.end_organisation_visit() from public,anon;
grant execute on function public.end_organisation_visit() to authenticated;

-- The visit in progress, or null. Anyone who is not a platform administrator gets null, never an error.
create function public.current_organisation_visit() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organisation',o.id,'name',o.name,'started_at',v.started_at)
 from private.admin_visits v join public.organizations o on o.id=v.organization_id
 where v.user_id=(select auth.uid()) and private.visiting(v.organization_id);
$$;
revoke all on function public.current_organisation_visit() from public,anon;
grant execute on function public.current_organisation_visit() to authenticated;

-- 4. What a visit may never do, whatever the caller sends. New rows reach these tables only through save_place_draft, which checks
-- first that nothing is added (check_visit_draft) and then switches on the flag these triggers look for. Publishing is refused by
-- the places and guide_versions triggers, which every publish passes through.
create function private.visit_no_new_content() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if private.visiting(new.organization_id) and coalesce(current_setting('vianorae.visit_save',true),'')<>'on' then
  raise exception 'A platform administrator cannot add content' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.visit_no_new_content() from public;
create trigger places_visit_no_new before insert on public.places for each row execute function private.visit_no_new_content();
create trigger place_translations_visit_no_new before insert on public.place_translations for each row execute function private.visit_no_new_content();
create trigger zones_visit_no_new before insert on public.zones for each row execute function private.visit_no_new_content();
create trigger zone_translations_visit_no_new before insert on public.zone_translations for each row execute function private.visit_no_new_content();
create trigger zone_fields_visit_no_new before insert on public.zone_fields for each row execute function private.visit_no_new_content();
create trigger zone_field_translations_visit_no_new before insert on public.zone_field_translations for each row execute function private.visit_no_new_content();
create trigger sensory_profiles_visit_no_new before insert on public.sensory_profiles for each row execute function private.visit_no_new_content();
create trigger guides_visit_no_new before insert on public.guides for each row execute function private.visit_no_new_content();
create trigger guide_steps_visit_no_new before insert on public.guide_steps for each row execute function private.visit_no_new_content();
create trigger media_assets_visit_no_new before insert on public.media_assets for each row execute function private.visit_no_new_content();

create function private.visit_no_publish() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if private.visiting(new.organization_id) and (new.status='published' and old.status is distinct from 'published'
   or new.slug is distinct from old.slug or new.published_revision is distinct from old.published_revision) then
  raise exception 'A platform administrator cannot publish' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.visit_no_publish() from public;
create trigger places_visit_no_publish before update on public.places for each row execute function private.visit_no_publish();

-- Every publish writes a new guide version.
create function private.visit_no_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if private.visiting(new.organization_id) then
  raise exception 'A platform administrator cannot publish' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.visit_no_version() from public;
create trigger guide_versions_visit_no_version before insert on public.guide_versions for each row execute function private.visit_no_version();

-- What a saved draft may contain during a visit: the same location, the same steps, a language that already has a guide, and no
-- own fields that do not exist yet.
create function private.check_visit_draft(org uuid, place uuid, content_locale text, step_ids uuid[], field_ids uuid[]) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_steps uuid[];
begin
 if not exists(select 1 from public.places p where p.id=place and p.organization_id=org) then
  raise exception 'A platform administrator cannot create a location' using errcode='42501';
 end if;
 if not exists(select 1 from public.guides g where g.place_id=place and g.organization_id=org and g.locale=content_locale) then
  raise exception 'A platform administrator cannot add a language' using errcode='42501';
 end if;
 -- The steps the editor shows are the active ones of this language's guide; a step the organisation removed stays in the table, switched off.
 select coalesce(array_agg(gs.zone_id),'{}') into v_steps from public.guide_steps gs join public.guides g on g.id=gs.guide_id
  where g.place_id=place and g.organization_id=org and g.locale=content_locale and gs.active;
 if not (step_ids@>v_steps and step_ids<@v_steps) then
  raise exception 'A platform administrator cannot add or remove steps' using errcode='42501';
 end if;
 if exists(select 1 from unnest(field_ids) f where not exists(select 1 from public.zone_fields zf where zf.id=f and zf.place_id=place and zf.organization_id=org)) then
  raise exception 'A platform administrator cannot add fields' using errcode='42501';
 end if;
end $$;
revoke all on function private.check_visit_draft(uuid,uuid,text,uuid[],uuid[]) from public,anon;
grant execute on function private.check_visit_draft(uuid,uuid,text,uuid[],uuid[]) to authenticated;

-- 5. The change log: one row per changed record, written only during a visit, read by the organisation's owners and admins.
create table public.organization_change_log (
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 place_id uuid,
 entity_type text not null,
 entity_id text not null,
 action text not null check(action in ('edit','add','take_down')),
 changes jsonb not null check(jsonb_typeof(changes)='object'),
 created_at timestamptz not null default now()
);
create index organization_change_log_org_time_idx on public.organization_change_log(organization_id,created_at desc);
alter table public.organization_change_log enable row level security;
revoke all on public.organization_change_log from public,anon,authenticated;

create function private.log_visit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_new jsonb:=to_jsonb(new); v_changes jsonb; v_place uuid; v_action text:='edit'; v_noise text[]:=array['updated_at','revision','published_revision','created_at','id','organization_id','place_id','zone_id','guide_id','field_id'];
begin
 if not private.visiting(new.organization_id) then return new; end if;
 if tg_op='UPDATE' then
  select coalesce(jsonb_object_agg(n.key,jsonb_build_object('from',o.value,'to',n.value)),'{}'::jsonb) into v_changes
   from jsonb_each(v_new) n join jsonb_each(to_jsonb(old)) o using(key) where n.value is distinct from o.value and n.key<>all(v_noise);
 else
  v_action:='add';
  select coalesce(jsonb_object_agg(n.key,jsonb_build_object('to',n.value)),'{}'::jsonb) into v_changes from jsonb_each(v_new) n where n.key<>all(v_noise);
 end if;
 if v_changes='{}'::jsonb then return new; end if;
 if tg_table_name='places' and v_changes ? 'status' and v_changes#>>'{status,to}'='draft' and v_changes#>>'{status,from}'='published' then v_action:='take_down'; end if;
 v_place:=case when tg_table_name='places' then (v_new->>'id')::uuid else (v_new->>'place_id')::uuid end;
 insert into public.organization_change_log(organization_id,actor_id,place_id,entity_type,entity_id,action,changes)
  values(new.organization_id,(select auth.uid()),v_place,tg_table_name,coalesce(v_new->>'id',concat_ws('/',v_new->>'zone_id',v_new->>'field_id',v_new->>'place_id',v_new->>'locale')),v_action,v_changes);
 return new;
end $$;
revoke all on function private.log_visit_change() from public;
create trigger places_visit_log after insert or update on public.places for each row execute function private.log_visit_change();
create trigger place_translations_visit_log after insert or update on public.place_translations for each row execute function private.log_visit_change();
create trigger zones_visit_log after insert or update on public.zones for each row execute function private.log_visit_change();
create trigger zone_translations_visit_log after insert or update on public.zone_translations for each row execute function private.log_visit_change();
create trigger zone_fields_visit_log after insert or update on public.zone_fields for each row execute function private.log_visit_change();
create trigger zone_field_translations_visit_log after insert or update on public.zone_field_translations for each row execute function private.log_visit_change();
create trigger sensory_profiles_visit_log after insert or update on public.sensory_profiles for each row execute function private.log_visit_change();
create trigger media_assets_visit_log after insert or update on public.media_assets for each row execute function private.log_visit_change();

-- The log as the organisation reads it. The person's address is shown only to a platform administrator; the organisation sees that
-- NERUMA made the change (the `by` is null).
create function public.organisation_change_log(org uuid, p_limit integer default 100) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if org is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) then
  raise exception 'Only owners and admins can read the change log' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.at desc,x.id desc) from (
  select l.id,l.created_at as at,l.entity_type as entity,l.place_id,
   (select pt.name from public.place_translations pt where pt.place_id=l.place_id order by (pt.locale='en') desc,pt.locale limit 1) as place_name,
   l.action,l.changes,case when private.is_platform_admin() then (select u.email from auth.users u where u.id=l.actor_id) end as by
  from public.organization_change_log l where l.organization_id=org order by l.created_at desc,l.id desc limit least(greatest(coalesce(p_limit,100),1),200)) x),'[]'::jsonb);
end $$;
revoke all on function public.organisation_change_log(uuid,integer) from public,anon;
grant execute on function public.organisation_change_log(uuid,integer) to authenticated;

-- 6. save_place_draft, as before (2026-10-11) with one addition: during a visit it checks that nothing is added, then lets the
-- rows it writes through.
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
 -- A platform administrator visiting this organisation may correct what is there, never add to it (brief 2026-10-26).
 if private.visiting(org) then
  perform private.check_visit_draft(org,place,content_locale,ids,field_ids);
  perform set_config('vianorae.visit_save','on',true);
 end if;
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

create function public.platform_visit_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.platform_visit_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
