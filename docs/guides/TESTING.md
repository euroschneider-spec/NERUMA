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
