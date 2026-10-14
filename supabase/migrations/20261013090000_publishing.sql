-- Publishing (brief docs/briefs/2026-10-13-publishing.md). Additive only: nothing is deleted.
-- A guide goes live straight away, every complete language at once; one QR code per place, made at the first publish
-- and kept forever. Visitors read published snapshots only, through the functions at the end.
-- Apply ONLY to the VIANORAE project, after the problem reports migration (2026-10-12).
begin;
do $$ begin
 if to_regprocedure('public.step_fields_schema_version()') is null or to_regclass('public.problem_reports') is null then
  raise exception 'STOP: the VIANORAE step fields and problem reports migrations must already be installed';
 end if;
end $$;

-- The saved revision that is live, and the responsibility statement each published version was made under.
alter table public.places add column published_revision bigint check(published_revision is null or published_revision>=0);
alter table public.guide_versions add column responsibility_version text not null default '' check(length(responsibility_version)<=40);

-- One QR code per place (not per language), never moved to another place and never changed.
alter table public.qr_redirects alter column guide_id drop not null;
alter table public.qr_redirects add column created_at timestamptz not null default now();
alter table public.qr_redirects add constraint qr_redirects_place_fk foreign key(place_id,organization_id) references public.places(id,organization_id);
create unique index qr_redirects_place_idx on public.qr_redirects(place_id);
drop policy qr_redirects_update on public.qr_redirects;
revoke update on public.qr_redirects from authenticated;

-- A published address never changes, and only owners and admins change what is public about a place.
create function private.protect_place_publication() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.slug is distinct from old.slug and old.slug !~ '^place-' then
  raise exception 'A published address never changes' using errcode='42501';
 end if;
 if auth.uid() is not null and not private.has_role(new.organization_id,array['owner','admin']::public.organization_role[])
   and (new.slug is distinct from old.slug or new.status is distinct from old.status or new.published_revision is distinct from old.published_revision) then
  raise exception 'Only owners and admins can publish' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.protect_place_publication() from public;
create trigger places_publication before update on public.places for each row execute function private.protect_place_publication();

-- `The Willow Museum` in `Cluj` becomes `the-willow-museum-cluj`: plain letters, digits and single hyphens.
create function private.slug_text(value text) returns text language sql immutable set search_path='' as $$
 -- Cut to 60 first, then trim again: a cut can land just after a hyphen, and an address that ends in one can't be opened.
 select coalesce(nullif(btrim(left(btrim(regexp_replace(
  translate(replace(replace(replace(replace(lower(coalesce(value,'')),'ß','ss'),'ä','ae'),'ö','oe'),'ü','ue'),
   'ăâîșşțţáàéèêíóôúçñ','aaissttaaeeeiooucn'),
  '[^a-z0-9]+','-','g'),'-'),60),'-'),''),'guide');
$$;
revoke all on function private.slug_text(text) from public;
grant execute on function private.slug_text(text) to authenticated;
-- Addresses are unique across organisations, which a member can't see through RLS.
create function private.slug_taken(candidate text, place uuid) returns boolean language sql stable security definer set search_path='' as $$
 -- `willow-museum` is the example guide's address in the app, so no real place gets it.
 select candidate='willow-museum' or exists(select 1 from public.places p where p.slug=candidate and p.id<>place);
$$;
revoke all on function private.slug_taken(text,uuid) from public;
grant execute on function private.slug_taken(text,uuid) to authenticated;

-- Which languages could go live now, and why the others can't. Invoker: the caller must be able to read the place.
-- A language is ready when it was saved, has a name, 3 to 8 steps that all have a name and a description, every shown
-- photo has its description in that language, and every own field has a name in it.
create function public.publication_check(org uuid, place uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb:='[]'; lang text; g uuid; g_status public.record_status; steps integer; missing_text integer; missing_alt integer; has_name boolean;
begin
 if org is null or place is null or not private.has_role(org,array['owner','admin','editor']::public.organization_role[]) then
  raise exception 'Organisation editing is not allowed' using errcode='42501';
 end if;
 foreach lang in array array['en','ro','de'] loop
  select gd.id,gd.status into g,g_status from public.guides gd where gd.place_id=place and gd.organization_id=org and gd.locale=lang;
  if g is null then
   result:=result||jsonb_build_array(jsonb_build_object('locale',lang,'started',false,'ready',false,'published',false,'steps',0,'missingText',0,'missingAlt',0,'hasName',false));
   continue;
  end if;
  select count(*) into steps from public.guide_steps s join public.zones z on z.id=s.zone_id
   where s.guide_id=g and s.active and z.status<>'archived';
  select count(*) into missing_text from public.guide_steps s join public.zones z on z.id=s.zone_id
   where s.guide_id=g and s.active and z.status<>'archived' and (
    not exists(select 1 from public.zone_translations zt where zt.zone_id=z.id and zt.locale=lang and btrim(zt.title)<>'' and btrim(zt.description)<>'')
    or exists(select 1 from public.zone_fields f where f.zone_id=z.id and f.active
     and not exists(select 1 from public.zone_field_translations ft where ft.field_id=f.id and ft.locale=lang and btrim(ft.label)<>'')));
  select count(*) into missing_alt from public.guide_steps s join public.zones z on z.id=s.zone_id
   join public.media_assets m on m.zone_id=z.id and m.active
   where s.guide_id=g and s.active and z.status<>'archived' and not 'photo'=any(z.hidden_fields) and coalesce(btrim(m.alt_text->>lang),'')='';
  select exists(select 1 from public.place_translations pt where pt.place_id=place and pt.locale=lang and btrim(pt.name)<>'') into has_name;
  result:=result||jsonb_build_array(jsonb_build_object('locale',lang,'started',true,'published',g_status='published',
   'ready',has_name and steps between 3 and 8 and missing_text=0 and missing_alt=0,
   'steps',steps,'missingText',missing_text,'missingAlt',missing_alt,'hasName',has_name));
  g:=null;
 end loop;
 return result;
end $$;
revoke all on function public.publication_check(uuid,uuid) from public,anon;
grant execute on function public.publication_check(uuid,uuid) to authenticated;

-- What visitors read: the saved guide in one language, with removed fields left out and own fields only when they say
-- something (the same rule as the editor's preview). Built once at publishing and never changed afterwards.
create function private.guide_snapshot(guide uuid, place uuid, org uuid, lang text, guide_address text) returns jsonb
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
   where s.guide_id=guide and s.active
  ) step))
 from public.places p join public.place_translations pt on pt.place_id=p.id and pt.locale=lang
 where p.id=place and p.organization_id=org;
$$;
revoke all on function private.guide_snapshot(uuid,uuid,uuid,text,text) from public;
grant execute on function private.guide_snapshot(uuid,uuid,uuid,text,text) to authenticated;

-- Publish every ready language of the saved revision the caller saw. Invoker: RLS and the publish triggers still decide.
create function public.publish_place(org uuid, place uuid, expected_revision bigint, responsibility text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 current_revision bigint; v_address text; base text; suffix integer:=1; checks jsonb; item jsonb; live text[]:='{}'; waiting jsonb:='[]';
 lang text; g uuid; next_version integer; code text; inserted integer; title text; town text;
begin
 if org is null or place is null or auth.uid() is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) then
  raise exception 'Only owners and admins can publish' using errcode='42501';
 end if;
 if expected_revision is null or responsibility is null or responsibility !~ '^[0-9a-z-]{1,40}$' then
  raise exception 'Invalid publication' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(place::text,0));
 select p.revision,p.slug,p.city into current_revision,v_address,town from public.places p where p.id=place and p.organization_id=org for update;
 if not found then raise exception 'Place is not available' using errcode='42501'; end if;
 if current_revision<>expected_revision then raise exception 'Draft revision changed' using errcode='40001'; end if;
 checks:=public.publication_check(org,place);
 for item in select value from jsonb_array_elements(checks) loop
  if (item->>'ready')::boolean then live:=array_append(live,item->>'locale');
  elsif (item->>'started')::boolean then waiting:=waiting||jsonb_build_array(item);
  end if;
 end loop;
 if cardinality(live)=0 then raise exception 'No language is ready to publish' using errcode='22023'; end if;
 -- The address is made once, from the name in English when it is published, otherwise the first ready language.
 if v_address ~ '^place-' then
  select pt.name into title from public.place_translations pt
   where pt.place_id=place and pt.locale=case when 'en'=any(live) then 'en' else live[1] end;
  base:=private.slug_text(title||' '||town);
  -- `place-…` is the address every unpublished location carries, and visitors are never served one: a name that begins that way
  -- ("Place des Arts") would be published and unreachable.
  if base ~ '^place-' or base='place' then base:=left('the-'||base,60); base:=btrim(base,'-'); end if;
  v_address:=base;
  while private.slug_taken(v_address,place) loop
   suffix:=suffix+1;
   v_address:=btrim(left(base,55),'-')||'-'||suffix;
  end loop;
 end if;
 update public.places set slug=v_address,status='published',published_revision=current_revision where id=place and organization_id=org;
 foreach lang in array live loop
  select gd.id into g from public.guides gd where gd.place_id=place and gd.organization_id=org and gd.locale=lang;
  select coalesce(max(v.version),0)+1 into next_version from public.guide_versions v where v.guide_id=g;
  insert into public.guide_versions(guide_id,place_id,organization_id,version,content,responsibility_version)
   values(g,place,org,next_version,private.guide_snapshot(g,place,org,lang,v_address),responsibility);
  update public.guides set status='published',current_version=next_version,published_at=now() where id=g;
 end loop;
 -- A short random code, made once. Codes of other organisations aren't visible here, so a clash simply tries again.
 if not exists(select 1 from public.qr_redirects q where q.place_id=place) then
  loop
   code:=left(md5(gen_random_uuid()::text),8);
   insert into public.qr_redirects(public_code,place_id,organization_id) values(code,place,org) on conflict do nothing;
   get diagnostics inserted=row_count;
   exit when inserted=1;
  end loop;
 end if;
 return jsonb_build_object('live',to_jsonb(live),'waiting',waiting,'slug',v_address,'revision',current_revision,
  'code',(select q.public_code from public.qr_redirects q where q.place_id=place));
end $$;
revoke all on function public.publish_place(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.publish_place(uuid,uuid,bigint,text) to authenticated;

-- Take the guide down in every language. The address and the QR code stay, and say the guide isn't available.
create function public.unpublish_place(org uuid, place uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if org is null or place is null or auth.uid() is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) then
  raise exception 'Only owners and admins can unpublish' using errcode='42501';
 end if;
 update public.guides set status='draft' where place_id=place and organization_id=org and status='published';
 update public.places set status='draft' where id=place and organization_id=org;
 return found;
end $$;
revoke all on function public.unpublish_place(uuid,uuid) from public,anon;
grant execute on function public.unpublish_place(uuid,uuid) to authenticated;

-- Visitors. These return published snapshots only, and nothing of a suspended organisation.
create function private.published_locales(place uuid) returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(g.locale order by array_position(array['en','ro','de'],g.locale)),'{}')
 from public.guides g join public.places p on p.id=g.place_id
 where g.place_id=place and g.status='published' and g.current_version is not null and private.organization_approved(p.organization_id);
$$;
revoke all on function private.published_locales(uuid) from public;

-- One published guide by its address: the requested language if it is published, otherwise the first published one.
-- An address that was published once and is down now answers "unavailable"; one never published answers nothing.
create function public.published_guide(guide_address text, lang text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare place uuid; locales text[]; chosen text; content jsonb; published timestamptz;
begin
 if guide_address is null or guide_address ~ '^place-' or guide_address !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return null; end if;
 select p.id into place from public.places p where p.slug=guide_address;
 if place is null then return null; end if;
 locales:=private.published_locales(place);
 if cardinality(locales)=0 then return jsonb_build_object('status','unavailable'); end if;
 chosen:=case when lang=any(locales) then lang else locales[1] end;
 select v.content,g.published_at into content,published from public.guides g
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  where g.place_id=place and g.locale=chosen;
 return jsonb_build_object('status','published','locale',chosen,'locales',to_jsonb(locales),'content',content,'publishedAt',published);
end $$;
revoke all on function public.published_guide(text,text) from public;
grant execute on function public.published_guide(text,text) to anon,authenticated;

-- Explore: every published place, named in the visitor's language when it is published in it.
create function public.published_places(lang text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(entry order by entry->>'name'),'[]'::jsonb) from (
  select jsonb_build_object('slug',p.slug,'locales',to_jsonb(l.locales),'name',v.content->>'name','city',v.content->>'city',
   'placeType',v.content->>'place_type','locale',g.locale,'steps',jsonb_array_length(v.content->'zones')) as entry
  from public.places p
  cross join lateral (select private.published_locales(p.id) as locales) l
  join public.guides g on g.place_id=p.id and g.locale=case when lang=any(l.locales) then lang else l.locales[1] end
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  where cardinality(l.locales)>0 and p.slug !~ '^place-'
 ) published;
$$;
revoke all on function public.published_places(text) from public;
grant execute on function public.published_places(text) to anon,authenticated;

-- A QR code: where it leads, or only that it exists and its guide is down. Never the place's name.
create function public.resolve_qr(code text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare place uuid; v_address text; locales text[];
begin
 if code is null or code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return null; end if;
 select q.place_id,p.slug into place,v_address from public.qr_redirects q join public.places p on p.id=q.place_id where q.public_code=code;
 if place is null then return null; end if;
 locales:=private.published_locales(place);
 if cardinality(locales)=0 then return jsonb_build_object('status','unavailable'); end if;
 return jsonb_build_object('status','published','slug',v_address,'locales',to_jsonb(locales));
end $$;
revoke all on function public.resolve_qr(text) from public;
grant execute on function public.resolve_qr(text) to anon,authenticated;

-- Photos of a current published version are public; every other photo stays private to its organisation.
create function private.published_photo(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.guides g
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  cross join lateral jsonb_array_elements(v.content->'zones') z
  where g.status='published' and private.organization_approved(g.organization_id) and z->'photo'->>'key'=object_name);
$$;
revoke all on function private.published_photo(text) from public;
grant execute on function private.published_photo(text) to anon,authenticated;
create policy vianorae_published_photo_read on storage.objects for select to anon,authenticated
 using(bucket_id='vianorae-private-photos' and private.published_photo(name));

-- The app shows Publish only once this answers 1.
create function public.publishing_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
revoke all on function public.publishing_schema_version() from public;
grant execute on function public.publishing_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
