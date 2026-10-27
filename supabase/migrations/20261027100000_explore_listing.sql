-- Explore is a feature a platform administrator switches on per organisation (brief docs/briefs/2026-10-27-show-in-explore.md).
-- Without it an organisation's places are not in Explore. With it they are listed, and the organisation's owners and admins can
-- switch single locations off ("Show in Explore", on by default). Switching the feature off removes the organisation from Explore and
-- keeps each location's own choice. Every switch is written to the organisation's change log. Guides and QR codes are not affected.
-- Apply ONLY to the VIANORAE project, after the Explore country migration (2026-10-27).
begin;
do $$ begin
 if to_regprocedure('public.platform_visit_schema_version()') is null or to_regprocedure('public.account_profile_schema_version()') is null then
  raise exception 'STOP: the VIANORAE platform-visit and account-profile migrations must already be installed';
 end if;
end $$;

-- 1. The flag on the organisation (nobody but a platform administrator can change it: updates of organisations are revoked) and
-- the choice on each location.
alter table public.organizations add column explore_listing boolean not null default false;
alter table public.places add column show_in_explore boolean not null default true;

-- 2. The change log also records the two switches of the feature. Only the organisation-level rows use these actions.
alter table public.organization_change_log drop constraint organization_change_log_action_check;
alter table public.organization_change_log add constraint organization_change_log_action_check check(action in ('edit','add','take_down','enable','disable'));

-- 3. Only owners and admins change a location's choice, never a platform administrator on a visit, and only while the feature is on.
create function private.protect_explore_choice() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.show_in_explore is distinct from old.show_in_explore and auth.uid() is not null and (
   not private.has_role(new.organization_id,array['owner','admin']::public.organization_role[])
   or private.visiting(new.organization_id)
   or not exists(select 1 from public.organizations o where o.id=new.organization_id and o.explore_listing)) then
  raise exception 'Only owners and admins can change this, and only while Explore is switched on' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.protect_explore_choice() from public;
create trigger places_explore_choice before update on public.places for each row execute function private.protect_explore_choice();

create function public.set_place_explore(org uuid, place uuid, p_shown boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if org is null or place is null or p_shown is null or auth.uid() is null
   or not private.has_role(org,array['owner','admin']::public.organization_role[]) or private.visiting(org) then
  raise exception 'Only owners and admins can change this' using errcode='42501';
 end if;
 if not exists(select 1 from public.organizations o where o.id=org and o.explore_listing) then
  raise exception 'Explore is not switched on for this organisation' using errcode='42501';
 end if;
 update public.places set show_in_explore=p_shown where id=place and organization_id=org;
 return found;
end $$;
revoke all on function public.set_place_explore(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_place_explore(uuid,uuid,boolean) to authenticated;

-- 4. The platform administrator's switch. A change that changes nothing writes nothing.
create function public.set_organisation_explore(org uuid, p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare v_was boolean;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 if org is null or p_enabled is null then raise exception 'Organisation and choice are required' using errcode='22023'; end if;
 select o.explore_listing into v_was from public.organizations o where o.id=org and o.approval_status='approved' for update;
 if not found then raise exception 'Organisation is not available' using errcode='42501'; end if;
 if v_was is distinct from p_enabled then
  update public.organizations set explore_listing=p_enabled where id=org;
  insert into public.organization_change_log(organization_id,actor_id,entity_type,entity_id,action,changes)
   values(org,(select auth.uid()),'explore',org::text,case when p_enabled then 'enable' else 'disable' end,'{}'::jsonb);
 end if;
 return p_enabled;
end $$;
revoke all on function public.set_organisation_explore(uuid,boolean) from public,anon;
grant execute on function public.set_organisation_explore(uuid,boolean) to authenticated;

-- 5. Explore lists what is published AND switched on by the platform AND not hidden by the organisation. Decided here, not in the page.
create or replace function public.published_places(lang text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(entry order by entry->>'name'),'[]'::jsonb) from (
  select jsonb_build_object('slug',p.slug,'locales',to_jsonb(l.locales),'name',v.content->>'name','city',v.content->>'city',
   'countryCode',coalesce(p.country_code,''),
   'placeType',v.content->>'place_type','locale',g.locale,'steps',jsonb_array_length(v.content->'zones')) as entry
  from public.places p
  join public.organizations o on o.id=p.organization_id and o.explore_listing and p.show_in_explore
  cross join lateral (select private.published_locales(p.id) as locales) l
  join public.guides g on g.place_id=p.id and g.locale=case when lang=any(l.locales) then lang else l.locales[1] end
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  where cardinality(l.locales)>0 and p.slug !~ '^place-'
 ) published;
$$;

-- 6. The account page shows, for each organisation, whether Explore is on.
create or replace function public.admin_account(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return (select jsonb_build_object(
   'user_id',u.id,'email',u.email,'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'confirmed',u.email_confirmed_at is not null,
   'is_admin',exists(select 1 from private.platform_admins p where p.user_id=u.id),
   'two_factor',exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified'),
   'deletion',(select jsonb_build_object('requested_at',d.requested_at,'delete_after',d.delete_after,'by_administrator',d.requested_by is not null)
     from private.account_deletions d where d.user_id=u.id),
   'organisations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role,'status',o.approval_status,'explore',o.explore_listing) order by o.name),'[]'::jsonb)
     from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=u.id),
   'application',(select jsonb_build_object('status',a.status,'organisation',a.organization_name,'submitted_at',a.submitted_at)
     from public.organization_applications a where a.applicant_id=u.id))
  from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false));
end $$;

create function public.explore_listing_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.explore_listing_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
