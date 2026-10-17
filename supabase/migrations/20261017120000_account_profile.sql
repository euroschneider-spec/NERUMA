-- Account profile page (brief docs/briefs/2026-10-17-account-profile.md): one account in full, for a platform administrator.
-- Read only; nothing is stored. Apply ONLY to the VIANORAE project, after the superadmin migration (2026-10-17).
begin;
do $$ begin
 if to_regprocedure('public.superadmin_schema_version()') is null then
  raise exception 'STOP: the VIANORAE superadmin migration must already be installed';
 end if;
end $$;

-- Null when there is no such account (or it is an anonymous visitor).
create function public.admin_account(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return (select jsonb_build_object(
   'user_id',u.id,'email',u.email,'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'confirmed',u.email_confirmed_at is not null,
   'is_admin',exists(select 1 from private.platform_admins p where p.user_id=u.id),
   'two_factor',exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified'),
   'deletion',(select jsonb_build_object('requested_at',d.requested_at,'delete_after',d.delete_after,'by_administrator',d.requested_by is not null)
     from private.account_deletions d where d.user_id=u.id),
   'organisations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role,'status',o.approval_status) order by o.name),'[]'::jsonb)
     from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=u.id),
   'application',(select jsonb_build_object('status',a.status,'organisation',a.organization_name,'submitted_at',a.submitted_at)
     from public.organization_applications a where a.applicant_id=u.id))
  from auth.users u where u.id=p_user and not coalesce(u.is_anonymous,false));
end $$;
revoke all on function public.admin_account(uuid) from public,anon;
grant execute on function public.admin_account(uuid) to authenticated;

create function public.account_profile_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.account_profile_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
