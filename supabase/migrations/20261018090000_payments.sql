-- Payments (brief docs/briefs/2026-10-18-payments.md, guide docs/guides/PAYMENTS.md). Additive: nothing is deleted.
-- Stripe tells the site about each subscription (the webhook); the site writes it here through one narrow function that needs a
-- secret. Publishing, and what visitors see, read this table: an organisation without a plan can't publish, and 30 days after its
-- payment stops its guides say "unavailable". None of it applies until a date is set in private.billing_policy.
-- Apply ONLY to the VIANORAE project, after the account profile migration (2026-10-17).
begin;
do $$ begin
 if to_regprocedure('public.account_profile_schema_version()') is null then
  raise exception 'STOP: the VIANORAE account profile migration must already be installed';
 end if;
end $$;

-- The two settings. From when a plan is needed (empty: not yet, so nothing changes):
--   update private.billing_policy set required_from='2027-01-01 00:00+01';
-- and the webhook's secret, kept only as its SHA-256 (the same secret is VIANORAE_BILLING_SECRET in Vercel):
--   update private.billing_policy set webhook_secret_sha256=sha256(convert_to('<the secret>','UTF8'));
create table private.billing_policy (
 id boolean primary key default true check(id),
 required_from timestamptz,
 webhook_secret_sha256 bytea check(webhook_secret_sha256 is null or length(webhook_secret_sha256)=32)
);
insert into private.billing_policy default values;
revoke all on private.billing_policy from public,anon,authenticated;

-- One plan per organisation, as Stripe last described it. Nobody writes here except billing_record_subscription, and nobody reads
-- it directly: owners and admins read it through billing_status.
create table public.organization_subscriptions (
 organization_id uuid primary key references public.organizations(id),
 stripe_customer_id text not null check(stripe_customer_id ~ '^cus_[A-Za-z0-9]+$' and length(stripe_customer_id)<=255),
 stripe_subscription_id text not null check(stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$' and length(stripe_subscription_id)<=255),
 status text not null check(status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 -- When the payment stopped: the 30 days of grace count from here. Empty while paid, and for a plan that was never paid.
 lapsed_at timestamptz,
 -- When the webhook read this from Stripe (it asks Stripe for the current state on every event). An older reading changes nothing.
 event_created timestamptz not null,
 updated_at timestamptz not null default now()
);
alter table public.organization_subscriptions enable row level security;
revoke all on public.organization_subscriptions from public,anon,authenticated;

-- May this organisation publish, and may visitors see what it published? Yes before payments start, while it pays, and for
-- 30 days after its payment stopped.
create function private.publishing_paid(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.required_from is null or now()<p.required_from from private.billing_policy p),true)
  or exists(select 1 from public.organization_subscriptions s where s.organization_id=org
   and (s.status in ('active','trialing') or now()<s.lapsed_at+interval '30 days'));
$$;
revoke all on function private.publishing_paid(uuid) from public;
grant execute on function private.publishing_paid(uuid) to anon,authenticated;

-- Publishing (a first publish, or a new revision) needs a plan. publish_place runs as the caller, so this trigger decides.
create function private.require_plan_to_publish() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='published' and (old.status is distinct from 'published' or new.published_revision is distinct from old.published_revision)
   and not private.publishing_paid(new.organization_id) then
  raise exception 'A plan is needed to publish' using errcode='P0402';
 end if;
 return new;
end $$;
revoke all on function private.require_plan_to_publish() from public;
create trigger places_require_plan before update on public.places for each row execute function private.require_plan_to_publish();

-- Visitors: the published-guide functions see nothing of an organisation whose grace has ended, the same as a suspended one. The QR
-- code and the address answer "unavailable"; paying again brings everything back.
create or replace function private.published_locales(place uuid) returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(g.locale order by array_position(array['en','ro','de'],g.locale)),'{}')
 from public.guides g join public.places p on p.id=g.place_id
 where g.place_id=place and g.status='published' and g.current_version is not null and private.organization_approved(p.organization_id)
  and private.publishing_paid(p.organization_id);
$$;
create or replace function private.published_photo(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.guides g
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  cross join lateral jsonb_array_elements(v.content->'zones') z
  where g.status='published' and private.organization_approved(g.organization_id) and private.publishing_paid(g.organization_id)
   and z->'photo'->>'key'=object_name);
$$;
-- And the tables themselves, read without the functions: hidden from everyone but the organisation's own people.
create function private.paid_or_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.publishing_paid(org) or private.has_role(org,enum_range(null::public.organization_role));
$$;
revoke all on function private.paid_or_member(uuid) from public;
grant execute on function private.paid_or_member(uuid) to anon,authenticated;
create policy paid_guide_read on public.guides as restrictive for select to anon,authenticated using(private.paid_or_member(organization_id));
create policy paid_version_read on public.guide_versions as restrictive for select to anon,authenticated using(private.paid_or_member(organization_id));
create policy paid_qr_read on public.qr_redirects as restrictive for select to anon,authenticated using(private.paid_or_member(organization_id));

-- What the owner and admins see on Plan & billing and the dashboard. The Stripe customer (to open Stripe's own page) for owners only.
create function public.billing_status(org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_required timestamptz; v_row public.organization_subscriptions;
begin
 if org is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) then
  raise exception 'Owner or admin required' using errcode='42501';
 end if;
 select p.required_from into v_required from private.billing_policy p;
 select * into v_row from public.organization_subscriptions s where s.organization_id=org;
 return jsonb_build_object(
  'requiredFrom',v_required,
  'required',coalesce(now()>=v_required,false),
  'allowed',private.publishing_paid(org),
  'status',v_row.status,
  'periodEnd',v_row.current_period_end,
  'cancelAtPeriodEnd',coalesce(v_row.cancel_at_period_end,false),
  'graceUntil',case when v_row.status not in ('active','trialing') then v_row.lapsed_at+interval '30 days' end,
  'customer',case when private.has_role(org,array['owner']::public.organization_role[]) then v_row.stripe_customer_id end);
end $$;
revoke all on function public.billing_status(uuid) from public,anon;
grant execute on function public.billing_status(uuid) to authenticated;

-- The webhook (src/app/api/stripe/webhook) after it has checked Stripe's signature. It has no signed-in person, so it proves itself
-- with the secret instead; the function can do nothing but record one organisation's plan.
create function public.billing_record_subscription(p_secret text, p_org uuid, p_customer text, p_subscription text, p_status text,
 p_period_end timestamptz, p_cancel_at_period_end boolean, p_event_created timestamptz) returns text
language plpgsql security definer set search_path='' as $$
declare v_expected bytea; v_row public.organization_subscriptions; v_found boolean; v_lapsed timestamptz;
 v_paid constant text[]:=array['active','trialing']; v_paying constant text[]:=array['active','trialing','past_due'];
begin
 select p.webhook_secret_sha256 into v_expected from private.billing_policy p;
 if v_expected is null or p_secret is null or length(p_secret)<32 or sha256(convert_to(p_secret,'UTF8'))<>v_expected then
  raise exception 'Not allowed' using errcode='42501';
 end if;
 if p_org is null or p_event_created is null or not exists(select 1 from public.organizations o where o.id=p_org) then
  raise exception 'Unknown organisation' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_org::text,0));
 select * into v_row from public.organization_subscriptions s where s.organization_id=p_org for update;
 v_found:=found;
 if v_found then
  if p_event_created<v_row.event_created then return 'stale'; end if;
  -- Two checkouts can make two subscriptions. One ending doesn't end the other, which is still paid.
  if v_row.stripe_subscription_id<>p_subscription and v_row.status=any(v_paying) and not p_status=any(v_paying) then return 'ignored'; end if;
 end if;
 -- The grace starts when a paid plan stops being paid, and keeps its start through later changes until it is paid again.
 v_lapsed:=case
  when p_status=any(v_paid) then null
  when v_found and v_row.status=any(v_paid) then p_event_created
  when v_found then v_row.lapsed_at
  when p_status in ('past_due','unpaid') then p_event_created
 end;
 insert into public.organization_subscriptions(organization_id,stripe_customer_id,stripe_subscription_id,status,current_period_end,
  cancel_at_period_end,lapsed_at,event_created,updated_at)
  values(p_org,p_customer,p_subscription,p_status,p_period_end,coalesce(p_cancel_at_period_end,false),v_lapsed,p_event_created,now())
  on conflict(organization_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,
   status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,
   lapsed_at=excluded.lapsed_at,event_created=excluded.event_created,updated_at=now();
 return 'recorded';
end $$;
revoke all on function public.billing_record_subscription(text,uuid,text,text,text,timestamptz,boolean,timestamptz) from public;
grant execute on function public.billing_record_subscription(text,uuid,text,text,text,timestamptz,boolean,timestamptz) to anon,authenticated;

-- Stripe keeps charging until the subscription is cancelled in Stripe, and NERUMA can't cancel it. So the irreversible steps of a deletion
-- (docs/guides/ACCOUNT-DELETION.md) refuse while one runs: erasing an organisation, and erasing the last owner of one. Starting a deletion
-- is not refused (it is undone by restoring within 30 days, and gives time to cancel).
create function private.subscription_running(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_subscriptions s where s.organization_id=org and s.status not in ('canceled','incomplete_expired'));
$$;
revoke all on function private.subscription_running(uuid) from public;

create function private.refuse_last_owner_while_paying() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='owner' and private.subscription_running(old.organization_id)
   and not exists(select 1 from public.organization_members m where m.organization_id=old.organization_id and m.role='owner' and m.user_id<>old.user_id) then
  raise exception 'Cancel the Stripe subscription first' using errcode='P0403';
 end if;
 return old;
end $$;
revoke all on function private.refuse_last_owner_while_paying() from public;
create trigger organization_members_paying before delete on public.organization_members for each row execute function private.refuse_last_owner_while_paying();

create function private.refuse_erasing_paying_organisation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.erased_at is not null and old.erased_at is null and private.subscription_running(new.organization_id) then
  raise exception 'Cancel the Stripe subscription first' using errcode='P0403';
 end if;
 return new;
end $$;
revoke all on function private.refuse_erasing_paying_organisation() from public;
create trigger organisation_holds_paying before update on private.organisation_holds for each row execute function private.refuse_erasing_paying_organisation();

-- For the deletions page: which erasures wait for a cancellation in Stripe.
create function public.erasure_blocked_by_billing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
 return jsonb_build_object(
  'users',coalesce((select jsonb_agg(distinct m.user_id) from public.organization_members m
   where m.role='owner' and private.subscription_running(m.organization_id)
    and not exists(select 1 from public.organization_members o where o.organization_id=m.organization_id and o.role='owner' and o.user_id<>m.user_id)),'[]'::jsonb),
  'organisations',coalesce((select jsonb_agg(h.organization_id) from private.organisation_holds h
   where h.erased_at is null and private.subscription_running(h.organization_id)),'[]'::jsonb));
end $$;
revoke all on function public.erasure_blocked_by_billing() from public,anon;
grant execute on function public.erasure_blocked_by_billing() to authenticated;

create function public.payments_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.payments_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
