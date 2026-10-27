---
status: idea   # idea → building → done
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

- [ ] Explore has a country filter, a city filter and a type-of-place filter. Each lists only values that have a published guide, in the
      visitor's language.
- [ ] Choosing a country narrows the city list to that country's cities. The cards narrow to match.
- [ ] The type list offers exactly the types a place can be (institution, museum, hotel, cultural venue, public service, other) that have a
      published guide, and no others.
- [ ] If the filters leave no places, the page says so plainly and offers a "Clear filters" button.
- [ ] Works with keyboard and screen reader, in EN, RO and DE.

## Not in scope
- Search by name (later).
- A language filter.
- Accessibility-feature filters.
- Ads or sponsored cards (to discuss separately).
- Sorting and a map view.
- Countries and cities that have no published guide yet.

## Decisions
- Ledger T-003 hides the filters while there is only one place. Keep that behaviour unless the owner says otherwise.

## Result
Filled in at the end.
