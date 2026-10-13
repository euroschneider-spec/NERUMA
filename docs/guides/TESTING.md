## Which tests to run after a change

Full `npm run test:e2e` takes 1–3 minutes and mostly re-verifies untouched areas. CI
(`.github/workflows/check.yml`) already runs the complete gate on every pull request, and this
repository is public, so those runner minutes are free. Locally, scope the run.

**Always, after any source change** (~10 seconds):

```sh
npm run typecheck && npm run lint && npm run test:unit
```

**Then the matching browser tests**, by what changed:

| Changed | Run |
|---|---|
| `site-header`, `site-footer`, `theme-toggle`, chrome CSS | `tests/platform.spec.ts` |
| `guest-guide`, `guide-viewer`, `guide-text`, `lib/demo` | `tests/platform.spec.ts` + `tests/reading-accessibility.spec.ts` |
| `read-aloud`, `lib/speech` | `tests/read-aloud.spec.ts` |
| `reading-settings`, `lib/reading-prefs` | `tests/reading-accessibility.spec.ts` + `tests/read-aloud.spec.ts` |
| `auth/actions`, `lib/roles`, `lib/workspace*` | `tests/platform.spec.ts` + `npm run test:unit` |
| `two-factor*`, `login/verify`, `lib/two-factor*` | `npm run test:db` + `npm run test:workspace` + `npm run test:unit` |
| `publishing`, `publish-dialog`, `published-server`, `/q`, `/api/guide-photos`, Explore, the guide page | `npm run test:db` + `npm run test:workspace` (the whole flow: publish, visitor, QR, edit, unpublish, notice) + `tests/guide-example.spec.ts` + `npm run test:unit` |
| `lib/demo-workspace`, `components/demo-workspace`, `online-builder`, `location-cards`, `draft-preview`, `step-photo`, `org-sidebar` | `tests/demo-workspace.spec.ts` + `npm run test:unit` + `npm run test:workspace` (the same components serve the signed-in workspace) |
| Design tokens or palette in `globals.css` | **everything** — the axe WCAG contrast sweeps are spread across all three spec files |

```sh
PORT=3100 npx playwright test tests/platform.spec.ts
```

**Before pushing:** `npm run check && PORT=3100 npm run test:e2e`, or open the pull request and
let CI run it.

Always pass `PORT` when a `next dev` server may be running. Playwright's `reuseExistingServer`
adopts whatever already listens on the port, and a dev server's HMR socket breaks hydration under
test — every interactive test then fails for reasons unrelated to the change. See GOTCHA.md.

## The demo workspace

`/en/demo` needs no sign-in and no database: any build serves it, and `npm run dev` is enough. It is the real organisation app saved only in the browser (`localStorage`, keys `neruma:demo:v1:<id>`, plus IndexedDB for photos). Open it in a private window to see the original; *Reset demo* brings it back.

## Browsing locally as a signed-in user

`npm run dev:mock` starts the test fixture (a fake Supabase backed by the real migrations, in memory) and
`next dev` wired to it, so you can sign in without a real database. Stop your normal `npm run dev` first
(Next allows one dev server per folder), then open http://localhost:3000/en/login.

| Email | What it is |
|---|---|
| `owner3@example.test` | Platform administrator; one request (Linden Gallery, with a PDF) waits in the queue. Asks for a two-factor code: run `node scripts/fixture-totp.mjs` |
| `owner2@example.test` | Owner of the fictional Willow Museum: one location, five zones (`supabase/seed.sql`) |
| `owner1@example.test` | Owner of "Fixture museum 1", an empty organisation (to try creating a first location) |
| `owner4@example.test` | Signed in, no organisation yet (can apply) |
| `owner5@example.test` | The applicant behind the waiting Linden Gallery request |

This browsing data is switched on by `VIANORAE_FIXTURE_DEMO_DATA=1`, which only `dev:mock` sets; the test
suites start from the plain fixture.

The shared test password is `FIXTURE_PASSWORD` in `scripts/workspace-fixture.mjs`. Everything resets when you
stop it. It reads the migrations only when it starts: after switching to a branch with a new migration, stop it and
start it again. Set `DEV_MOCK_PORT` to use another port. It refuses to start under `NODE_ENV=production` or on Vercel.

A hosted dev database for trying migrations against a real Supabase is described in [DATABASE-ENVIRONMENTS.md](DATABASE-ENVIRONMENTS.md).
