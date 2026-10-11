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
| Design tokens or palette in `globals.css` | **everything** — the axe WCAG contrast sweeps are spread across all three spec files |

```sh
PORT=3100 npx playwright test tests/platform.spec.ts
```

**Before pushing:** `npm run check && PORT=3100 npm run test:e2e`, or open the pull request and
let CI run it.

Always pass `PORT` when a `next dev` server may be running. Playwright's `reuseExistingServer`
adopts whatever already listens on the port, and a dev server's HMR socket breaks hydration under
test — every interactive test then fails for reasons unrelated to the change. See GOTCHA.md.

## Browsing locally as a signed-in user

`npm run dev:mock` starts the test fixture (a fake Supabase backed by the real migrations, in memory) and
`next dev` wired to it, so you can sign in without a real database. Stop your normal `npm run dev` first
(Next allows one dev server per folder), then open http://localhost:3000/en/login.

| Email | What it is |
|---|---|
| `owner3@example.test` | Platform administrator (lands on the review queue) |
| `owner1@example.test`, `owner2@example.test` | Owners of "Fixture museum 1" and "Fixture museum 2" |
| `owner4@example.test`, `owner5@example.test` | Signed in, no organisation yet (can apply) |

The shared test password is `FIXTURE_PASSWORD` in `scripts/workspace-fixture.mjs`. Everything resets when you
stop it. Set `DEV_MOCK_PORT` to use another port. It refuses to start under `NODE_ENV=production` or on Vercel.
