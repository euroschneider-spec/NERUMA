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
| `site-header`, `site-footer`, `theme-toggle`, chrome CSS | `tests/platform.spec.ts` + `tests/top-bar.spec.ts` |
| `guest-guide`, `guide-viewer`, `guide-text`, `lib/demo` | `tests/platform.spec.ts` + `tests/reading-accessibility.spec.ts` |
| `read-aloud`, `lib/speech` | `tests/read-aloud.spec.ts` |
| `reading-settings`, `lib/reading-prefs` | `tests/reading-accessibility.spec.ts` + `tests/read-aloud.spec.ts` |
| `admin/` pages, `admin-nav`, `lib/superadmin*`, `admin/superadmin-actions`, the superadmin migration | `npm run test:db` + `npm run test:workspace` + `npm run test:unit` + `tests/privacy-security.spec.ts` |
| `auth/actions`, `lib/roles`, `lib/workspace*` | `tests/platform.spec.ts` + `npm run test:unit` |
| `two-factor*`, `login/verify`, `lib/two-factor*` | `npm run test:db` + `npm run test:workspace` + `npm run test:unit` |
| `publishing`, `publish-dialog`, `published-server`, `/q`, `/api/guide-photos`, Explore, the guide page | `npm run test:db` + `npm run test:workspace` (the whole flow: publish, visitor, QR, edit, unpublish, notice) + `tests/guide-example.spec.ts` + `npm run test:unit` |
| `lib/demo-workspace`, `components/demo-workspace`, `online-builder`, `location-cards`, `draft-preview`, `step-photo`, `org-sidebar` | `tests/demo-workspace.spec.ts` + `npm run test:unit` + `npm run test:workspace` (the same components serve the signed-in workspace) |
| `content.ts` (privacy page), anything that stores on the device (`localStorage`, cookies, `indexedDB`) | `npm run test:unit` (`storage-disclosure.test.ts` fails until the privacy page lists it) + `tests/privacy-security.spec.ts` |
| `next.config.ts` headers, `proxy.ts`, API routes | `tests/privacy-security.spec.ts` |
| `account-actions`, `deletion-actions`, `account/delete`, `admin/deletions`, `lib/account-deletion*`, `lib/zip` | `npm run test:db` + `npm run test:workspace` + `npm run test:unit` |
| A new table or column that holds personal data | `npm run test:db` fails until it is written in `docs/guides/PERSONAL-DATA.md` |
| Anything that shows organisation-typed text (guide, demo, preview) | `tests/hostile-text.spec.ts` |
| `supabase/config.toml`, `supabase/templates/` | `npm run test:unit` (`auth-config`, `email-template`) |
| `billing`, `stripe-server`, `api/stripe/webhook`, `workspace/billing`, the payments migration | `npm run test:db` + `npm run test:unit` (`billing.test.ts`) + `npm run test:workspace` (Checkout, webhook, grace, publish needs a plan); by hand: `PAYMENTS.md` section 3 |
| `brand`, `public/favicon.svg`, `public/brand/` | `tests/platform.spec.ts` (the logo in every theme) + `npm run test:workspace` (the folded sidebar) |
| `password-reset`, `password-actions`, the reset pages, `supabase/templates/` (the emails) | `npm run test:unit` (`password-reset`, `email-template`, `storage-disclosure`) + `npm run test:workspace` (the whole reset, with and without two-factor); by hand: `TEST-PLAN.md` A12 |
| `form-field`, `form-warnings`, `organisation-form` | `npm run test:unit` (`form-warnings.test.ts`) + `npm run test:workspace` (the warnings on registration and sign-in, in three languages) + `tests/platform.spec.ts` |
| `verification.ts`, the registration form | `npm run test:unit` (`verification.test.ts`) + `npm run test:workspace` |
| Design tokens or palette in `globals.css` | **everything** — the axe WCAG contrast sweeps are spread across all three spec files |

```sh
PORT=3100 npx playwright test tests/platform.spec.ts
```

**Before pushing:** `npm run check && PORT=3100 npm run test:e2e`, or open the pull request and
let CI run it.

Always pass `PORT` when a `next dev` server may be running. Playwright's `reuseExistingServer`
adopts whatever already listens on the port, and a dev server's HMR socket breaks hydration under
test — every interactive test then fails for reasons unrelated to the change. See GOTCHA.md.

## Finding elements: the words always travel with the locator

A test that finds a control must also prove it says what a person reads or hears, in the language of the run. Two ways, and
no third:

1. **By the words**: `getByRole('button', { name: 'Confirm' })`, `getByLabel('Password')`. This is the default.
2. **By a test id, with the words bound to it**: when several controls share a name, or a test drives the same control in
   every language, give the element `data-testid="…"` and find it only through `tests/support/bound.ts`:

```ts
const confirm = await button(page, 'code-confirm', 'Confirm');          // visible text AND accessible name
const code = await field(page, 'code-input', '6-digit code from the app'); // accessible name = its label
const note = await message(page, 'backup-left', /^\d+ of 10 backup codes left\.$/);
```

The helpers find the element, require exactly one that is visible, and assert its words in the same step. A control can't
pass because its id exists while its label is missing, empty, wrong or in another language, and a button whose
`aria-label` differs from its visible text fails (WCAG 2.5.3). `tests/bound-locators.spec.ts` proves the helpers refuse
each of those. `tests/unit/test-conventions.test.ts` fails the build if a test uses `getByTestId`, a `data-testid`
selector or `testIdAttribute` anywhere else. Never find an element by CSS class or id alone (GOTCHA.md, 11 October).

## The demo workspace

`/en/demo` needs no sign-in and no database: any build serves it, and `npm run dev` is enough. It is the real organisation app saved only in the browser (`localStorage`, keys `neruma:demo:v1:<id>`, plus IndexedDB for photos). Open it in a private window to see the original; *Reset demo* brings it back.

## Browsing locally as a signed-in user

`npm run dev:mock` starts the test fixture (a fake Supabase backed by the real migrations, in memory) and
`next dev` wired to it, so you can sign in without a real database. Stop your normal `npm run dev` first
(Next allows one dev server per folder), then open http://localhost:3000/en/login.

| Email | What it is |
|---|---|
| `owner3@example.test` | Platform administrator; one request (Linden Gallery, with a PDF) waits in the queue. Two-factor is set up: `node scripts/fixture-totp.mjs` prints the code |
| `admin.second@example.test` | Second platform administrator (one can't review their own request), two-factor set up, same code |
| `owner2@example.test` | Owner of the fictional Willow Museum: one location, five zones (`supabase/seed.sql`) |
| `admin.willow@example.test` | Organisation **admin** (not owner) of the Willow Museum |
| `owner.cluj@example.test` | Owner of Visual Arts Museum Cluj: eight steps in EN/RO/DE, own and removed fields, three photos, published. Two-factor is set up: `node scripts/fixture-totp.mjs owner` |
| `owner.kunsthaus@example.test` | Owner of Kunsthaus am Fluss: a German-only museum, published; a closed problem report |
| `owner.hotel@example.test` | Owner of Hotel Lindenhof: English and Romanian published, a German guide too short to publish |
| `owner.arts@example.test` | Owner of Place des Arts Society, with four locations in four states: published ("Place des Arts"), a draft with a very long name, an unfinished one-step draft, and one edited after publishing (asks to publish again) |
| `owner.railway@example.test` | Owner of a museum that took its guide down: the QR code says "unavailable" |
| `owner.harbour@example.test` | Owner of a **suspended** organisation: signs in, sees no data, and its guide and QR code say "unavailable" |
| `applicant.needsinfo@example.test` | Applicant who was asked for more information |
| `applicant.rejected@example.test` | Applicant whose request was rejected |
| `unconfirmed@example.test` | Registered but never confirmed the email: sign-in says to confirm first |
| `owner1@example.test` | Owner of "Fixture museum 1", an empty organisation (to try creating a first location) |
| `owner4@example.test` | Signed in, no organisation yet (can apply) |
| `owner5@example.test` | The applicant behind the waiting Linden Gallery request |
| `owner.large@example.test` | **Only with `DEV_MOCK_VOLUME=1 npm run dev:mock`:** owner of 55 organisations (the app lists 50) and of one with 105 places |

The people and places are **synthetic**: made up, realistic, fictional (every name says so, every address ends `@example.test`).
They are in `scripts/synthetic-data.mjs` and `scripts/synthetic-data/content.mjs`, created through the app's real database
functions, and `npm run test:data` checks them (every state is there, nothing is real, loading twice gives the same result).
The QR codes of the published places are printed when it starts; they change on every start.

This browsing data is switched on by `VIANORAE_FIXTURE_DEMO_DATA=1`, which only `dev:mock` sets; the test
suites start from the plain fixture.

The shared test password is `FIXTURE_PASSWORD` in `scripts/workspace-fixture.mjs`. Everything resets when you
stop it. It reads the migrations only when it starts: after switching to a branch with a new migration, stop it and
start it again. Set `DEV_MOCK_PORT` to use another port. It refuses to start under `NODE_ENV=production` or on Vercel.

A hosted dev database for trying migrations against a real Supabase is described in [DATABASE-ENVIRONMENTS.md](DATABASE-ENVIRONMENTS.md).

## Testing a deployed site

`tests/smoke.spec.ts` checks a real deployment, read-only, with no mocked data and no accounts created:

```sh
SMOKE_URL=https://neruma.lignorae.com npm run test:smoke
```

With the project's public address and publishable key it also asks the database, as an anonymous visitor, what it will
let anyone do. Run it after every change to Vercel's settings, after installing a migration, and before sharing a link:

```sh
SMOKE_URL=https://neruma.lignorae.com SMOKE_SUPABASE_URL=https://<ref>.supabase.co SMOKE_SUPABASE_KEY=sb_publishable_… npm run test:smoke
```

The full list of what is tested, what only a person can test, and what is still open is in
[TEST-PLAN.md](TEST-PLAN.md).

