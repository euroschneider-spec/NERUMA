---
status: building   # idea → building → done
date: 2026-10-13
---

# Synthetic data: a made-up but realistic organisation world

## Idea
One dataset of fictional people, organisations and places, in every state the app can be in, that fills the fake Supabase behind
`npm run dev:mock` and can later be loaded into the `neruma-dev` project. Made-up but believable (Romanian, German and
English names, real-looking text, photos), so it can also be shown to museums.

## Why
The sites and tests today start nearly empty: five users, one museum with five steps, one waiting request. That hides what the
dashboard, the administrator's queue, Explore and the QR flow look like with real content, and it can't exercise the edge
cases (a 51st organisation, a name starting "Place", long names, a language that isn't complete yet). It is also what a real
(no fake) browser test against `neruma-dev` will need. TECH-TASKS §1 asked for it. Agreed with the owner, 2026-10-13: first for
the fake Supabase, then for `neruma-dev`.

## Done when
- [x] `npm run dev:mock` opens with people in every state (listed in `docs/guides/TESTING.md`): a second platform administrator,
  an organisation admin, owners of published, draft, unpublished and suspended organisations, applicants whose request is waiting,
  needs more information or was rejected, an unconfirmed account, and an owner who has two-factor set up.
- [x] Places in every state: published in 3, 2 and 1 languages; one with a language still too short to publish; draft only;
  published then unpublished (its QR code says "unavailable"); edited after publishing (asks to publish again); one with photos.
- [x] Edge data: a place named "Place des Arts", a name of about 130 characters with Ș, ö, ß, quotation marks and a tick, own fields and removed fields on a step.
- [x] `npm run test:data` loads the dataset into a real Postgres with the real migrations and checks all of the above, that
  every email ends `@example.test`, every name says "(fictional)", and that loading it twice gives the same result.
- [x] A volume option adds 54 more organisations for one owner and 100+ places in one, for the "large organisation" cases.

## Not in scope
- Real people, real emails, or copies of production data. Ever.
- Loading it into `neruma-dev` (the next step: a SQL file, with a guard that refuses anything but a dev project).
- Using it in unit tests (small hand-written cases stay clearer there).

## Decisions
- The dataset is created **through the real functions** (`save_place_draft`, `publish_place`, `unpublish_place`,
  `submit_problem_report`, `review_organization_application`), called as the person who would call them. So it is valid by
  construction, and loading it doubles as an integration test of those functions. Only the system-owned parts (users,
  organisations, memberships, applications) are inserted directly.
- One loader, `scripts/synthetic-data.mjs`; photos are generated (`sharp`), warm and abstract.
- The shared Postgres-that-looks-like-Supabase setup moved to `scripts/pglite-supabase.mjs`; the test database and the fake
  Supabase had each carried an identical copy (a third would have been the loader's).
- Every seeded name carries "(fictional)", every email ends `@example.test`, and one shared test password is documented in
  `scripts/workspace-fixture.mjs`.

## Result
`scripts/synthetic-data.mjs` (+ `scripts/synthetic-data/content.mjs`): 12 fictional people, 7 organisations (55 with volume), 9 places
(114 with volume), 4 generated pictures, 3 problem reports, 2 reviewed requests. `scripts/pglite-supabase.mjs` and
`scripts/fixture-base.mjs` are the shared set-up it needed (the test database and the fake Supabase had each carried a copy).
`npm run test:data` (18 checks, in `npm run check`). Seen in a real browser against the fake Supabase: every person signs in as
designed, including the two-factor step. Not done: loading it into `neruma-dev`.
