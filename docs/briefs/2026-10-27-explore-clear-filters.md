---
status: done   # idea → building → done
date: 2026-10-27
---

# Explore: "Clear filters" when nothing matches

## Idea
When the Explore filters leave no places, the page offers a **Clear filters** button next to the "No guide matches these filters." message.

## Why
Explore already filters by country, city and type (pull request 101). A visitor who combines them into an empty page (for example a type that does not
exist in the chosen country) has to reset three dropdowns by hand. This replaces the first brief of the day (pull request 103, closed), whose filters
were already on `main`; only this part was missing.

## Done when
- [x] With a combination that has no place, the page says "No guide matches these filters." and shows **Clear filters**, in EN, RO and DE.
- [x] The button puts all three filters back to "All", and the places come back.
- [x] The button is not there while something matches.

## Not in scope
- Hiding a filter that offers only "All". `tests/platform.spec.ts` ("without published guides Explore offers only the categories it can show") expects the
  Category filter with its single choice, so that was already decided on `main`.
- Name search, a language filter, accessibility filters, ads, sorting and a map.

## Decisions
- The button sits under the result line and is only rendered when the result count is zero; the count message stays a `role="status"` region.

## Result
`src/components/explore-catalog.tsx`, three texts in `src/lib/i18n.ts`, new `tests/unit/explore-catalog.test.tsx`.
Ran: typecheck, lint, `test:unit`, `tests/platform.spec.ts`. Not run: `test:db` and `test:workspace` (no database or fixture code changed).
