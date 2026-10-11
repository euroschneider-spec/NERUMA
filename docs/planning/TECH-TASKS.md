# Technical tasks

Collected on 2026-10-11. Each section says what exists today (checked in the code) and what is left.
Design work is in `docs/planning/DESIGN-TASKS.md`. Plan prices and limits below are from Supabase's published
plans; check them on supabase.com/pricing before deciding.

## 1. Mock data and mock users

**Today:** `supabase/seed.sql` creates one fictional organisation and place (Willow Museum, five
zones) but no users. `scripts/workspace-fixture.mjs` is a fake Supabase used only by tests. The demo
workspace saves to the browser, not to the database.

- [x] **Started (no Docker needed):** `npm run dev:mock` runs the site against the test fixture with five mock
  users (platform administrator, two organisation owners, two users without an organisation); see
  `docs/guides/TESTING.md`. It now has the Willow Museum (five zones) and one request waiting for review.
  Still missing: photos, organisations in other states (needs information, suspended), several places.
- [ ] Seed script for a **local** Supabase (`supabase start`) that creates one user per state:
  platform administrator, organisation owner, organisation admin, applicant waiting for review,
  applicant asked for more information, suspended organisation.
- [ ] Several organisations and places in different statuses (draft, pending, approved, suspended),
  cities, countries and categories, so the dashboards, the admin queue and the Explore filters have
  something to show.
- [ ] Fictional names and `@example.test` emails only. Document the shared local password in the
  script itself, never in a real environment.
- [ ] A guard that refuses to run unless the database URL is local, so it can never hit production.
- [ ] Note: the *For organisations* page promises editors, assessors and reviewers, but the code only
  models `owner` and `admin` (`src/lib/roles.ts`). Decide whether to add the roles or change the copy
  before building mock users for them.

## 2. Follow system settings

**Today:** the theme defaults to dark and ignores the device setting (`defaults` in
`src/lib/reading-prefs.ts` and the pre-paint script in `src/app/[locale]/layout.tsx`). Reduced motion
is already respected. The root URL always redirects to English (`src/app/(entry)/page.tsx`).

- [ ] Theme: when nothing is stored, the pre-paint script uses `prefers-color-scheme`. It listens for
  changes until the visitor picks a theme. Store the theme only once they choose. Add a "system"
  value to `Theme` and keep stored preferences loading (see the `fromStored` comment). Read GOTCHA.md
  "fixed the theme script warning and brought the flash back" first.
- [ ] Consider `prefers-contrast: more` → high contrast theme.
- [ ] Language: the root URL picks EN/RO/DE from the browser's `Accept-Language`, falling back to EN.
  A language chosen in the menu wins.
- [ ] Tests: update `tests/reading-accessibility.spec.ts` for the new default (Playwright can emulate
  `colorScheme`). The axe contrast sweeps must run in both themes.

## 3. Cookies and the law

Not legal advice. Confirm with a lawyer before a public launch.

**Today:** no analytics or tracking. Two things are stored on the device:
- Supabase sign-in cookies (`src/lib/supabase/server.ts`), only for signed-in organisations.
- Reading preferences in `localStorage` (`vianorae:reading:v1`). The demo builder also keeps photos
  in the browser.

Under the EU ePrivacy rules (Romania: Law 506/2004; Germany: TDDDG §25), storage that is strictly
necessary for something the user asked for needs no consent. Sign-in sessions and settings the visitor
chose fall under that. **So no cookie banner is needed as things stand.**

- [ ] The privacy page doesn't mention device storage at all. Add a short section listing the sign-in
  cookies and the preference storage: what each is for and how long it lasts. GDPR requires this
  information even without consent.
- [ ] Rule for later: adding analytics, embedded maps or videos, or any third-party script means
  re-checking consent before it ships.

## 4. Email

**Today:** Supabase's built-in email sends the confirmation mail. It is for development only: it is
limited to a few emails per hour, and Supabase restricts it to the project team's own addresses. So
real applicants may not receive their confirmation email. There is a template in
`supabase/templates/confirmation.html`.

Missing: password reset (no recovery flow exists in the code), team invitations, and notifying
applicants of an administrator's decision.

- [ ] Choose an SMTP provider and connect it in Supabase (Authentication → Emails → SMTP settings):
  - **Brevo**: EU company, free tier around 300 emails/day. Simplest fit for GDPR.
  - **Resend**: free tier around 3,000/month; good developer experience; US company with an EU
    sending region.
  - **Postmark**: paid, best known for deliverability.
  - **Amazon SES**: cheapest at volume; more setup.
- [ ] Sending domain: add SPF, DKIM and DMARC records on the domain's DNS (e.g. a
  `mail.lignorae.com` subdomain, or the final NERUMA domain).
- [ ] Add a password-reset flow (Supabase `resetPasswordForEmail` + a "set new password" page) in
  EN/RO/DE.
- [ ] Translate the email templates into RO and DE.

## 5. Images and storage

**Today:**

| Where | Accepted | Limit | Stored |
|---|---|---|---|
| Demo builder (browser) | JPEG, PNG, WebP | 5 MB in; resized to 1600px, WebP 85% | Browser only |
| Online builder | WebP (converted in the browser) | 3 MB | Private bucket `vianorae-private-photos` |
| Mandate documents | PDF, JPEG, PNG | 3 MB | Private bucket `vianorae-mandate-evidence` |

Photos go into Supabase Storage, not the database. The database only keeps their keys and alt text,
so database size is not the constraint. A 1600px WebP is roughly 200–400 KB, so a guide with eight
zones is about 3 MB.

- [ ] Pick a plan. **Free:** 1 GB storage (≈ 300 such guides), 50 MB per file, 5 GB/month egress,
  and the project **pauses after a week without activity**, which is unacceptable for a live site.
  **Pro (≈ $25/month):** 100 GB storage, 250 GB egress, image resizing on the fly, no pausing.
- [ ] Publishing: public guides need their photos served publicly. Use a public bucket for
  published copies, or signed URLs with caching. Decide which.
- [ ] Decide on a photo limit per zone and per guide, and enforce it in the database, not only in
  the form.
- [ ] Strip EXIF location data from uploads. Re-encoding in the browser does this today; keep it so
  if the pipeline changes.

## 6. Input limits and mandatory fields

**Today:** forms set `maxLength` (160 for names and titles, 500 and 2000 for descriptions, 254 for
email, 128 for password). The organisation request has database checks on its text fields. Ten fields
on the request form are `required`.

- [ ] Make one table of every field: required?, min/max length, browser check, server check,
  database check. Fix any field that is only checked in the browser.
- [ ] Decide what a guide needs before it can be published, e.g. place name, at least three zones,
  and a title and description per zone. Sensory levels may stay "not recorded". Alt text is required
  whenever there is a photo.
- [ ] Error messages per field in EN/RO/DE, linked to the field (`aria-describedby`), not only a
  message at the top.

## 7. Password rules

**Today:** the register form asks for at least 12 characters, but only in the browser. The Supabase
config in this repo (`supabase/config.toml`) allows 6 characters with no other rules. Anyone who skips
the form can therefore set a 6-character password.

- [ ] Set the minimum to 12 in the hosted project (Authentication → Policies or Providers → Email →
  minimum password length), and in `config.toml` so local matches.
- [ ] Keep it to length only. Current guidance (NIST 800-63B) advises against forced symbol/number
  rules. Low effort, and fits the low-risk assessment.
- [ ] Optional on Pro: leaked-password protection (checks against known breached passwords).

## 8. Subscription flow for institutions

**Today:** nothing exists; the site states "No subscriptions or paid services are active".

Suggested flow: request access → administrator approves → **choose a plan and pay** → publishing
unlocks. Drafting and preview stay free, so organisations can try the builder first.

- [ ] Choose a provider:
  - **Stripe** (Checkout + Customer Portal + Stripe Tax). Most control; you handle EU VAT and
    invoices. Collect a VAT ID for B2B reverse charge.
  - **Paddle** or **Lemon Squeezy** as "merchant of record". They handle VAT and invoices; higher fees.
- [ ] Data: a `subscriptions` table per organisation (plan, status, period end), readable by its
  members and written only by the payment webhook.
- [ ] Webhook: a route under `src/app/api/` verifies the provider's signature and updates the status.
  The project currently uses no service-role key (README), but a webhook has no user session. It needs
  a narrowly scoped database function called with a webhook secret, or a deliberate exception to that
  rule. This is a security decision to make before building.
- [ ] Where it shows: a *Plan & billing* tab in the organisation dashboard (owners only), plus a
  publish button that explains what's needed when there is no active plan.
- [ ] Decide what happens on non-payment: hide published guides, or keep them visible but locked
  for editing.
- [ ] Update the terms and privacy pages before taking any payment.

## 9. A consistent voice for read-aloud

**Today:** read-aloud uses the browser's built-in speech (`speechSynthesis`, `src/components/read-aloud.tsx`
and `src/lib/speech.ts`). The voice is whatever the visitor's device has, so it sounds different, and often
robotic, on every phone. If the device has no voice for the page language, it shows a "no voice" message.
The code comment says no text is sent to any server; keep that promise or update the privacy page.

**Idea: generate the audio once, play a file.** Guide and page text is known in advance and changes rarely
(5 zones × 3 languages today). A text-to-speech service would turn each piece of text into an audio file
when the text is published, and the page would play that file with a normal audio player. The visitor's
text never leaves the browser, the voice is identical on every device, there is no cost per listen, and it
works offline once loaded. Browser speech stays as the fallback until a file exists.

- [ ] **Compare voices by listening.** Write one test paragraph per language (EN, RO, DE) and generate it
  with each candidate. Romanian is the deciding language; no source I found confirmed Romanian quality
  for every provider. Candidates:
  - **Azure AI Speech**: has Romanian neural voices (`ro-RO-AlinaNeural`, `ro-RO-EmilNeural`) and German
    and English ones. About $15–16 per million characters, with a free allowance of about 0.5M characters a
    month (sources disagree; check Microsoft's pricing page).
  - **Google Cloud TTS**: about 75 languages; $4 per million characters for standard and WaveNet voices,
    about $30 for the newest Chirp 3 HD voices.
  - **ElevenLabs**: the most natural voices and the highest price (roughly $60–180 per million characters),
    with fewer languages.
  - **Amazon Polly**: cheap ($4 or $16 per million), 29–36 languages; check whether Romanian is included.
  - **Piper** (open source, runs on your own server or in the browser): free; has Romanian and German
    voices. Each voice has its own licence in its MODEL_CARD, and some restrict commercial use. Quality is
    below the paid services.
- [ ] **Check the licence of the generated audio.** Confirm in the provider's terms that you may store and
  redistribute the audio files, and that the free tier allows it.
- [ ] **Rough cost.** A guide of 8 zones is about 5,000 characters per language, so about 15,000 characters
  in three languages, about $0.25 at $16 per million. The static pages (about 10 pages) add roughly
  $1–2 once. The monthly free allowance would likely cover everything until there are many organisations.
- [ ] **When audio is generated.**
  - Static site pages: a build or one-off script, saved in `public/audio/`.
  - Organisation guides: when the organisation publishes. Editing the text after publishing marks the audio
    as out of date, and the player falls back to browser speech until it is regenerated. This needs a
    server-side call, so it ties in with the key and webhook decisions in section 8.
- [ ] **Where files live:** a public Supabase Storage bucket for published guides (see section 5), next to
  the published photos. Key audio by text hash and language so unchanged text is never paid for twice.
- [ ] **Player:** replace the speech calls in `read-aloud.tsx` with a standard `<audio>` element. Keep play,
  pause, stop and speed (`playbackRate`). A file gives pause and speed control for free, and removes the
  chunking and browser quirks the current code works around.
- [ ] **Pronunciation:** test place names, "NERUMA" and abbreviations in all three languages. Most services
  accept SSML to fix individual words.
- [ ] **Accessibility:** keep the text-only view and the browser fallback; audio is an addition. A
  transcript is already the page text. Check the player with a screen reader.
- [ ] **Privacy:** use an EU region (for Azure, West Europe or Sweden Central), sign the provider's data
  processing agreement, and add the provider to the privacy page. Only guide text is sent, never visitor
  data.
- [ ] **Reading the whole web app aloud** (the "listen to this page" option): this works for the fixed
  pages the same way. For anything dynamic or signed-in, keep browser speech.

## 10. Clean-up candidates

Found on 2026-10-11. None are bugs.

- [ ] `src/lib/database.types.ts` is imported nowhere. It looks like generated Supabase types. Either use
  them to type the database calls or delete the file.
- [ ] `scripts/create-demo-seed.mjs` is not in `package.json` or CI, but it writes `supabase/seed.sql` from
  `src/lib/demo.ts`. Keep it, and add an npm script (e.g. `seed:generate`) plus a line in the README so the
  seed file is not edited by hand.
- [ ] Four illustrations (`collection`, `interactive`, `quiet-room`, `reception`) look unused but are
  loaded by zone name in `src/lib/demo.ts`. Keep them.
- [ ] A few exports are used only inside their own file (e.g. `readPreferences`, `validApplication`,
  `dictionaries`). Harmless; remove the `export` when next editing those files.

## 11. Test strategy

**What exists:** 52 browser tests (Playwright: `platform`, `reading-accessibility`, `read-aloud`), 35 unit
tests (Vitest, `tests/unit/`), a 69-check security suite for the database (`npm run test:db`, local
PGlite), and a 38-check suite for the organisation workspace against a fake Supabase
(`npm run test:workspace`). CI runs all of them on every push and pull request. Which tests to run
locally is in `docs/guides/TESTING.md`.

**What each kind of test is for:**

| Kind | Test this | Not this |
|---|---|---|
| Unit (Vitest) | Pure logic with inputs and outputs: validation, role checks, text splitting, preference parsing, limits | Anything that needs a browser or a database |
| Database (`test:db`) | Who can read or write which rows, and the constraints. Every new table or policy gets a "can't" case, not just a "can" case | Page layout |
| Workspace (`test:workspace`) | Multi-step organisation flows with real sessions: apply → review → approve → edit → publish | Visual details |
| Browser (Playwright) | What a visitor or organisation does: pages load, navigation works, forms show errors, reading settings persist, and axe accessibility scans | Logic that a unit test could cover faster |

**Rules for adding the right tests:**

- [ ] Every bug fix starts with a test that fails for that bug. If CI was green while the bug existed,
  the suite had a gap.
- [ ] Every new input gets a rejection test (too long, empty, wrong type) at the server, not only in the
  browser. This ties in with section 6.
- [ ] Every new page or component with text gets an axe scan in each language and theme. Contrast bugs
  appear only in the combinations nobody opened.
- [ ] Every new permission gets two tests: the right person succeeds, and a signed-out user and a member of
  another organisation both fail.
- [ ] Each section of this file and the design file states its own "done when": what a person can do and
  see. The tests are written from that sentence, not from the code.
- [ ] Prefer the user's words in selectors (`getByRole('button', {name})`, `getByLabel`). A test that needs
  a CSS class to find something is probably testing the markup instead of the behaviour. Two of the CI
  failures fixed on 2026-10-11 were of this kind (`.header-login`, a bare `getByRole('alert')`).
- [ ] Add layout checks for the things this review kept finding: no horizontal scroll at 320, 360, 390 and
  768px, and the content edges lining up with the header (the `--gutter` fix).
- [ ] Add a test for the visitor / organisation split: a signed-out visitor sees no organisation-only link
  or notice (design file, section 1).

**Gaps found so far:**

- [ ] **CI was red on `main` for several merges and nothing stopped them.** In GitHub, turn on branch
  protection for `main` with "Require status checks to pass" (the `checks` job). Settings → Branches →
  Add rule.
- [ ] The tests write screenshots into `docs/verification/screenshots/` on every run, so every local run
  leaves modified binary files. Either write them to an ignored folder, or only on request (an environment
  variable), and commit them deliberately.
- [ ] `npm run test:workspace` builds the app with fictitious auth settings into the same `.next` folder as
  a normal build. Running it and then the browser tests makes the registration and publication tests fail,
  with no relation to the code. Build the fixture version into a different folder (`distDir`), or have the
  scripts delete `.next` when they finish. Add this to `GOTCHA.md` once fixed.
- [ ] No test covers email delivery, password reset, billing or audio, because none exist yet. Each of
  sections 4, 8 and 9 needs its tests defined before the feature is built.
- [ ] No visual regression tests. A few full-page screenshot comparisons (home, guide, login at 390 and
  1280px) would catch the kind of alignment bugs found in the design review, at the cost of updating
  baselines when the design changes on purpose.
- [ ] No test runs against the deployed Vercel preview. After the first real organisation pilot, add a
  small smoke test (home loads, example guide opens, sign-in page loads) that runs after each deployment.

## 12. Organisation app: what the dashboard work left open

Added on 2026-10-11, after the dashboard cards (PR #29). Decisions are in `DECISIONS.md`; the brief is
`docs/briefs/2026-10-11-organisation-app.md`.

**To do with publishing (needs Opus; the choices are already made, see "QR codes" in `DECISIONS.md`):**

- [ ] **QR registry migration.** Today `qr_redirects` has a text `public_code` that points at one guide, which
  is one language, and the only working code is the hard-coded `willow-museum` in `src/lib/qr.ts`. Change it to
  one short random code per place, created in the same transaction as the first publish, never deleted or
  reused. Add database tests for the "can't" cases: another organisation can't read or change a code, and a
  code that exists is never handed to a second place.
- [ ] **Which language opens.** `/q/[code]` picks the visitor's language when it is published, otherwise a
  published one, with the language switch available.
- [ ] **The "isn't available right now" page.** Visitors can't read unpublished rows, so a narrow database
  function answers only "exists, not available" without returning the name. Replace the bare 404 in
  `src/app/q/[code]/route.ts`.
- [ ] **QR and link on the dashboard card.** A "QR & link" button opens a pop-up with the code (view and
  download) and a copy-link button. Shown only once the place has a code. The pop-up is Sonnet work once the
  migration exists.
- [ ] **Needs attention, the missing items.** "Unpublished changes" and "not verified on site" need publishing
  first. Add them to `placeAttention()` in `src/lib/workspace.ts` then.

**Waiting on the owner or a decision:**

- [ ] **Visit counts (brief 1e).** Nothing is counted today. Decide first what may be counted (for example a
  total per location, with no IP address and no cookie), then check section 3 and update the privacy page.
- [ ] **Plan & billing page (brief 1d).** A placeholder for owners only, until payments exist (section 8).
- [ ] **Apply `supabase/migrations/20261011120000_step_fields.sql`** to the real Supabase project. The app works
  without it but hides the × and "Add a field" controls.

**Test fixture limits found while building:**

- [ ] `scripts/workspace-fixture.mjs` fakes the database's REST layer by hand. It now serves embedded
  `place_translations`, `zones`, `zone_translations` and `media_assets` on `places`, and nothing else. A new
  nested `select(...)` elsewhere fails with a 500 in `dev:mock` and `test:workspace`, not on the real database.
  Say so in the fixture's header comment, or replace the hand-written layer with PostgREST.
- [ ] The fixture's port 3012 is written into four scripts, so a second copy can't run beside a running
  `dev:mock`. Read it from one `FIXTURE_PORT` setting. A copy has to sed it today.
- [ ] Editing code that talks to the database while `dev:mock` runs breaks the page until the mock is restarted,
  because the fake database loads once at start. Mention it in `docs/guides/TESTING.md`.

**Report a problem (organisations to NERUMA; `DECISIONS.md`, "Organisations can report a problem"):**

- [ ] **Table and policies (needs Opus).** A `problem_reports` table: organisation, place (optional), the sender,
  a message with a length limit, status, created time. An organisation member can add a report for their own
  organisation and read only their own; the platform administrator reads and closes all. Database tests need the
  "can't" cases: a member of another organisation, a signed-out user, and a suspended organisation can't add or read.
- [ ] **The form.** A sidebar button opens a short form (message, optional location), EN/RO/DE, with a rate limit
  so it can't be used to flood the table. Show a confirmation that says plainly it was saved, not emailed.
- [ ] **The admin list.** A page in the admin area with open reports, newest first, and a "closed" button.
- [ ] **Later, with email (section 4):** a notification to the administrator when a report arrives.
- [ ] **Visitor reports** ("something here is wrong" in the public guide, shown to the organisation) wait for
  publishing.
