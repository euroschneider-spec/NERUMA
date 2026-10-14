-- Delete my account and export my data (brief docs/briefs/2026-10-13-delete-account.md, step 1; DECISIONS.md, "Deleting an account
-- deletes everything, after 30 days"). What is stored where: docs/guides/PERSONAL-DATA.md.
--
-- A deletion has two moments. When it is requested (by the person, or by an administrator for someone who wrote in), the account is
-- LOCKED: sign-in is refused (Supabase Auth's banned_until), every organisation and administrator right stops at once (the database
-- checks it, so an access token still in hand is useless), the guides whose live version this person published go down, and an
-- organisation they own alone is hidden. Within 30 days an administrator can RESTORE all of it. After 30 days an administrator ERASES:
-- everything about the person is deleted, except the problem reports they sent, which stay with the sender removed. A hidden
-- organisation is erased separately, after its own 30 days; its QR codes stay and say the guide isn't available.
--
-- Files are removed through the Storage API by the app before the database is erased; the erase refuses to run while any remain.
-- Apply ONLY to the VIANORAE project, after the remember-device migration (2026-10-15).
begin;
do $$ begin
 if to_regprocedure('public.remember_device_schema_version()') is null then
  raise exception 'STOP: the VIANORAE remember-device migration must already be installed';
 end if;
end $$;

-- 1. What is in progress. Rows exist only while a deletion or a hold is under way (a hold stays, marked erased, so the QR codes keep
-- saying "unavailable").
create table private.account_deletions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now(),
 delete_after timestamptz not null,
 -- Null when the person asked themselves; otherwise the administrator who started it.
 requested_by uuid references auth.users(id) on delete set null
);
create table private.deletion_takedowns (
 user_id uuid not null references private.account_deletions(user_id) on delete cascade,
 guide_id uuid not null references public.guides(id) on delete cascade,
 version integer not null,
 primary key(user_id, guide_id)
);
create table private.organisation_holds (
 organization_id uuid primary key references public.organizations(id),
 held_since timestamptz not null default now(),
 delete_after timestamptz not null,
 former_owner uuid references auth.users(id) on delete set null,
 erased_at timestamptz
);
revoke all on private.account_deletions, private.deletion_takedowns, private.organisation_holds from public,anon,authenticated;

-- 2. Problem reports outlive their sender (kept, anonymised), and a review outlives the administrator who made it.
alter table public.problem_reports alter column reporter_id drop not null, alter column reporter_email drop not null;
alter table public.problem_reports drop constraint problem_reports_check;
alter table public.problem_reports add constraint problem_reports_closed_check check((status='closed')=(closed_at is not null));
alter table public.problem_reports add constraint problem_reports_sender_check check((reporter_id is null)=(reporter_email is null));
alter table public.organization_review_events alter column actor_id drop not null;

-- 3. The lock. An account with a deletion in progress has no rights anywhere.
create function private.account_active() returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.account_deletions d where d.user_id=(select auth.uid()));
$$;
revoke all on function private.account_active() from public,anon;
grant execute on function private.account_active() to authenticated;

-- second_factor_ok is already the gate in has_role, is_platform_admin and submit_problem_report, so the lock joins it there.
create or replace function private.second_factor_ok() returns boolean
language sql stable security definer set search_path='' as $$
 select private.account_active() and (
  coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
  or (not private.two_factor_enrolled() and coalesce(private.two_factor_deadline()>now(),true))
  or private.session_trusted());
$$;
create or replace function private.confirmed_evidence_user() returns boolean
language sql stable security definer set search_path='' as $$
 select private.account_active() and exists(select 1 from auth.users u where u.id=(select auth.uid())
  and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;
drop policy application_read on public.organization_applications;
create policy application_read on public.organization_applications for select to authenticated
 using((applicant_id=(select auth.uid()) and (select private.account_active())) or (select private.is_platform_admin()));

-- A locked account can't remember a device or be let through by one either.
create or replace function public.remember_device() returns text
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_factor uuid; v_token text;
begin
 if v_user is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' or private.listed_platform_admin() or not private.account_active() then
  raise exception 'Remembering a device needs a session that entered the code' using errcode='42501';
 end if;
 select f.id into v_factor from auth.mfa_factors f where f.user_id=v_user and f.factor_type='totp' and f.status='verified'
  order by f.created_at limit 1;
 if v_factor is null then raise exception 'No authenticator app' using errcode='42501'; end if;
 v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into private.remembered_devices(user_id,factor_id,token_hash) values(v_user,v_factor,sha256(convert_to(v_token,'UTF8')));
 delete from private.remembered_devices d where d.user_id=v_user and (d.expires_at<=now() or d.id not in
  (select r.id from private.remembered_devices r where r.user_id=v_user order by r.created_at desc limit 10));
 return v_token;
end $$;

create or replace function public.trust_this_session(device_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_session uuid:=private.session_id(); v_device uuid;
begin
 if v_user is null or v_session is null or device_token is null or length(device_token)>200 or private.listed_platform_admin() or not private.account_active() then
  return false;
 end if;
 select d.id into v_device from private.remembered_devices d
  join auth.mfa_factors f on f.id=d.factor_id and f.status='verified'
  where d.token_hash=sha256(convert_to(device_token,'UTF8')) and d.user_id=v_user and d.expires_at>now();
 if v_device is null then return false; end if;
 delete from private.trusted_sessions t where t.user_id=v_user and t.created_at<now()-interval '31 days';
 insert into private.trusted_sessions(session_id,user_id,device_id) values(v_session,v_user,v_device)
  on conflict(session_id) do nothing;
 update private.remembered_devices set last_used_at=now() where id=v_device;
 return exists(select 1 from private.trusted_sessions t where t.session_id=v_session and t.user_id=v_user);
end $$;


-- A hidden organisation is not approved: members lose access, and its guides and QR codes say "unavailable".
create or replace function private.organization_approved(org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o where o.id=org and o.approval_status='approved')
  and not exists(select 1 from private.organisation_holds h where h.organization_id=org);
$$;

-- 4. The functions below change publication state on someone's behalf. The publish triggers stand aside for them only: the setting
-- is transaction-local, and clients can't set it (they call functions; they don't run SQL).
create function private.system_change() returns boolean language sql stable set search_path='' as $$
 select coalesce(current_setting('vianorae.system_change',true),'')='on';
$$;
revoke all on function private.system_change() from public,anon;
grant execute on function private.system_change() to authenticated;

create or replace function private.protect_publish() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not private.system_change() and auth.uid() is not null and not private.has_role(new.organization_id,array['owner','admin']::public.organization_role[]) and
 ((tg_op='INSERT' and (new.status<>'draft' or new.current_version is not null or new.published_at is not null)) or
 (tg_op='UPDATE' and (new.status is distinct from old.status or new.current_version is distinct from old.current_version or new.published_at is distinct from old.published_at)))
 then raise exception 'Only owners and admins can publish'; end if; return new;
end $$;
create or replace function private.protect_place_publication() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.slug is distinct from old.slug and old.slug !~ '^place-' then
  raise exception 'A published address never changes' using errcode='42501';
 end if;
 if not private.system_change() and auth.uid() is not null and not private.has_role(new.organization_id,array['owner','admin']::public.organization_role[])
   and (new.slug is distinct from old.slug or new.status is distinct from old.status or new.published_revision is distinct from old.published_revision) then
  raise exception 'Only owners and admins can publish' using errcode='42501';
 end if;
 return new;
end $$;

-- 5. Starting a deletion.
create function private.begin_account_deletion(p_user uuid, p_by uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_after timestamptz:=now()+interval '30 days'; v_held uuid[]:='{}'; v_down integer; v_org uuid;
begin
 if not exists(select 1 from auth.users u where u.id=p_user) then raise exception 'No such account' using errcode='42501'; end if;
 if exists(select 1 from private.account_deletions d where d.user_id=p_user) then
  raise exception 'A deletion is already in progress' using errcode='40001';
 end if;
 perform set_config('vianorae.system_change','on',true);
 insert into private.account_deletions(user_id,delete_after,requested_by) values(p_user,v_after,p_by);
 -- Guides whose live version this person published go down now, and come back on restore.
 insert into private.deletion_takedowns(user_id,guide_id,version)
  select p_user,g.id,g.current_version from public.guides g
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  where g.status='published' and v.created_by=p_user;
 update public.guides g set status='draft' where g.id in (select t.guide_id from private.deletion_takedowns t where t.user_id=p_user);
 get diagnostics v_down=row_count;
 -- An organisation this person owns alone is hidden for 30 days (DECISIONS.md), so it can be handed to a colleague.
 for v_org in select m.organization_id from public.organization_members m
  where m.user_id=p_user and m.role='owner'
  and not exists(select 1 from public.organization_members o where o.organization_id=m.organization_id and o.role='owner' and o.user_id<>p_user)
  and not exists(select 1 from private.organisation_holds h where h.organization_id=m.organization_id)
 loop
  insert into private.organisation_holds(organization_id,delete_after,former_owner) values(v_org,v_after,p_user);
  v_held:=array_append(v_held,v_org);
 end loop;
 -- Supabase Auth refuses sign-in and token refresh for a banned account.
 update auth.users set banned_until=now()+interval '100 years' where id=p_user;
 return jsonb_build_object('delete_after',v_after,'held_organisations',to_jsonb(v_held),'guides_taken_down',v_down);
end $$;
revoke all on function private.begin_account_deletion(uuid,uuid) from public,anon,authenticated;

-- The person, from a session that has just entered the password (and the code, when they use two-factor).
create function public.request_account_deletion() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_signed_in bigint;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 begin v_signed_in:=(select auth.jwt()->>'iat')::bigint; exception when others then v_signed_in:=null; end;
 if v_signed_in is null or v_signed_in<extract(epoch from now())::bigint-600 then
  raise exception 'Enter your password again to delete your account' using errcode='42501';
 end if;
 if private.two_factor_enrolled() and coalesce((select auth.jwt()->>'aal'),'aal1')<>'aal2' then
  raise exception 'Enter your two-factor code to delete your account' using errcode='42501';
 end if;
 return private.begin_account_deletion(v_user,null);
end $$;
revoke all on function public.request_account_deletion() from public,anon;
grant execute on function public.request_account_deletion() to authenticated;

-- An administrator, for someone who wrote in (after checking it is them: docs/guides/ACCOUNT-DELETION.md).
create function public.request_account_deletion_for(p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select u.id into v_user from auth.users u where lower(u.email)=lower(btrim(p_email));
 if v_user is null then raise exception 'No account with that email' using errcode='22023'; end if;
 if v_user=(select auth.uid()) then raise exception 'Delete your own account from your account page' using errcode='42501'; end if;
 return private.begin_account_deletion(v_user,(select auth.uid()))||jsonb_build_object('user_id',v_user);
end $$;
revoke all on function public.request_account_deletion_for(text) from public,anon;
grant execute on function public.request_account_deletion_for(text) to authenticated;

-- 6. Restoring, within the 30 days.
create function public.restore_account(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_after timestamptz;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select d.delete_after into v_after from private.account_deletions d where d.user_id=p_user;
 if v_after is null then raise exception 'No deletion in progress' using errcode='40001'; end if;
 if now()>=v_after then raise exception 'The 30 days have passed' using errcode='22023'; end if;
 perform set_config('vianorae.system_change','on',true);
 update public.guides g set status='published' from private.deletion_takedowns t
  where t.user_id=p_user and t.guide_id=g.id and g.current_version=t.version and g.status='draft';
 delete from private.organisation_holds h where h.former_owner=p_user and h.erased_at is null;
 update auth.users set banned_until=null where id=p_user;
 delete from private.account_deletions d where d.user_id=p_user;
 return true;
end $$;
revoke all on function public.restore_account(uuid) from public,anon;
grant execute on function public.restore_account(uuid) to authenticated;

-- 7. What the administrator sees.
create function public.account_deletions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',d.user_id,'email',u.email,'requested_at',d.requested_at,'delete_after',d.delete_after,
  'due',now()>=d.delete_after,'by_administrator',d.requested_by is not null,
  'organisations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)),'[]'::jsonb) from private.organisation_holds h
    join public.organizations o on o.id=h.organization_id where h.former_owner=d.user_id and h.erased_at is null))
  order by d.delete_after) from private.account_deletions d join auth.users u on u.id=d.user_id),'[]'::jsonb);
end $$;
revoke all on function public.account_deletions() from public,anon;
grant execute on function public.account_deletions() to authenticated;

create function public.organisation_holds() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',h.organization_id,'name',o.name,'held_since',h.held_since,'delete_after',h.delete_after,
  'due',now()>=h.delete_after,'erased_at',h.erased_at,'former_owner_email',u.email) order by h.erased_at nulls first,h.delete_after)
  from private.organisation_holds h join public.organizations o on o.id=h.organization_id left join auth.users u on u.id=h.former_owner),'[]'::jsonb);
end $$;
revoke all on function public.organisation_holds() from public,anon;
grant execute on function public.organisation_holds() to authenticated;

-- 8. Files. The app removes these through the Storage API before the database is erased.
create function public.account_erasure_files(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'key',o.name)) from storage.objects o
  where (o.bucket_id='vianorae-mandate-evidence' and o.name in (select e.storage_key from public.organization_evidence_documents e where e.applicant_id=p_user))
  or (o.bucket_id='vianorae-account-exports' and split_part(o.name,'/',1)=p_user::text)),'[]'::jsonb);
end $$;
revoke all on function public.account_erasure_files(uuid) from public,anon;
grant execute on function public.account_erasure_files(uuid) to authenticated;

create function public.organisation_erasure_files(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'key',o.name)) from storage.objects o
  where o.bucket_id='vianorae-private-photos' and split_part(o.name,'/',1)=p_org::text),'[]'::jsonb);
end $$;
revoke all on function public.organisation_erasure_files(uuid) from public,anon;
grant execute on function public.organisation_erasure_files(uuid) to authenticated;

-- An administrator may remove exactly the files of an erasure that is due, and nothing else.
create function private.erasable_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_platform_admin() and (
  (p_bucket='vianorae-mandate-evidence' and exists(select 1 from public.organization_evidence_documents e
    join private.account_deletions d on d.user_id=e.applicant_id where e.storage_key=p_name and now()>=d.delete_after))
  or (p_bucket='vianorae-account-exports' and exists(select 1 from private.account_deletions d
    where d.user_id::text=split_part(p_name,'/',1) and now()>=d.delete_after))
  or (p_bucket='vianorae-private-photos' and exists(select 1 from private.organisation_holds h
    where h.organization_id::text=split_part(p_name,'/',1) and h.erased_at is null and now()>=h.delete_after)));
$$;
revoke all on function private.erasable_object(text,text) from public,anon;
grant execute on function private.erasable_object(text,text) to authenticated;
create policy vianorae_erasure_delete on storage.objects for delete to authenticated
 using(bucket_id in ('vianorae-mandate-evidence','vianorae-account-exports','vianorae-private-photos') and private.erasable_object(bucket_id,name));
-- Removing a file also needs seeing it (Storage looks it up first), and a hidden organisation's photos are otherwise invisible.
create policy vianorae_erasure_read on storage.objects for select to authenticated
 using(bucket_id in ('vianorae-mandate-evidence','vianorae-account-exports','vianorae-private-photos') and private.erasable_object(bucket_id,name));

-- 9. Erasing a person, after the 30 days.
create function public.erase_account(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_after timestamptz; v_versions integer; v_reports integer;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select d.delete_after into v_after from private.account_deletions d where d.user_id=p_user;
 if v_after is null then raise exception 'No deletion in progress' using errcode='40001'; end if;
 if now()<v_after then raise exception 'Not due until %',v_after using errcode='22023'; end if;
 if public.account_erasure_files(p_user)<>'[]'::jsonb then raise exception 'Remove the files first' using errcode='55000'; end if;
 if exists(select 1 from public.assessors a where a.user_id=p_user and (exists(select 1 from public.assessments s where s.assessor_id=a.id)
   or exists(select 1 from public.measurements m where m.assessor_id=a.id))) then
  raise exception 'Pilot assessment data names this person; remove it first' using errcode='55000';
 end if;
 perform set_config('vianorae.system_change','on',true);

 -- Guide versions they published, even in an organisation that stays (owner's decision); the guide waits for a colleague.
 update public.guides g set current_version=null,status='draft',published_at=null
  where exists(select 1 from public.guide_versions v where v.guide_id=g.id and v.version=g.current_version and v.created_by=p_user);
 delete from public.audit_log a where a.entity_type='guide_versions' and a.after_json->>'created_by'=p_user::text;
 delete from public.guide_versions v where v.created_by=p_user;
 get diagnostics v_versions=row_count;

 -- Problem reports stay, without the sender. Done before the change history, because the update writes history of its own.
 update public.problem_reports r set reporter_id=null,reporter_email=null where r.reporter_id=p_user;
 get diagnostics v_reports=row_count;
 update public.problem_reports r set closed_by=null where r.closed_by=p_user;
 update public.audit_log a set
  before_json=case when a.before_json is null then null else a.before_json
   ||case when a.before_json->>'reporter_id'=p_user::text then jsonb_build_object('reporter_id',null,'reporter_email',null) else '{}'::jsonb end
   ||case when a.before_json->>'closed_by'=p_user::text then jsonb_build_object('closed_by',null) else '{}'::jsonb end end,
  after_json=a.after_json
   ||case when a.after_json->>'reporter_id'=p_user::text then jsonb_build_object('reporter_id',null,'reporter_email',null) else '{}'::jsonb end
   ||case when a.after_json->>'closed_by'=p_user::text then jsonb_build_object('closed_by',null) else '{}'::jsonb end
  where a.entity_type='problem_reports' and (a.before_json->>'reporter_id'=p_user::text or a.after_json->>'reporter_id'=p_user::text
   or a.before_json->>'closed_by'=p_user::text or a.after_json->>'closed_by'=p_user::text);
 update public.audit_log a set actor_id=null where a.actor_id=p_user;

 -- Their request, its history, documents and acceptance; reviews they made of other people keep the decision, not the reviewer.
 delete from public.organization_review_events e where e.application_id in (select r.id from public.organization_applications r where r.applicant_id=p_user);
 update public.organization_review_events e set actor_id=null where e.actor_id=p_user;
 delete from public.organization_evidence_documents e where e.applicant_id=p_user;
 delete from public.organization_applications r where r.applicant_id=p_user;
 delete from public.organization_acknowledgements a where a.user_id=p_user;
 delete from public.organization_members m where m.user_id=p_user;
 delete from private.platform_admins p where p.user_id=p_user;
 -- Pilot tables (not used by the app yet).
 delete from public.assessment_assignments a where a.user_id=p_user;
 delete from public.reviews r where r.reviewer_id=p_user;
 update public.assessments s set reviewer_id=null where s.reviewer_id=p_user;
 delete from public.assessors a where a.user_id=p_user;
 delete from public.users u where u.id=p_user;
 -- Supabase removes sign-in, sessions, two-factor and identities with the user; remembered devices and the deletion record cascade.
 delete from auth.mfa_factors f where f.user_id=p_user;
 delete from auth.users u where u.id=p_user;
 return jsonb_build_object('guide_versions_deleted',v_versions,'problem_reports_anonymised',v_reports);
end $$;
revoke all on function public.erase_account(uuid) from public,anon;
grant execute on function public.erase_account(uuid) to authenticated;

-- 10. Erasing a hidden organisation, after its 30 days. The places' rows stay with their addresses and QR codes, which then say the
-- guide isn't available; nothing else of the organisation is left.
create function public.erase_held_organisation(p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_after timestamptz; v_erased timestamptz; v_places integer;
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 select h.delete_after,h.erased_at into v_after,v_erased from private.organisation_holds h where h.organization_id=p_org;
 if v_after is null then raise exception 'This organisation is not on hold' using errcode='40001'; end if;
 if v_erased is not null then raise exception 'Already erased' using errcode='40001'; end if;
 if now()<v_after then raise exception 'Not due until %',v_after using errcode='22023'; end if;
 if public.organisation_erasure_files(p_org)<>'[]'::jsonb then raise exception 'Remove the files first' using errcode='55000'; end if;
 perform set_config('vianorae.system_change','on',true);
 update public.qr_redirects q set guide_id=null where q.organization_id=p_org;
 update public.guides g set current_version=null,status='draft',published_at=null where g.organization_id=p_org;
 delete from public.guide_versions v where v.organization_id=p_org;
 delete from public.guide_steps s where s.organization_id=p_org;
 delete from public.guides g where g.organization_id=p_org;
 delete from public.measurements m where m.organization_id=p_org;
 delete from public.reviews r where r.organization_id=p_org;
 delete from public.assessment_assignments a where a.organization_id=p_org;
 delete from public.assessments s where s.organization_id=p_org;
 delete from public.external_certifications c where c.organization_id=p_org;
 delete from public.relief_features f where f.organization_id=p_org;
 delete from public.time_profiles t where t.organization_id=p_org;
 delete from public.zone_field_translations t where t.organization_id=p_org;
 delete from public.zone_fields f where f.organization_id=p_org;
 delete from public.zone_translations t where t.organization_id=p_org;
 delete from public.sensory_profiles p where p.organization_id=p_org;
 delete from public.media_assets m where m.organization_id=p_org;
 delete from public.zones z where z.organization_id=p_org;
 delete from public.place_translations t where t.organization_id=p_org;
 update public.places p set city='',address='',status='draft',published_revision=null where p.organization_id=p_org;
 get diagnostics v_places=row_count;
 delete from public.audit_log a where a.organization_id=p_org;
 delete from public.organization_members m where m.organization_id=p_org;
 delete from public.organization_acknowledgements a where a.organization_id=p_org;
 update public.organization_applications r set organization_id=null where r.organization_id=p_org;
 update public.organizations o set name='Deleted organisation' where o.id=p_org;
 update private.organisation_holds h set erased_at=now() where h.organization_id=p_org;
 return jsonb_build_object('places_kept_for_qr_codes',v_places);
end $$;
revoke all on function public.erase_held_organisation(uuid) from public,anon;
grant execute on function public.erase_held_organisation(uuid) to authenticated;

-- 11. Export: everything held about one person. Their own, or an administrator's for someone who wrote in.
create function private.export_data(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'exported_at',now(),
  'account',(select jsonb_build_object('email',u.email,'created_at',to_jsonb(u)->'created_at','email_confirmed_at',u.email_confirmed_at,
    'last_sign_in_at',to_jsonb(u)->'last_sign_in_at','registration_form',to_jsonb(u)->'raw_user_meta_data') from auth.users u where u.id=p_user),
  'deletion',(select jsonb_build_object('requested_at',d.requested_at,'delete_after',d.delete_after,'by_administrator',d.requested_by is not null)
    from private.account_deletions d where d.user_id=p_user),
  'platform_administrator',exists(select 1 from private.platform_admins p where p.user_id=p_user),
  'two_factor',jsonb_build_object(
    'authenticator_app',exists(select 1 from auth.mfa_factors f where f.user_id=p_user and f.factor_type='totp' and f.status='verified'),
    'remembered_devices',(select coalesce(jsonb_agg(jsonb_build_object('created_at',r.created_at,'expires_at',r.expires_at,'last_used_at',r.last_used_at)
      order by r.created_at),'[]'::jsonb) from private.remembered_devices r where r.user_id=p_user)),
  'organisation_requests',(select coalesce(jsonb_agg((to_jsonb(r)-'applicant_id')||jsonb_build_object('decisions',
    (select coalesce(jsonb_agg(jsonb_build_object('decision',e.decision,'decided_at',e.created_at,'note_to_you',e.applicant_note,
      'organisation_confirmed',e.entity_confirmed,'mandate_confirmed',e.mandate_confirmed,'source_checked',e.verified_source,
      'how_the_mandate_was_checked',e.evidence_reference) order by e.created_at),'[]'::jsonb)
     from public.organization_review_events e where e.application_id=r.id)) order by r.submitted_at),'[]'::jsonb)
    from public.organization_applications r where r.applicant_id=p_user),
  'documents',(select coalesce(jsonb_agg(jsonb_build_object('file_name',e.filename,'type',e.mime_type,'bytes',e.byte_size,'uploaded_at',e.uploaded_at,
    'sha256',e.sha256) order by e.created_at),'[]'::jsonb) from public.organization_evidence_documents e where e.applicant_id=p_user),
  'statements_accepted',(select coalesce(jsonb_agg(jsonb_build_object('organisation',o.name,'representative',a.representative_name,
    'version',a.statement_version,'language',a.statement_locale,'accepted_at',a.accepted_at) order by a.accepted_at),'[]'::jsonb)
    from public.organization_acknowledgements a join public.organizations o on o.id=a.organization_id where a.user_id=p_user),
  'memberships',(select coalesce(jsonb_agg(jsonb_build_object('organisation',o.name,'role',m.role) order by o.name),'[]'::jsonb)
    from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=p_user),
  'problem_reports_sent',(select coalesce(jsonb_agg(jsonb_build_object('sent_at',r.created_at,'organisation',o.name,'message',r.message,
    'language',r.locale,'status',r.status) order by r.created_at),'[]'::jsonb)
    from public.problem_reports r join public.organizations o on o.id=r.organization_id where r.reporter_id=p_user),
  'guide_versions_published',(select coalesce(jsonb_agg(jsonb_build_object('organisation',o.name,'place',v.content->>'name','language',g.locale,
    'version',v.version,'published_at',v.created_at) order by v.created_at),'[]'::jsonb)
    from public.guide_versions v join public.guides g on g.id=v.guide_id join public.organizations o on o.id=v.organization_id where v.created_by=p_user),
  -- What an organisation they own alone holds: it is deleted after 30 days, so it is theirs to keep.
  'organisations_you_own_alone',(select coalesce(jsonb_agg(jsonb_build_object('organisation',o.name,'places',
    (select coalesce(jsonb_agg(jsonb_build_object('city',p.city,'address',p.address,'country',p.country_code,'type',p.place_type,'status',p.status,
      'texts',(select coalesce(jsonb_agg(to_jsonb(t)-'place_id'-'organization_id'),'[]'::jsonb) from public.place_translations t where t.place_id=p.id),
      'steps',(select coalesce(jsonb_agg((to_jsonb(z)-'place_id'-'organization_id')||jsonb_build_object('texts',
         (select coalesce(jsonb_agg(to_jsonb(zt)-'place_id'-'organization_id'-'zone_id'),'[]'::jsonb) from public.zone_translations zt where zt.zone_id=z.id))
         order by z.sort_order),'[]'::jsonb) from public.zones z where z.place_id=p.id and z.status<>'archived'),
      'photos',(select coalesce(jsonb_agg(jsonb_build_object('file',m.storage_key,'descriptions',m.alt_text,'rights',m.rights,'taken_on',m.photographed_on)),'[]'::jsonb)
         from public.media_assets m where m.place_id=p.id and m.active))),'[]'::jsonb) from public.places p where p.organization_id=o.id)) order by o.name),'[]'::jsonb)
    from public.organizations o where exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=p_user and m.role='owner')
     and not exists(select 1 from public.organization_members m where m.organization_id=o.id and m.role='owner' and m.user_id<>p_user)));
$$;
revoke all on function private.export_data(uuid) from public,anon,authenticated;

create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.export_data((select auth.uid()));
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;

create function public.export_user_data(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u where u.id=p_user) then raise exception 'No such account' using errcode='22023'; end if;
 return private.export_data(p_user);
end $$;
revoke all on function public.export_user_data(uuid) from public,anon;
grant execute on function public.export_user_data(uuid) to authenticated;

-- The files that go with an export: their documents, and the photos of an organisation they own alone. Read with the caller's own
-- rights, so the app can only download what the caller may already read.
create function public.export_files(p_user uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=coalesce(p_user,(select auth.uid()));
begin
 if v_user is null or (v_user<>(select auth.uid()) and not private.is_platform_admin()) then
  raise exception 'Not allowed' using errcode='42501';
 end if;
 return (select coalesce(jsonb_agg(f),'[]'::jsonb) from (
  select jsonb_build_object('bucket','vianorae-mandate-evidence','key',e.storage_key,'name','documents/'||e.filename) f
   from public.organization_evidence_documents e where e.applicant_id=v_user and e.uploaded_at is not null
  union all
  select jsonb_build_object('bucket','vianorae-private-photos','key',m.storage_key,'name','photos/'||split_part(m.storage_key,'/',2)||'/'||split_part(m.storage_key,'/',4))
   from public.media_assets m where m.active and m.organization_id in (
    select o.id from public.organizations o where exists(select 1 from public.organization_members x where x.organization_id=o.id and x.user_id=v_user and x.role='owner')
     and not exists(select 1 from public.organization_members x where x.organization_id=o.id and x.role='owner' and x.user_id<>v_user))) files);
end $$;
revoke all on function public.export_files(uuid) from public,anon;
grant execute on function public.export_files(uuid) to authenticated;

-- 12. Where a person's own export waits for them for 7 days (a private download link; the account is locked by then).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vianorae-account-exports','vianorae-account-exports',false,52428800,array['application/zip']) on conflict(id) do nothing;
create policy vianorae_export_insert on storage.objects for insert to authenticated
 with check(bucket_id='vianorae-account-exports' and split_part(name,'/',1)=(select auth.uid())::text and (select private.account_active()));
create policy vianorae_export_read on storage.objects for select to authenticated
 using(bucket_id='vianorae-account-exports' and split_part(name,'/',1)=(select auth.uid())::text);

-- 13. An administrator removes a problem report by hand (DECISIONS.md), with its change history.
create function public.delete_problem_report(p_report uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 delete from public.audit_log a where a.entity_type='problem_reports' and a.entity_id=p_report::text;
 delete from public.problem_reports r where r.id=p_report;
 if not found then raise exception 'No such report' using errcode='40001'; end if;
 return true;
end $$;
revoke all on function public.delete_problem_report(uuid) from public,anon;
grant execute on function public.delete_problem_report(uuid) to authenticated;

create function public.account_deletion_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.account_deletion_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
