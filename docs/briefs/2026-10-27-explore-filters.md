---
status: done   # idea → building → done
date: 2026-10-27
---

# Explore filters: country, city, type of place

## Idea
Visitors can narrow Explore down by **country**, **city** and **type of place**. The filters offer only what exists: a country, city or type
appears only when at least one published guide has it. The visitor's language is not a filter, because the site already uses the language
they have set.

## Why
Visitors can explore from many points of view. For a new product the aim is to make it as easy as possible, so we begin with the three that
need no explanation (for example Amsterdam, Munich and Timisoara) and add more later. Today the country and city filters are shown but do
nothing, and the category list offers Theatre and Clinic, which no place can be, while leaving out institution, public service and other
(`docs/PRODUCT.md` §8, `docs/planning/TECH-TASKS.md` §16).

## Done when
On a phone first:

- [x] Explore has a country filter, a city filter and a type-of-place filter. Each lists only values that have a published guide, in the
      visitor's language.
- [x] Choosing a country narrows the city list to that country's cities. The cards narrow to match.
- [x] The type list offers exactly the types a place can be (institution, museum, hotel, cultural venue, public service, other) that have a
      published guide, and no others.
- [x] If the filters leave no places, the page says so plainly and offers a "Clear filters" button.
- [x] Works with keyboard and screen reader, in EN, RO and DE.

## Not in scope
- Search by name (later).
- A language filter.
- Accessibility-feature filters.
- Ads or sponsored cards (to discuss separately).
- Sorting and a map view.
- Countries and cities that have no published guide yet.

## Decisions
- Ledger T-003 hid the filters while there is only one place. Now each filter is hidden when it would offer only "All", which covers that case.
- The country comes from the place's country code (new column in `published_places`, migration `20261027090000_explore_country.sql`); country names come from the browser's `Intl.DisplayNames`, so no list of names to maintain.
- Types are named as in the guide builder (`placeTypeName`). A place whose organisation left the country out still shows under "All" but is never offered under a country.
- The fictional example appears only when no country or city is chosen, and for "Museum" or "All" types.

## Result
Pull request: euroschneider-spec/vianorae#103.

Changed: migration `20261027090000_explore_country.sql`, `src/lib/explore-filters.ts`, `src/components/explore-catalog.tsx`, `publishing.ts`, three "Clear filters" texts.

Ran: typecheck, lint, `test:unit` (new `explore-filters.test.ts`, `explore-catalog.test.tsx`), `test:db`, `test:workspace --group=workspace`, `tests/platform.spec.ts` and `tests/top-bar.spec.ts`.

Not run: the other three workspace groups (CI runs them), the remaining browser specs, and a check on a real database with several countries.
