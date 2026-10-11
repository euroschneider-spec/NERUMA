-- Organisations report a problem or ask for help (DECISIONS.md, "Organisations can report a problem"). Additive only.
-- Reports are written and closed only through the two functions below, so the rate limit can't be skipped
-- with a direct insert. Apply ONLY to the VIANORAE project, after the organisation verification migration (2026-10-07).
begin;
do $$ begin
 if to_regprocedure('private.organization_approved(uuid)') is null or to_regprocedure('private.is_platform_admin()') is null then
  raise exception 'STOP: the VIANORAE organisation verification migration must already be installed';
 end if;
end $$;
create table public.problem_reports (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 place_id uuid,
 reporter_id uuid not null references auth.users(id),
 -- Copied from the confirmed account when the report is saved, so NERUMA can reply.
 reporter_email text not null,
 locale text not null check(locale in ('en','ro','de')),
 message text not null check(length(btrim(message)) between 10 and 2000 and length(message)<=2000),
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 closed_by uuid references auth.users(id),
 check((status='closed')=(closed_at is not null and closed_by is not null)),
 foreign key(place_id,organization_id) references public.places(id,organization_id)
);
create index problem_reports_org_idx on public.problem_reports(organization_id,created_at desc);
create index problem_reports_open_idx on public.problem_reports(created_at) where status='open';
create index problem_reports_reporter_idx on public.problem_reports(reporter_id,created_at);
create index problem_reports_place_idx on public.problem_reports(place_id);
alter table public.problem_reports enable row level security;
revoke all on public.problem_reports from anon, authenticated;
grant select on public.problem_reports to authenticated;
-- Owners and admins of an approved organisation read their organisation's reports; the platform administrator reads all,
-- including those of a suspended organisation.
create policy problem_reports_read on public.problem_reports for select to authenticated
 using(private.is_platform_admin() or private.has_role(organization_id,array['owner','admin']::public.organization_role[]));
create trigger problem_reports_audit after insert or update on public.problem_reports for each row execute function private.audit_change();

-- Actor, email, status and time are derived, never accepted from the caller. The platform administrator files no
-- reports on behalf of an organisation: membership is checked directly, not through has_role.
create function private.submit_problem_report(org uuid, place uuid, report_message text, report_locale text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); account_email text; result uuid;
begin
 select u.email into account_email from auth.users u where u.id=actor and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
 if actor is null or account_email is null then raise exception 'Verified account required' using errcode='42501'; end if;
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
 -- Serialise one person's submissions so two at once can't both slip under the limit.
 perform pg_advisory_xact_lock(hashtextextended('problem_reports:'||actor::text,0));
 if (select count(*) from public.problem_reports r where r.reporter_id=actor and r.created_at>now()-interval '1 hour')>=5
  or (select count(*) from public.problem_reports r where r.reporter_id=actor and r.created_at>now()-interval '1 day')>=20 then
  raise exception 'Too many reports' using errcode='54000';
 end if;
 insert into public.problem_reports(organization_id,place_id,reporter_id,reporter_email,locale,message)
  values(org,place,actor,account_email,report_locale,btrim(report_message)) returning id into result;
 return result;
end $$;
revoke all on function private.submit_problem_report(uuid,uuid,text,text) from public,anon;
grant execute on function private.submit_problem_report(uuid,uuid,text,text) to authenticated;
create function public.submit_problem_report(org uuid, place uuid, report_message text, report_locale text)
returns uuid language sql security invoker set search_path='' as $$
 select private.submit_problem_report(org,place,report_message,report_locale);
$$;
revoke all on function public.submit_problem_report(uuid,uuid,text,text) from public,anon;
grant execute on function public.submit_problem_report(uuid,uuid,text,text) to authenticated;

create function private.close_problem_report(report uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 update public.problem_reports set status='closed',closed_at=now(),closed_by=(select auth.uid()) where id=report and status='open';
 if not found then raise exception 'Report is not open' using errcode='40001'; end if;
end $$;
revoke all on function private.close_problem_report(uuid) from public,anon;
grant execute on function private.close_problem_report(uuid) to authenticated;
create function public.close_problem_report(report uuid)
returns void language sql security invoker set search_path='' as $$
 select private.close_problem_report(report);
$$;
revoke all on function public.close_problem_report(uuid) from public,anon;
grant execute on function public.close_problem_report(uuid) to authenticated;

create function public.problem_reports_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
revoke all on function public.problem_reports_schema_version() from public;
grant execute on function public.problem_reports_schema_version() to anon,authenticated;
commit;
