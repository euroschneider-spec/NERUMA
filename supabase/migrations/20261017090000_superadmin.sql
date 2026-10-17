-- Superadmin dashboard (brief docs/briefs/2026-10-17-superadmin-dashboard.md): what waits, who has an account, and who the
-- platform administrators are. Every function refuses anyone who is not a platform administrator with the second factor
-- (private.is_platform_admin()). Apply ONLY to the VIANORAE project, after the account-deletion migration (2026-10-16).
begin;
do $$ begin
 if to_regprocedure('public.account_deletion_schema_version()') is null then
  raise exception 'STOP: the VIANORAE account-deletion migration must already be installed';
 end if;
end $$;

-- 1. The numbers on the dashboard.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return jsonb_build_object(
  'pending_requests',(select count(*) from public.organization_applications a where a.status='pending'),
  'open_reports',(select count(*) from public.problem_reports r where r.status='open'),
  'deletions_in_progress',(select count(*) from private.account_deletions),
  'deletions_due',(select count(*) from private.account_deletions d where now()>=d.delete_after),
  'accounts',(select count(*) from auth.users u where not coalesce(u.is_anonymous,false)),
  'administrators',(select count(*) from private.platform_admins));
end $$;
revoke all on function public.admin_overview() from public,anon;
grant execute on function public.admin_overview() to authenticated;

-- 2. Every account (or only the administrators), newest first, searchable by email. 25 a page by default, never more than 100.
create function public.admin_accounts(p_search text default null, p_limit integer default 25, p_offset integer default 0, p_admins_only boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_pattern text; v_total integer; v_rows jsonb;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 if p_search is not null and length(p_search)>254 then raise exception 'Search is too long' using errcode='22023'; end if;
 v_pattern:='%'||replace(replace(replace(coalesce(trim(p_search),''),'\','\\'),'%','\%'),'_','\_')||'%';
 select count(*) into v_total from auth.users u where not coalesce(u.is_anonymous,false) and coalesce(u.email,'') ilike v_pattern
  and (not coalesce(p_admins_only,false) or exists(select 1 from private.platform_admins p where p.user_id=u.id));
 select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc),'[]'::jsonb) into v_rows from (
  select u.id as user_id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at is not null as confirmed,
   exists(select 1 from private.platform_admins p where p.user_id=u.id) as is_admin,
   exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') as two_factor,
   exists(select 1 from private.account_deletions d where d.user_id=u.id) as deletion_pending,
   (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role) order by o.name),'[]'::jsonb)
     from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=u.id) as organisations
  from auth.users u where not coalesce(u.is_anonymous,false) and coalesce(u.email,'') ilike v_pattern
   and (not coalesce(p_admins_only,false) or exists(select 1 from private.platform_admins p where p.user_id=u.id))
  order by u.created_at desc limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)) x;
 return jsonb_build_object('total',v_total,'rows',v_rows);
end $$;
revoke all on function public.admin_accounts(text,integer,integer,boolean) from public,anon;
grant execute on function public.admin_accounts(text,integer,integer,boolean) to authenticated;

-- 3. Who may administer the platform. Only a confirmed, real, active account can be added. Nobody removes themselves, which also means
-- the last administrator can't be removed: whoever removes someone is an administrator and stays one. The table is locked, and the
-- caller checked again once the lock is held, so two administrators removing each other at the same moment can't leave none.
create function public.add_platform_admin(p_email text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select u.id into v_user from auth.users u where lower(u.email)=lower(trim(coalesce(p_email,''))) and u.email_confirmed_at is not null
  and not coalesce(u.is_anonymous,false) and not exists(select 1 from private.account_deletions d where d.user_id=u.id);
 if v_user is null then raise exception 'No confirmed account with that email' using errcode='22023'; end if;
 insert into private.platform_admins(user_id) values(v_user) on conflict do nothing;
 return found;
end $$;
revoke all on function public.add_platform_admin(text) from public,anon;
grant execute on function public.add_platform_admin(text) to authenticated;

create function public.remove_platform_admin(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 lock table private.platform_admins in exclusive mode;
 if not exists(select 1 from private.platform_admins p where p.user_id=(select auth.uid())) then raise exception 'Platform administrator required' using errcode='42501'; end if;
 if p_user=(select auth.uid()) then raise exception 'You cannot remove yourself' using errcode='22023'; end if;
 delete from private.platform_admins where user_id=p_user;
 return found;
end $$;
revoke all on function public.remove_platform_admin(uuid) from public,anon;
grant execute on function public.remove_platform_admin(uuid) to authenticated;

create function public.superadmin_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.superadmin_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
