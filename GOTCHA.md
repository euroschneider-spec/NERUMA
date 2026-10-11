# Gotchas

Mistakes made during AI-assisted work on this repo, so they don't repeat.

## 2026-10-08 — wrote a unit test for an unreachable branch

While adding the first Vitest unit tests (`tests/unit/reading-settings.test.ts`) for
`launcherTop()` in `src/components/reading-settings.tsx`, I wrote a test asserting the
"too close to the bottom edge" clamp branch. The formula is
`clamp(viewportHeight - buttonHeight - 24, 8, viewportHeight - buttonHeight - 8)` — the
natural (unclamped) value is always exactly 16px inside the upper bound, so that branch
can never actually trigger; only the "viewport too short" (lower bound) branch is
reachable. The test asserted a value that doesn't correspond to any real input and failed
for the wrong reason. Removed it instead of patching the assertion, since a corrected
version would have duplicated the existing "short viewport" test.

**Takeaway**: before asserting a clamp/range edge case, check whether the surrounding
formula can actually produce a value in that range — don't assume both bounds of a
`clamp()` are independently reachable.

## 2026-10-08 — new Vitest file broke full Playwright runs (glob collision)

Right after adding `tests/unit/reading-settings.test.ts`, a full `npx playwright test`
run (no file args) started failing with `Cannot find module '.../node_modules/next/navigation'
imported from .../reading-settings.tsx` — but only when all three `.spec.ts` files ran
together via directory discovery; any explicit subset, or any single file, passed. That
red herring cost real time: I first suspected a Next 16 dev/HMR cross-origin issue (real,
but separate — see below), then a stale reused server process, before realizing Playwright's
default `testMatch` pattern matches `*.test.ts` as well as `*.spec.ts`. Only a bare/full-dir
run discovers `tests/unit/*.test.ts`; explicit `.spec.ts` args never did, which is why the
failure looked file-combination-dependent instead of "my new file" dependent. Playwright
tried to load the unit test (and transitively `reading-settings.tsx`) through its own
Node/ESM loader, which can't resolve Next's `next/navigation` subpath export the way
Next's bundler does.

**Fix**: added `testIgnore:'**/unit/**'` to `playwright.config.ts` so Vitest (`tests/unit/`)
and Playwright (`tests/*.spec.ts`) never share discovery.

**Takeaway**: when two test runners share a `tests/` root, check both tools' default file
globs for overlap before assuming a new file is inert to the other runner.

## 2026-10-08 — ran Playwright against `npm run dev` instead of production

Separately, I initially checked the button fix by reusing the already-running `npm run dev`
server (`reuseExistingServer:true` happily reused it) instead of letting Playwright start
its configured `npm run start` (production) server. Next.js 16 blocks cross-origin dev
resources by default; the dev server was reachable at `127.0.0.1:3000` fine for plain page
loads, but its HMR websocket silently failed under that origin, client hydration never
completed, and every test interacting with the reading-settings button failed — with zero
relation to the actual code change. The project's own `playwright.config.ts` already encodes
the right behavior (`webServer.command:'npm run start'`); I just bypassed it by having a dev
server already up on the same port.

**Takeaway**: stop any `npm run dev` process (or just check `lsof -i:3000`) before running
`npm run test:e2e` — let Playwright own the server it's configured to use rather than silently
reusing whatever happens to already be listening on the port.

## 2026-10-08 — "fixed" the theme script warning and brought the flash back

Dark is the stylesheet default, so a visitor who chose light or high contrast needs their stored
preference applied before first paint. `src/app/[locale]/layout.tsx` does that with a plain inline
`<script>` in `<head>`. React 19 logs a console error for it: *"Encountered a script tag while
rendering React component. Scripts inside React components are never executed when rendering on
the client."*

I tried to silence it with `next/script` and `strategy="beforeInteractive"`. The error went away,
so it looked fixed. It was not: inspecting the served HTML showed Next had deferred the script
into its `self.__next_s` queue *after* `<body>`, where it runs during hydration rather than before
paint. `data-theme` read `dark` at navigation commit and only settled to `light` afterwards — the
flash was back, now invisible in the console.

**The warning is expected and correct**: the script is inert on a client re-render. It only needs
to run once, in the server-rendered HTML, which it does. It is logged by development builds only;
a production server reports no console errors.

**Decision (owner, 8 October 2026)**: keep the inline script. The alternative is reading the
preference from a cookie and rendering `data-theme` server-side, which removes the script
entirely but opts all 76 prerendered pages into dynamic rendering.

**Takeaway**: before silencing a framework warning, confirm the replacement still does the job the
original did. Check the served HTML, not just the console.

## 2026-10-11 — a rename left CI red on `main` for several merges

`.header-login` was renamed to `.nav-login` when sign-in moved into the menu. The Playwright specs in
`tests/` were updated, but `scripts/test-workspace.mjs` still looked for the old class, so
`npm run test:workspace` failed in CI on `main` from then on. Two more workspace checks were already
red for unrelated reasons (a bare `getByRole('alert')` also matching Next's route announcer, and the
fixture returning auth errors as `code` instead of `error_code`, which supabase-js ignores). Pull
requests kept merging because nothing required the checks to pass.

**Fix**: updated the selector, scoped the alert checks to `main`, and fixed the fixture's error field.

**Takeaway**: when renaming a class, id or visible label, search `scripts/` as well as `tests/`
(`grep -rn "old-name" src tests scripts`). Also turn on branch protection so a red `checks` job blocks
the merge.

## 2026-10-11 — `test:workspace` leaves a fixture build that breaks the browser tests

`npm run test:workspace` builds the app with fictitious Supabase settings into `.next`, and leaves
that build there. Running `npm run test:e2e` or any Playwright spec afterwards starts the same build,
where sign-in is enabled. The "registration is discoverable and inactive" and "publication review"
tests then fail, with no connection to the code that was changed.

**Fix**: `npm run build` (no environment settings) before running the browser specs again.

**Takeaway**: after `test:workspace`, rebuild before running Playwright. Better: build the fixture
version into its own `distDir`, or have the script clean up when it finishes.

## 2026-10-11 — test runs rewrite tracked screenshots

The Playwright specs and `test-workspace.mjs` write eleven preview images into
`docs/verification/screenshots/` on every run, and those files are tracked. Every local run
therefore leaves modified binary files that are easy to commit by accident (a stray image diff in an
otherwise tiny change).

**Takeaway**: before committing, check `git status` for `.png` changes and restore them
(`git checkout -- docs/verification/screenshots`) unless the screenshots were meant to change.

## 2026-10-11 — merged a pull request with one check red

Pull request #16 showed two `checks` runs. One failed on "reading preferences persist and contrast
themes pass automated checks"; the other passed. I ran `gh pr checks 16 | grep -c fail`, saw `1`, and
merged in the same command anyway. `main`'s own run afterwards passed, so nothing was broken, but the rule
in `CLAUDE.md` (never merge while a check is red) was broken.

The failure was a flake, not a real contrast problem: `a, button { transition: background .15s, color .15s }`
fades colours, and the test switched to the high-contrast theme and ran axe straight away, so axe sometimes
read half-faded colours (light grey on blue) from the filled buttons. Passing and failing runs on the same
code is the sign of it.

**Fix**: the test now emulates reduced motion, which switches the fade off.

**Takeaway**: never put the check and the merge in one command. Look at the check output first, and a red
run means stop, even when another run is green. When two runs of the same code disagree, suspect timing
(animations, transitions) before suspecting the change.
