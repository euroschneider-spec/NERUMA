-- Explore filters by country as well as city and type, so the list also says which country each place is in.
-- Same function, same access; one more field in each entry.
create or replace function public.published_places(lang text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(entry order by entry->>'name'),'[]'::jsonb) from (
  select jsonb_build_object('slug',p.slug,'locales',to_jsonb(l.locales),'name',v.content->>'name','city',v.content->>'city',
   'countryCode',coalesce(p.country_code,''),
   'placeType',v.content->>'place_type','locale',g.locale,'steps',jsonb_array_length(v.content->'zones')) as entry
  from public.places p
  cross join lateral (select private.published_locales(p.id) as locales) l
  join public.guides g on g.place_id=p.id and g.locale=case when lang=any(l.locales) then lang else l.locales[1] end
  join public.guide_versions v on v.guide_id=g.id and v.version=g.current_version
  where cardinality(l.locales)>0 and p.slug !~ '^place-'
 ) published;
$$;
