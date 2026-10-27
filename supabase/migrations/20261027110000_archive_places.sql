-- An organisation can archive a location it no longer wants on its dashboard, and bring it back (brief docs/briefs/2026-10-27-archive-locations.md).
-- Archiving takes the guide down in every language, like unpublishing: the address and QR code stay and say the guide isn't available.
-- An archived location can't be edited or published until it is restored, and it comes back as a draft that has to be published again.
-- Nothing is deleted. Apply ONLY to the VIANORAE project, after the Explore listing migration (2026-10-27).
begin;
do $$ begin
 if to_regprocedure('public.explore_listing_schema_version()') is null then
  raise exception 'STOP: the VIANORAE Explore listing migration must already be installed';
 end if;
end $$;

-- 1. Only owners and admins move a location into or out of the archive, never a platform administrator on a visit, and an archived
-- location is read-only: saving a draft bumps the revision and publishing sets the status, both of which this refuses. Restoring (archived
-- to draft) is the one way out. Erasing a held organisation runs as the system and is not affected.
create function private.protect_archived_place() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if private.system_change() or auth.uid() is null then return new; end if;
 if (old.status='archived') is distinct from (new.status='archived') then
  if not private.has_role(new.organization_id,array['owner','admin']::public.organization_role[]) or private.visiting(new.organization_id) then
   raise exception 'Only owners and admins can archive or restore a location' using errcode='42501';
  end if;
  if old.status='archived' and new.status<>'draft' then
   raise exception 'An archived location comes back as a draft' using errcode='42501';
  end if;
 elsif old.status='archived' then
  raise exception 'An archived location can''t be changed; restore it first' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.protect_archived_place() from public;
create trigger places_archive_guard before update on public.places for each row execute function private.protect_archived_place();

-- 2. Archive: the guides go offline in every language, then the location is archived. False when it was already archived or isn't there.
create function public.archive_place(org uuid, place uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if org is null or place is null or auth.uid() is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) or private.visiting(org) then
  raise exception 'Only owners and admins can archive a location' using errcode='42501';
 end if;
 perform 1 from public.places p where p.id=place and p.organization_id=org and p.status<>'archived' for update;
 if not found then return false; end if;
 update public.guides set status='draft' where place_id=place and organization_id=org and status='published';
 update public.places set status='archived' where id=place and organization_id=org;
 return true;
end $$;
revoke all on function public.archive_place(uuid,uuid) from public,anon;
grant execute on function public.archive_place(uuid,uuid) to authenticated;

-- 3. Restore: back to a draft, to be published again.
create function public.restore_place(org uuid, place uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if org is null or place is null or auth.uid() is null or not private.has_role(org,array['owner','admin']::public.organization_role[]) or private.visiting(org) then
  raise exception 'Only owners and admins can restore a location' using errcode='42501';
 end if;
 update public.places set status='draft' where id=place and organization_id=org and status='archived';
 return found;
end $$;
revoke all on function public.restore_place(uuid,uuid) from public,anon;
grant execute on function public.restore_place(uuid,uuid) to authenticated;

create function public.archive_places_schema_version() returns integer language sql immutable security invoker set search_path='' as $$ select 1 $$;
grant execute on function public.archive_places_schema_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;
