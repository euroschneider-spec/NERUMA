-- Remember this device for 30 days (brief docs/briefs/2026-10-13-two-factor-sign-in.md, PR 3). Additive: nothing is deleted.
-- After the code, an organisation owner or admin may tick "Remember this device". The browser then keeps a random token in an
-- httpOnly cookie; only its hash is stored here. At a later password sign-in the app hands the token back, and if it matches,
-- that one session (its session_id) counts as having passed the second factor. Platform administrators can't use it.
-- No device details are kept: no name, browser, IP address. Apply ONLY to the VIANORAE project, after the two-factor migration.
begin;
do $$ begin
 if to_regprocedure('public.two_factor_schema_version()') is null then
  raise exception 'STOP: the VIANORAE two-factor migration must already be installed';
 end if;
end $$;

-- A device belongs to the authenticator app it was confirmed with: an administrator's reset removes that app and, with it,
-- every remembered device.
create table private.remembered_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 factor_id uuid not null references auth.mfa_factors(id) on delete cascade,
 token_hash bytea not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days',
 last_used_at timestamptz
);
create index remembered_devices_user_idx on private.remembered_devices(user_id);
create table private.trusted_sessions (
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null references private.remembered_devices(id) on delete cascade,
 created_at timestamptz not null default now()
);
revoke all on private.remembered_devices, private.trusted_sessions from public,anon,authenticated;

create function private.session_id() returns uuid language plpgsql stable security invoker set search_path='' as $$
begin
 return (select auth.jwt()->>'session_id')::uuid;
exception when invalid_text_representation then return null;
end $$;

-- This session was trusted through a device that is still valid, for an account that may use remembered devices.
create function private.session_trusted() returns boolean
language sql stable security definer set search_path='' as $$
 select not private.listed_platform_admin() and exists(select 1 from private.trusted_sessions t
  join private.remembered_devices d on d.id=t.device_id
  join auth.mfa_factors f on f.id=d.factor_id and f.status='verified'
  where t.session_id=private.session_id() and t.user_id=(select auth.uid()) and d.user_id=(select auth.uid()) and d.expires_at>now());
$$;
revoke all on function private.session_trusted() from public,anon;
grant execute on function private.session_trusted() to authenticated;

create or replace function private.second_factor_ok() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
  or (not private.two_factor_enrolled() and coalesce(private.two_factor_deadline()>now(),true))
  or private.session_trusted();
$$;

-- Called right after the code, from a session at aal2. Returns the token the browser keeps; only its hash is stored.
-- At most ten devices per account; the oldest goes first.
create function public.remember_device() returns text
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_factor uuid; v_token text;
begin
 if v_user is null or coalesce((select auth.jwt()->>'aal'),'')<>'aal2' or private.listed_platform_admin() then
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
revoke all on function public.remember_device() from public,anon;
grant execute on function public.remember_device() to authenticated;

-- Called after a password sign-in with the token from the browser. True when this session is now trusted.
create function public.trust_this_session(device_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_session uuid:=private.session_id(); v_device uuid;
begin
 if v_user is null or v_session is null or device_token is null or length(device_token)>200 or private.listed_platform_admin() then
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
revoke all on function public.trust_this_session(text) from public,anon;
grant execute on function public.trust_this_session(text) to authenticated;

-- The account page lists the account's own devices: dates only, and which one this session came through.
create function public.remembered_devices() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'created_at',d.created_at,'expires_at',d.expires_at,
  'current',exists(select 1 from private.trusted_sessions t where t.device_id=d.id and t.session_id=private.session_id()))
  order by d.created_at desc),'[]'::jsonb)
 from private.remembered_devices d where d.user_id=(select auth.uid()) and d.expires_at>now();
$$;
revoke all on function public.remembered_devices() from public,anon;
grant execute on function public.remembered_devices() to authenticated;

-- Forgetting asks for nothing: the worst case is entering the code once more.
create function public.forget_devices(device uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
 delete from private.remembered_devices d where d.user_id=(select auth.uid()) and (device is null or d.id=device);
 get diagnostics v_count=row_count;
 return v_count;
end $$;
revoke all on function public.forget_devices(uuid) from public,anon;
grant execute on function public.forget_devices(uuid) to authenticated;

-- A new password forgets every remembered device of that account.
create function private.forget_devices_on_password_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from private.remembered_devices d where d.user_id=new.id;
 return new;
end $$;
revoke all on function private.forget_devices_on_password_change() from public,anon,authenticated;
create trigger remembered_devices_password after update of encrypted_password on auth.users
 for each row when (old.encrypted_password is distinct from new.encrypted_password)
 execute function private.forget_devices_on_password_change();

-- What the app needs on top of two_factor_status: whether this account may remember a device.
create or replace function public.two_factor_status() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'enrolled',private.two_factor_enrolled(),
  'deadline',case when private.two_factor_deadline()='-infinity'::timestamptz then null else private.two_factor_deadline() end,
  'required',coalesce(private.two_factor_deadline()<=now(),false),
  'passed',private.second_factor_ok(),
  'can_remember',not private.listed_platform_admin());
$$;

create function public.remember_device_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.remember_device_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
