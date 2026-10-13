-- Two-factor sign-in (brief docs/briefs/2026-10-13-two-factor-sign-in.md). Additive: nothing is deleted.
-- A session that has not passed the second factor (aal1) loses organisation and administrator access when the account
-- has an authenticator app, or when two-factor is required for it: platform administrators from installation,
-- organisation owners and admins from the date in private.two_factor_policy (30 days after installation).
-- Apply ONLY to the VIANORAE project, after the publishing migration (2026-10-13).
begin;
do $$ begin
 if to_regprocedure('public.publishing_schema_version()') is null then
  raise exception 'STOP: the VIANORAE publishing migration must already be installed';
 end if;
end $$;

-- The one setting. Move the date with:
--   update private.two_factor_policy set organisations_from='2027-01-01 00:00+01';
create table private.two_factor_policy (
 id boolean primary key default true check(id),
 organisations_from timestamptz not null
);
insert into private.two_factor_policy(organisations_from) values(now()+interval '30 days');
revoke all on private.two_factor_policy from public,anon,authenticated;

-- The platform administrator list as before, without the second-factor condition (used to decide whether it applies).
create function private.listed_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.platform_admins p join auth.users u on u.id=p.user_id
 where p.user_id=(select auth.uid()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;
revoke all on function private.listed_platform_admin() from public,anon;
grant execute on function private.listed_platform_admin() to authenticated;

create function private.two_factor_enrolled() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.mfa_factors f where f.user_id=(select auth.uid()) and f.status='verified');
$$;
revoke all on function private.two_factor_enrolled() from public,anon;
grant execute on function private.two_factor_enrolled() to authenticated;

-- The date from which this account must use two-factor, or null when it never has to.
create function private.two_factor_deadline() returns timestamptz
language sql stable security definer set search_path='' as $$
 select case
  when private.listed_platform_admin() then '-infinity'::timestamptz
  when exists(select 1 from public.organization_members m where m.user_id=(select auth.uid())
   and m.role=any(array['owner','admin']::public.organization_role[])) then (select p.organisations_from from private.two_factor_policy p)
 end;
$$;
revoke all on function private.two_factor_deadline() from public,anon;
grant execute on function private.two_factor_deadline() to authenticated;

-- The assurance level comes from the access token Supabase Auth signed; the account holder can't set it.
create function private.second_factor_ok() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
  or (not private.two_factor_enrolled() and coalesce(private.two_factor_deadline()>now(),true));
$$;
revoke all on function private.second_factor_ok() from public,anon;
grant execute on function private.second_factor_ok() to authenticated;

create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select private.listed_platform_admin() and private.second_factor_ok();
$$;

create or replace function private.has_role(org uuid, roles public.organization_role[])
returns boolean language sql stable security definer set search_path='' as $$
 select private.organization_approved(org) and exists(select 1 from auth.users u where u.id=(select auth.uid())
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) and private.second_factor_ok() and
 (exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=(select auth.uid()) and m.role=any(roles))
 or private.is_platform_admin());
$$;

-- Reports check membership directly rather than through has_role, so they get the same condition here.
create or replace function private.submit_problem_report(org uuid, place uuid, report_message text, report_locale text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); account_email text; result uuid;
begin
 select u.email into account_email from auth.users u where u.id=actor and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
 if actor is null or account_email is null then raise exception 'Verified account required' using errcode='42501'; end if;
 if not private.second_factor_ok() then raise exception 'Two-factor sign-in required' using errcode='42501'; end if;
 if org is null or not private.organization_approved(org) or not exists(select 1 from public.organization_members m
  where m.organization_id=org and m.user_id=actor and m.role=any(array['owner','admin']::public.organization_role[])) then
  raise exception 'Owner or admin of an approved organisation required' using errcode='42501';
 end if;
 if report_locale is null or report_locale not in ('en','ro','de') or report_message is null
  or not (length(btrim(report_message)) between 10 and 2000) or length(report_message)>2000 then
  raise exception 'Invalid report' using errcode='22023';
 end if;
 if place is not null and not exists(select 1 from public.places p where p.id=place and p.organization_id=org and p.status<>'archived') then
  raise exception 'Invalid report' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('problem_reports:'||actor::text,0));
 if (select count(*) from public.problem_reports r where r.reporter_id=actor and r.created_at>now()-interval '1 hour')>=5
  or (select count(*) from public.problem_reports r where r.reporter_id=actor and r.created_at>now()-interval '1 day')>=20 then
  raise exception 'Too many reports' using errcode='54000';
 end if;
 insert into public.problem_reports(organization_id,place_id,reporter_id,reporter_email,locale,message)
  values(org,place,actor,account_email,report_locale,btrim(report_message)) returning id into result;
 return result;
end $$;

-- What the app needs to show the right screen. The database enforces the rule either way.
create function public.two_factor_status() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'enrolled',private.two_factor_enrolled(),
  'deadline',case when private.two_factor_deadline()='-infinity'::timestamptz then null else private.two_factor_deadline() end,
  'required',coalesce(private.two_factor_deadline()<=now(),false),
  'passed',private.second_factor_ok());
$$;
revoke all on function public.two_factor_status() from public,anon;
grant execute on function public.two_factor_status() to authenticated;

create function public.two_factor_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.two_factor_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
