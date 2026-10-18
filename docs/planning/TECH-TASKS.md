# Technical tasks

Collected on 2026-10-11. Each section says what exists today (checked in the code) and what is left.
Design work is in `docs/planning/DESIGN-TASKS.md`. Plan prices and limits below are from Supabase's published
plans; check them on supabase.com/pricing before deciding.

**Tidied on 2026-10-18:** what was finished since the 11th is ticked (ticked items stay, for the history); new items are in sections 15
and 16; the order below is a proposal for the owner to confirm.

## Suggested order (proposal, 2026-10-18)

1. **Small things that protect you** (minutes each, no code):
   - [ ] Turn on branch protection for `main` (§11). Needs someone with admin rights on the repository; a friend is doing it.
   - [x] Install `20261017120000_account_profile.sql` in the live database (§12). Installed (checked 2026-10-18).
   - [x] Install `20261018090000_payments.sql` in the live database (§8). Installed (checked 2026-10-18); payments are off and no plan exists.
   - [x] Check the password minimum in the hosted project (§7, §13). Production says 12, length only (checked 2026-10-18); `neruma-dev` is left in §13.
2. **Decide the provider principle** (§15): European providers, German preferred, not French (owner's lean, 2026-10-18). It settles
   email, payment and the hosting questions together.
3. **Rename the site address** to `neruma.lignorae.com` (§17), before the email DNS records are made and before any QR code is printed.
4. **Email** (§4), once the provider is chosen. It unlocks real confirmation emails, password reset, approval notices, team
   invitations, the Contact form and the administrator's report notification.
5. **The first visit of a new organisation** (`DESIGN-TASKS.md` §8): people meet it now, as soon as someone registers.
6. **Pin the Vercel region** (§15), one setting, after the principle is decided.
7. **Privacy and terms text** (§15, §16), with a lawyer. Needed before real organisations and before any payment.
8. **Features:** live preview in a second tab, team invitations, visit counts (after the privacy decision), the organisations list for
   administrators.
9. **Payment** (§8): built and switched off; set up Stripe in test mode, then go live after email and the privacy and terms text.
10. **Going live:** the full checklist is §18.
11. **Later:** a consistent read-aloud voice (§9), a storage plan and photo limits (§5), the table of every field (§6), test hardening (§11).

## 1. Mock data and mock users

**Today:** `supabase/seed.sql` creates one fictional organisation and place (Willow Museum, five
zones) but no users. `scripts/workspace-fixture.mjs` is a fake Supabase used only by tests. The demo
workspace saves to the browser, not to the database.

- [x] **Started (no Docker needed):** `npm run dev:mock` runs the site against the test fixture with five mock
  users (platform administrator, two organisation owners, two users without an organisation); see
  `docs/guides/TESTING.md`. It now has the Willow Museum (five zones) and one request waiting for review.
  Photos, organisations in other states and several places are now there (synthetic data, §1 below).
- [x] A user for every state in the fake Supabase (`dev:mock`): platform administrators, owners, an organisation admin, applicants
  waiting / asked for more information / rejected, a suspended organisation, an unconfirmed account. Still open: the same for a
  **local** Supabase (`supabase start`, needs Docker) and for `neruma-dev`.
- [x] Several organisations and places in different statuses (draft, pending, approved, suspended, taken down, edited after
  publishing), cities, countries and categories, so the dashboards, the admin queue and the Explore filters have something to
  show. Done for `dev:mock`: `scripts/synthetic-data.mjs`, checked by `npm run test:data`. Still open: loading it into the hosted
  `neruma-dev` project (a SQL file you paste, with a guard that refuses anything but a dev project).
- [ ] Fictional names and `@example.test` emails only. Document the shared local password in the
  script itself, never in a real environment.
- [ ] A guard that refuses to run unless the database URL is local, so it can never hit production.
- [ ] Note: the *For organisations* page promises editors, assessors and reviewers, but the code only
  models `owner` and `admin` (`src/lib/roles.ts`). Decide whether to add the roles or change the copy
  before building mock users for them.

## 2. Follow system settings

**Today:** the theme follows the visitor's device until they choose (done in #33, `DECISIONS.md`). Reduced
motion is already respected. The root URL always redirects to English (`src/app/(entry)/page.tsx`).

- [x] Theme: follows `prefers-color-scheme` until the visitor picks one (`data-theme-choice`, *Match my device*),
  resolved before first paint and live. Done in #33.
- [ ] Consider `prefers-contrast: more` → high contrast theme.
- [ ] Language: the root URL picks EN/RO/DE from the browser's `Accept-Language`, falling back to EN.
  A language chosen in the menu wins.
- [x] Tests: Playwright now runs as a dark device and `tests/theme-follows-device.spec.ts` emulates both. The signed-in workspace and admin pages
  are scanned with axe in every theme and tone in `scripts/test-workspace.mjs` (issue #32, fixed).

## 3. Cookies and the law

Not legal advice. Confirm with a lawyer before a public launch.

**Today:** no analytics or tracking. These are stored on the device:
- Supabase sign-in cookies (`src/lib/supabase/server.ts`), only for signed-in organisations.
- `neruma_device` (httpOnly cookie, 30 days), only when an organisation owner or admin ticks *Remember this device*
  after the two-factor code. Holds a random token; the database keeps only its hash.
- Reading preferences in `localStorage` (`vianorae:reading:v1`). The demo workspace also keeps its
  two locations (`neruma:demo:v1:*`) in `localStorage` and the visitor's photos in IndexedDB; *Reset demo* clears both.

Under the EU ePrivacy rules (Romania: Law 506/2004; Germany: TDDDG §25), storage that is strictly
necessary for something the user asked for needs no consent. Sign-in sessions and settings the visitor
chose fall under that. **So no cookie banner is needed as things stand.**

- [x] The privacy page lists everything stored on the device (sign-in cookies, `neruma_device`, reading settings, sidebar,
  demo) in EN/RO/DE, with what each is for and how long it lasts. `tests/unit/storage-disclosure.test.ts` fails when code
  starts storing something that isn't disclosed. Still open: the privacy page's older intro says it describes "the
  demonstration, before live accounts", and the data-controller, retention and processor details wait for the owner.
- [x] Rule for later: adding analytics, embedded maps or videos, or any third-party script means
  re-checking consent before it ships. `storage-disclosure.test.ts` fails on known analytics and embed hosts and on
  `next/script`; a deliberate addition changes that test in the same pull request.

## 4. Email

**Where it stands (2026-10-18):** Resend is connected as Supabase's sender for the sign-in emails. The domain `mail.lignorae.com` is verified (region Ireland,
click and open tracking off), a sending-only key was made, and Supabase sends from `NERUMA <noreply@mail.lignorae.com>` (Authentication → Emails → SMTP). **Delivery
test passed** (owner, 2026-10-18): the Supabase test email arrived from `NERUMA <noreply@mail.lignorae.com>`, encrypted, in Gmail. The app itself sends nothing yet. **Provider:** Resend is used for now (owner, 2026-10-18); the owner's lean towards a European provider is still open
(§15), and swapping is one SMTP setting.

**Rule (owner, 2026-10-18; `DECISIONS.md`, "Emails are text and links only"):** every email is text and hyperlinks, in English, Romanian and German. No images, no logo
image, no tracking pixels, no rewritten links. A text header "Neruma" in the logo's charcoal and off-white. `tests/unit/email-template.test.ts` enforces it.

- [x] Choose an SMTP provider and connect it in Supabase: Resend (see above). Delivery test passed.
- [ ] **Set up the `support@lignorae.com` mailbox** (owner, 2026-10-18: the address is chosen). Either a forwarding address to an inbox you read (a few DNS records on `lignorae.com`, added in Vercel
  DNS) or a real mailbox. It must exist and be read before any email says "write to support@lignorae.com" reaches a real person. **Paused (no budget, 2026-10-18): the emails name no address for now**; when the mailbox exists, put the line back in both templates, the settings file and `email-template.test.ts`.
- [x] Sending domain: SPF, DKIM and return-path records for `mail.lignorae.com` are in Vercel's DNS and Resend says verified. DMARC is not set yet: add a
  `_dmarc.mail` TXT record (`v=DMARC1; p=none; rua=mailto:<an address you read>`) once mail is flowing, and tighten it later.
- [ ] Check that Supabase's Authentication → URL Configuration has the Site URL `https://neruma.lignorae.com` and `…/auth/callback` in the redirect list, and
  `VIANORAE_SITE_URL` is set in Vercel (the friend with Vercel access is checking).
- [x] Restyle the confirmation email: text header, new colours, same wording, and the support address (brief `2026-10-18-password-reset.md`). **Paste the new template and subject into Supabase** (`TEST-PLAN.md` A12). Keep `supabase/templates/` as the source and the pasted
  example file in step.
- [ ] Translate the email templates into RO and DE (the confirmation already has all three; every new one needs them).
- [x] A password-reset flow in EN/RO/DE with its email (brief `2026-10-18-password-reset.md`). Built and tested against the fake Supabase; **try it on the real site** (`TEST-PLAN.md` A12).
- [x] Change the password from the account page while signed in (asks for the current one, and the code with two-factor). Built (brief `2026-10-18-change-password.md`); **try it on the real site** (`TEST-PLAN.md` A12).

### The emails we need

Sent by Supabase through Resend (templates pasted in the dashboard, one per type, language chosen with `preferred_locale`):

1. [x] **Confirm your email** (registration). Exists in three languages; restyle (above).
2. [x] **Reset your password.** Built (above); paste the template into Supabase and try it (`TEST-PLAN.md` A12).
3. [ ] **Security notices** (optional in Supabase, cheap to add): password changed, email address changed, two-factor added or removed. Tells someone when their
   account was touched by somebody else.

Sent by the app (needs code, a shared plain layout, and a plain-text part; a brief first):

4. [ ] **Request received**: "we have your organisation's request and will check it" (nothing is emailed after submitting today).
5. [ ] **Request approved**: the organisation can sign in and build. Before launch.
6. [ ] **More information needed**: the administrator's note, and what to do. Before launch.
7. [ ] **Request rejected**: the reason, and that they can apply again.
8. [ ] **Team invitation** (needs the invite feature, §16): a link to join the organisation, and a notice to the owner when someone accepts.
9. [ ] **Deleting an account** (`docs/briefs/2026-10-13-delete-account.md`, step 3): started (the date it is erased, how to restore), a reminder 3 days before, done.
   Before launch: the law and the privacy page promise it.
10. [ ] **Payments** (Stripe sends its own receipts and failed-payment mails; ours explain what the 30 days mean): "payment failed, your guides stay online
    until <date>", a reminder 7 days before, "your guides are offline, pay to bring them back", "back online". Before the start date is set (§8).
11. [ ] **To NERUMA's administrators**: a problem report arrived; a new organisation request is waiting (today the dashboard shows it, nothing is emailed).
12. [ ] **Contact form**: sends the enquiry to NERUMA's inbox and shows the sender a copy (`/contact` only prepares a message today).
13. [ ] **Organisation suspended or reinstated**: tells the owner, because their guides go offline.
14. [ ] **Later**: a guide taken down by NERUMA, two-factor reset by an administrator, an export is ready, and visitor reports once they exist.

**What every email shares:** one clear sentence on what to do, a button-like link *and* the address written out, the language of the account, a plain-text version,
readable contrast, no images or tracking, the sender `NERUMA <noreply@mail.lignorae.com>` and a reply address a person reads.

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
- [x] Publishing: public guides need their photos served publicly. Decided and built: the photos stay in the
  private bucket, and a storage policy lets anyone read exactly the photos a current published version lists
  (`/api/guide-photos`, five minutes of caching). Revisit with the plan/CDN decision.
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
- [x] Decided and built (`publication_check`): a language needs a location name, 3 to 8 steps that each have a name and
  a description, a description for every shown photo, and a name for every own field. Original note: place name, at least three zones,
  and a title and description per zone. Sensory levels may stay "not recorded". Alt text is required
  whenever there is a photo.
- [ ] Error messages per field in EN/RO/DE, linked to the field (`aria-describedby`), not only a
  message at the top.

## 7. Password rules

**Today:** the minimum is 12 characters, length only (no forced symbols or numbers, as NIST 800-63B advises), in the register form, in
`supabase/config.toml` and in the production project (checked 2026-10-18).

- [ ] Optional on Pro: leaked-password protection (checks against known breached passwords). Not available on the free plan.

## 8. Subscription flow for institutions

**Today:** built and switched off (brief `docs/briefs/2026-10-18-payments.md`, how-to `docs/guides/PAYMENTS.md`): *Plan & billing* for owners,
Stripe Checkout and customer page, the webhook, one plan per organisation, 30 days of grace, and the database rules. Nothing is required
until a start date is set. Decisions: `DECISIONS.md`, "Payments go through Stripe" and "Pay to publish".

- [x] Choose a provider: **Stripe** (owner, 2026-10-18). No German company was found that runs subscriptions, VAT and invoices together.
- [x] Data: `organization_subscriptions` per organisation, written only by the webhook (through `billing_record_subscription` and a secret).
- [x] Webhook: `src/app/api/stripe/webhook` checks Stripe's signature; the database checks the secret.
- [x] *Plan & billing* (owners only), and Publish explains when a plan is needed.
- [x] Non-payment: 30 days of grace, then the guides say "unavailable" (owner, 2026-10-18).
- [ ] **Paused (owner, 2026-10-18): open the Stripe account.** The owner wants it opened as a *business* account for production, which needs
      the selling company's details first, so it waits for the next item. (A test-mode account needs no business details and could be opened
      sooner, but the owner would rather open it once, in the right name. Stripe's country can't be changed later.)
- [ ] **Decide who sells** (which company, which country): it decides VAT registration, the invoice format, and in whose name the Stripe
      account is opened. Needed to unblock the item above.
- [ ] **Set up Stripe** in test mode and test by hand (`PAYMENTS.md` sections 2 and 3).
- [ ] Update the terms and privacy pages (Stripe as a processor) before taking any payment; then go live (`PAYMENTS.md` section 5)
      and set the start date (section 4), telling organisations at least 30 days before.
- [x] Nobody is erased while Stripe still charges them: the deletions page and the database refuse to erase an organisation, or its last
      owner, until the subscription is cancelled in Stripe (owner, 2026-10-18).
- [ ] Later: invoice and bank transfer; German e-invoices (XRechnung or ZUGFeRD) if customers need them; cancel the Stripe subscription
      automatically when an organisation is erased (today a person does it in Stripe).

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
- [ ] **Privacy:** prefer a European provider (owner's lean, 2026-10-18; §15), use an EU region (for Azure, West Europe or Sweden Central), sign the provider's data
  processing agreement, and add the provider to the privacy page. Only guide text is sent, never visitor
  data.
- [ ] **Reading the whole web app aloud** (the "listen to this page" option): this works for the fixed
  pages the same way. For anything dynamic or signed-in, keep browser speech.

## 10. Clean-up candidates

Found on 2026-10-11. None are bugs.

- [x] Removed `src/lib/database.types.ts` (imported nowhere) and `scripts/create-demo-seed.mjs`. `supabase/seed.sql` is now edited by hand.
- [ ] Four illustrations (`collection`, `interactive`, `quiet-room`, `reception`) look unused but are
  loaded by zone name in `src/lib/demo.ts`. Keep them.
- [x] `readPreferences` and `dictionaries` are no longer exported. (`validApplication` stays: a unit test uses it.)
- [ ] `npm audit` reports five high-severity findings in the development-only `eslint-config-next` chain, with no fix offered
  (`NEXT-STEPS.md`). Re-check when a new version appears.

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
- [ ] **Queries are never sent to a real PostgREST.** The fixture fakes the REST layer, so a query PostgREST would refuse passed every test
  (the dashboard failed in production on 2026-10-17, GOTCHA.md). `test:db` now checks that every table embedded under a place has a
  foreign key to it; the wider fix is to run the workspace tests against a real PostgREST over the migrated database.
- [ ] No test covers email delivery, password reset, billing or audio, because none exist yet. Each of
  sections 4, 8 and 9 needs its tests defined before the feature is built.
- [ ] No visual regression tests. A few full-page screenshot comparisons (home, guide, login at 390 and
  1280px) would catch the kind of alignment bugs found in the design review, at the cost of updating
  baselines when the design changes on purpose.
- [x] A smoke test for a deployed site exists (`tests/smoke.spec.ts`, `npm run test:smoke`): the pages open, sign-in and
  registration are enabled, headers, and with the public key what an anonymous visitor can do to the database. Still open:
  running it automatically after each Vercel deployment. The full list of manual and open test cases is in
  `docs/guides/TEST-PLAN.md`.

## 12. Organisation app: what the dashboard work left open

Added on 2026-10-11, after the dashboard cards (PR #29). Decisions are in `DECISIONS.md`; the brief is
`docs/briefs/2026-10-11-organisation-app.md`.

**Publishing, built 2026-10-13** (brief `docs/briefs/2026-10-13-publishing.md`; choices in `DECISIONS.md`, "QR codes" and "Publishing goes live straight away"). Installed on production on 2026-10-17 (see the job below).


- [x] **QR registry migration.** Today `qr_redirects` has a text `public_code` that points at one guide, which
  is one language, and the only working code is the hard-coded `willow-museum` in `src/lib/qr.ts`. Change it to
  one short random code per place, created in the same transaction as the first publish, never deleted or
  reused. Add database tests for the "can't" cases: another organisation can't read or change a code, and a
  code that exists is never handed to a second place.
- [x] **Which language opens.** `/q/[code]` picks the visitor's language when it is published, otherwise a
  published one, with the language switch available.
- [x] **The "isn't available right now" page.** Visitors can't read unpublished rows, so a narrow database
  function answers only "exists, not available" without returning the name. Replace the bare 404 in
  `src/app/q/[code]/route.ts`.
- [x] **QR and link on the dashboard card.** A "QR & link" button opens a pop-up with the code (view and
  download) and a copy-link button. Shown only once the place has a code. The pop-up is Sonnet work once the
  migration exists.
- [x] **Needs attention: unpublished changes.** Done (`listPlaces`). Still open: "not verified on site", which needs assessments.

**Waiting on the owner or a decision:**

- [ ] **Visit counts (brief 1e).** Nothing is counted today. Decide first what may be counted (for example a
  total per location, with no IP address and no cookie), then check section 3 and update the privacy page.
- [x] **Apply `supabase/migrations/20261011120000_step_fields.sql`** to the real Supabase project. Installed (checked 2026-10-17).

**Test fixture limits found while building:**

- [ ] `scripts/workspace-fixture.mjs` fakes the database's REST layer by hand. It serves embedded `place_translations`, `zones`,
  `media_assets` and `qr_redirects` on `places`, and the `in` filter, and nothing else. A new nested `select(...)` elsewhere fails with a
  500 in `dev:mock` and `test:workspace`, and a query the fake accepts can still be refused by the real PostgREST (§11). Say so in the
  fixture's header comment, or replace the hand-written layer with PostgREST.
- [ ] The fixture's port 3012 is written into four scripts, so a second copy can't run beside a running
  `dev:mock`. Read it from one `FIXTURE_PORT` setting. A copy has to sed it today.
- [ ] Editing code that talks to the database while `dev:mock` runs breaks the page until the mock is restarted,
  because the fake database loads once at start. Mention it in `docs/guides/TESTING.md`.

**Report a problem (organisations to NERUMA; `DECISIONS.md`, "Organisations can report a problem"):**

- [x] **Table and policies (needs Opus).** A `problem_reports` table: organisation, place (optional), the sender,
  a message with a length limit, status, created time. An organisation member can add a report for their own
  organisation and read only their own; the platform administrator reads and closes all. Database tests need the
  "can't" cases: a member of another organisation, a signed-out user, and a suspended organisation can't add or read.
- [x] **The form.** A sidebar button opens a short form (message, optional location), EN/RO/DE, with a rate limit
  so it can't be used to flood the table. Show a confirmation that says plainly it was saved, not emailed.
- [x] **The admin list.** A page in the admin area with open reports, newest first, and a "closed" button.
- [ ] **Later, with email (section 4):** a notification to the administrator when a report arrives.
- [ ] **Visitor reports** ("something here is wrong" in the public guide, shown to the organisation). Publishing now exists, so
  this can be started.

**Order of work after the dashboard (owner, 2026-10-11):**

1. [ ] **Live preview in a second tab** (brief, Task 2): the preview beside the editor, from unsaved changes, with
   the guide component visitors see. Narrow screens get a *Preview* button only.
2. [ ] **Visit counts privacy decision.** Suggested: one number per location per day, no IP address, no cookie,
   counting each time the guide opens. Needs the owner's yes, then section 3 and the privacy page.
4. [x] **Publishing**: built 2026-10-13 (the QR registry, the "isn't available" page, language choice, the QR pop-up). Visit counts
   on the card wait for item 3.

**Job for the owner's friend: apply the migrations to the real Supabase project** (done through 7 on 2026-10-17 by the owner, who ran each file in
the SQL Editor and checked the version functions; the account-deletion file was not tried on `neruma-dev` first) (the app hides the matching
controls until each is installed, so nothing breaks while they wait). Needs access to the VIANORAE Supabase project
(`ywbcsvswisorlgajbkev`, see the README), nothing else.

- [x] **1. Field controls** (`supabase/migrations/20261011120000_step_fields.sql`): adds the × and *Add a field* controls
  in the step editor.
- [x] **2. Report a problem** (`supabase/migrations/20261012090000_problem_reports.sql`): adds the *Report a problem*
  button for organisations and the administrator's list at `/admin/reports`.
- [x] **3. Publishing** (`supabase/migrations/20261013090000_publishing.sql`): switches on *Publish* and *Unpublish*,
  the QR code on the dashboard cards, public guide addresses and Explore. It also changes the example place's internal
  address if it was ever created from the old seed; nothing else is touched.
- [x] **4. Two-factor sign-in** (`supabase/migrations/20261014090000_two_factor.sql`). **Only after the app version with
  two-factor is live on the site**: from this moment platform administrators must enter an authenticator code, and only
  that app version can set one up. First check **Authentication → Multi-Factor** (or *Sign In / Providers*): *TOTP
  (App Authenticator)* must be enabled. If the same page offers *Recovery codes* (backup codes), switch them on too; if it
  doesn't, the site hides backup codes until Supabase offers them. Organisation owners and admins get 30 days; see
  `docs/guides/TWO-FACTOR.md`.
- [x] **5. Remember this device** (`supabase/migrations/20261015090000_remember_device.sql`), right after 4: adds the
  *Remember this device for 30 days* box on the code step for organisation owners and admins.
- [x] **6. Account deletion** (`supabase/migrations/20261016090000_account_deletion.sql`), after 5: adds *Delete my account* and the
  administrators' *Account deletions* page. **Try it on `neruma-dev` first with a test account**: it adds the first functions that
  change `auth.users` (to lock an account) and delete from it (to erase one). Installing changes nothing; the first deletion shows
  whether Supabase allows it. If *Delete my account* or *Erase now* reports an error, nothing was locked or erased (each runs as one
  transaction); tell the owner.

- [x] **7. Superadmin** (`supabase/migrations/20261017090000_superadmin.sql`): the administration dashboard, accounts list and administrators list.
- [x] **8. Account profile** (`supabase/migrations/20261017120000_account_profile.sql`), after 7: the profile page at `/admin/accounts/<id>`. Installed
  (checked 2026-10-18). **9. Payments** (`20261018090000_payments.sql`) is installed too (checked 2026-10-18; payments are off and no plan exists).

How, for each file, in this order (1 to 8):

1. Open the project in Supabase, then **SQL Editor → New query**.
2. Paste the whole file and press **Run**. Each file starts with a check and stops with a "STOP: … must already be
   installed" message if an earlier migration is missing; tell the owner if that appears, and run nothing else.
3. Run each file **once**. A second run fails with "already exists", which is safe but means it was already installed.
4. Check it worked: run `select public.step_fields_schema_version(), public.problem_reports_schema_version(), public.publishing_schema_version();`
   (it only works after all three files are installed; before that it names the missing function). The result should be
   `1 | 1 | 1`. After files 4 and 5, also
   `select public.two_factor_schema_version(), public.remember_device_schema_version(), public.account_deletion_schema_version();`
   should give `1 | 1 | 1`.
5. Tell the owner. On the live site the sidebar then shows *Report a problem* for organisation owners, and step
   cards show *Add a field*.

Both files only add things; nothing is deleted or changed in existing tables.

**Report a problem** (#31) is built; what is left of it: the email to the administrator when a report arrives
(section 4) and visitor reports (with publishing).

## 13. Registration and sign-in: small steps (owner, 2026-10-13)

**Today:** registration collects what the administrator needs to approve an organisation (name, type, country, representative
and role, website, registry reference, mandate statement and document, the responsibility consent with its version).
Sign-in is email and password through Supabase Auth, which stores only a hash; our tables hold no password and the code never
logs one. No visitor accounts exist, and nothing about sign-in history is kept beyond Supabase's own logs. Keep it that way:
no IP addresses, device details, date of birth, home address or national ID.

Each step is its own small pull request. When it is merged, remove its task from this list.

0. [ ] **Registration on production, end to end.** The cause of the 2026-10-13 failure (a Supabase project reference in Vercel that didn't exist) is
   fixed: the three Vercel values name `ywbcsvswisorlgajbkev` and `npm run test:smoke` checks a deployed site for exactly that (GOTCHA.md).
   Open: a real applicant registering, receiving the confirmation email and signing in, which needs an email provider (§4); and Preview
   should use `neruma-dev` instead of production's project (`DATABASE-ENVIRONMENTS.md`).
1. [ ] **Password rules on `neruma-dev`** (the owner's steps, no code; also section 7). Production is done (12 characters, length only).
   Check that `neruma-dev` says 12 too.
3. [ ] **Delete my account and export my data.** *Step 1 built (delete, export, restore, erase; `docs/guides/ACCOUNT-DELETION.md`).
   Left: hand an organisation to a verified colleague, and the emails.* *Start from `docs/guides/PERSONAL-DATA.md`: a user can't be deleted today (15 foreign
   keys with "no action"), the same data is copied in several tables, and some records are immutable by design. Each blocking row needs
   a decision: delete, anonymise or keep (owner and lawyer, D4).* A documented path (GDPR). Start as an administrator action with the steps
   written down; decide what happens to an organisation's published guides when its only owner is deleted (they go down;
   the QR codes stay and show the "isn't available" notice).
4. [ ] **A preferred language saved on the account**, for the emails the app sends later (section 4). Optional; defaults to
   the language of the page they registered in.
5. [ ] **An optional second contact for the organisation**, for when the representative leaves or their email stops working.
   Shown to the administrator only.

## 14. Superadmin area: what comes next (owner, 2026-10-17)

The dashboard, accounts list and administrators list exist (brief `2026-10-17-superadmin-dashboard.md`). Left for later:

1. [x] **A profile page for any account** (`/admin/accounts/<id>`). Done, read only: email, dates, two-factor, organisations with role and status, the
   request, a deletion in progress. Owner's choices, 2026-10-17: no actions on the page yet (reset two-factor and the deletion tools stay where they
   are) and no record of who looked. Revisit both when an administrator needs them; a view log would be personal data (`docs/guides/PERSONAL-DATA.md`).
2. [ ] **A list of organisations** with status (pending, approved, suspended) and number of published guides, each linking to its request.
3. [ ] **A record of who added or removed which administrator**, and when.
4. [x] **Mark that you are in the administration area.** Done: a strip on every administration page (icon, "Platform administration",
   the signed-in email) and a warm yellow for the whole area in dark and light (`admin-area`; high contrast keeps its palette). The profile page (item 1) says "you are viewing this account as a platform administrator".
5. [ ] **"Organisation account" in the administration menu** reads better as "My account".
6. [ ] **From an organisation to its owners and admins, and to their profiles** (owner, 2026-10-18). A platform administrator opens an
   organisation (from the list in item 2, or its request) and sees who its owners and admins are, each linking to that person's profile
   (`/admin/accounts/<id>`, item 1). Today the profile page goes the other way only (a person, then their organisations). Same rules as
   item 1: read only, says who is viewing, and a new function that checks `is_platform_admin()` like the others. It also helps the
   payments work: to reach the owner of an organisation that is overdue or still being charged before it can be erased.

## 15. Hosting, providers and where the data goes (owner, 2026-10-18; pinned)

The owner leans towards European providers, not French, German where there is one, for email and payment too. **Pinned, not decided.**
Decision D5 in `docs/guides/PERSONAL-DATA.md` is the same question. Supabase, Vercel and Resend are US companies; what matters in law is
where the data is stored and processed, and what covers a transfer (a signed data-processing agreement with standard contractual clauses,
and the EU–US Data Privacy Framework if the provider is certified; check, don't assume).

- [ ] **Decide the principle**, with a lawyer: EU data location with US providers under signed agreements, or European-owned providers only.
  Then write it in `DECISIONS.md`.
- [ ] **Pin the Vercel function region to Frankfurt** (`"regions": ["fra1"]` in `vercel.json`, or Settings → Functions → Region). Dynamic pages (sign-in,
  registration, the workspace, administration) run in the US today, so form contents cross the Atlantic before reaching an EU database
  (PERSONAL-DATA finding 5). Also faster, because each page makes several database requests. Worth doing under either answer.
- [ ] **Confirm the production database region** (Supabase → Project Settings; the docs say West EU, Ireland, unverified). Moving it to Frankfurt means a
  new project (`DATABASE-ENVIRONMENTS.md`); decide with the principle.
- [ ] **Research European email and payment providers**, German first (§4, §8): where they are incorporated, where they process data, SMTP and
  subscription support, price, data-processing agreement, and what they do with tracking.
- [ ] **Sign the data-processing agreements** with every processor that stays (Supabase, Vercel, the email and payment providers) and name them on the privacy page.

## 16. Other things a person can notice today (`docs/PRODUCT.md` §8)

- [ ] **Explore filters.** Country and city are shown and do nothing; the category filter offers Theatre and Clinic (which no location can be) and misses
  institution, public service and other.
- [ ] **Privacy page** still describes "the demonstration, before live accounts" and doesn't name the data controller, retention or processors. **Terms** are a
  draft for the demonstration. Both need a lawyer before real organisations (see §15).
- [ ] **Contact** prepares a message but doesn't send it (needs email, §4).
- [ ] **Teams:** no way to invite a colleague. Owner and admin are the only roles; invitations need email.
- [ ] **Methodology** describes on-site and independent assessments; none can be recorded in the app yet (the pilot trust workflow, `NEXT-STEPS.md` §6).
- [ ] **The first visit of a new organisation** (found in the owner's test run): `DESIGN-TASKS.md` §8.

## 17. Rename to neruma: the site address, the Vercel project and the GitHub repository (owner, 2026-10-18)

**Confirmed by the owner, 2026-10-18: all three.** The site `vianorae.lignorae.com` becomes `neruma.lignorae.com`, the Vercel project `vianorae-platform` becomes
`neruma`, and the GitHub repository `euroschneider-spec/Vianorae` becomes `euroschneider-spec/neruma`. The brand shown to people is already NERUMA; until now
VIANORAE was the repository and infrastructure name (`README.md`, `CLAUDE.md`).

**Keep the internal identifiers.** Names that live inside running systems stay as they are: the environment variables `VIANORAE_SUPABASE_PROJECT_REF` and
`VIANORAE_WORKSPACE_ENABLED`, the Supabase buckets (`vianorae-private-photos` and the others), and the migration notes. Renaming them means changing Vercel
settings, storage and code at the same moment, for no benefit a person can see. The naming rule in `CLAUDE.md` and `README.md` changes to: NERUMA everywhere a
person or the web can see it; VIANORAE only in those internal identifiers.

**The one thing that must not break: QR codes.** A QR code opens `/q/<code>` on the site's address, codes are kept forever, and organisations will print them.
No QR code has been printed yet (owner, 2026-10-18), so the old address `vianorae.lignorae.com` can simply be removed, together with its DNS record and its
Supabase redirect entry. From the first printed code on, the address in it must keep working for good.

Order, so that nothing is ever without a working address:

1. [x] **DNS** (the place that manages `lignorae.com`): add the record Vercel asks for `neruma.lignorae.com` (a CNAME). Keep the `vianorae` record.
2. [ ] **Vercel → Settings → Domains:** add `neruma.lignorae.com` and make it the primary address; remove `vianorae.lignorae.com` (no QR codes exist yet).
   Open `https://neruma.lignorae.com/en/login` and check it works.
3. [x] **Supabase → Authentication → URL Configuration:** set the Site URL to the new address and add it to the redirect allowlist next to the old one. Also look for
   `vianorae-platform…vercel.app` entries: renaming the project changes those addresses (step 4). Remove the old ones only much later.
4. [x] **Vercel project rename:** Settings → General → Project Name: `neruma`. Preview and default `*.vercel.app` addresses change with it. Check Settings → Git still
   shows the repository connected. Environment variables that hold the old address (check, then redeploy).
5. [x] **GitHub repository rename, last:** Settings → General → Repository name: `neruma`. GitHub redirects the old address for web and git, but every clone should
   update its remote (`git remote set-url origin …`), and Vercel should be checked once more (Settings → Git). **Tell Claude before and after**: this session's repository
   access is named after the old repository and has to be re-added under the new name; merge or close open pull requests first.
6. [x] **Code and docs, one small pull request after step 5** (Claude): `vianorae.lignorae.com` in `tests/smoke.spec.ts` and the docs (`README.md`, `.env.example`,
   `docs/guides/TESTING.md`, `docs/guides/TEST-PLAN.md`, `docs/planning/NEXT-STEPS.md`, `docs/architecture/ORGANISATION-FLOW.md`, `GOTCHA.md`; history entries
   stay as written); `euroschneider-spec/Vianorae` in `README.md` and `NEXT-STEPS.md`; the package name `vianorae-platform` in `package.json` and `package-lock.json`;
   and the naming rule in `CLAUDE.md` and `README.md`.
7. [ ] **Check, after deploying:** `SMOKE_URL=https://neruma.lignorae.com npm run test:smoke`, (skip the old-QR-address check while no code has been printed).

## 18. Going live: what is still missing (review of 2026-10-18; email is its own section, §4)

Collected from this file, `docs/guides/PERSONAL-DATA.md`, `docs/guides/TEST-PLAN.md` and a review at the owner's request. Each item points to
the section that holds the detail. Not legal advice: the legal items need a qualified person.

**Blocks going live**

- [ ] **Decide who is the data controller and who sells** (legal name, address, country; `PERSONAL-DATA.md` D1, D2, and §8). The legal texts, the
  Stripe account and the invoices all depend on it.
- [ ] **Privacy notice.** It still describes the demonstration and doesn't name the controller, retention or processors (Supabase, Vercel, Stripe,
  later the email provider). Plan: Claude drafts it from `PERSONAL-DATA.md` with the open decisions marked; a lawyer reviews it for a fixed fee
  (a generator such as eRecht24 covers the basics but doesn't know our data flows). Decisions still needed: legal basis per item, how long each
  item is kept, whether transfers outside the EU are acceptable (§15).
- [ ] **Terms of use.** A draft for the demonstration today. Have a lawyer write or check them: they cover payment, the 30-day grace rule, what
  happens when someone stops paying, and who is responsible for a guide's accuracy (a visitor may rely on "quiet room"), including any limit
  on liability. If there is no lawyer, ask a chamber of commerce or a small-business legal advice service for a low-cost first check.
- [ ] **Sign the data-processing agreements** with Supabase, Vercel and Stripe (and the email provider). No lawyer needed: each offers a standard
  one to accept online. Then name them on the privacy page (§15).
- [ ] **An imprint (Impressum), if the operator is in Germany.** Nothing in the repo mentions one; German business websites generally need it.
  Ask the lawyer, then add a footer page in EN, RO and DE.
- [ ] **Data retention.** Nothing is deleted automatically: requests, documents, reports and audit entries stay forever (`PERSONAL-DATA.md`, finding 4).
  Decide a rule with the lawyer, then build it.
- [ ] **Backups.** Check what the Supabase plan really gives (§5), then rehearse restoring one at least once (`TEST-PLAN.md` A9).
- [ ] **Registration on production, end to end**, with a real email and a real applicant (needs email, §4 and §13 item 0).

**Payment-specific** (§8, `docs/guides/PAYMENTS.md`)

- [ ] Open the Stripe account in the seller's name (paused until the seller is decided) and run the hand-test in test mode.
- [ ] Decide whether Stripe's invoices are enough for German customers, or whether e-invoices (XRechnung or ZUGFeRD) are needed.
- [ ] Sign Stripe's data-processing agreement and name Stripe on the privacy page.
- [ ] Tell organisations the start date at least 30 days ahead, then set it (`PAYMENTS.md` section 4).

**Hosting and security settings**

- [ ] Pin the Vercel region to Frankfurt and confirm the database region (§15). Today form contents travel through the US.
- [ ] Branch protection on `main` (§11), in progress with a friend who has admin rights.
- [ ] Check the password minimum on `neruma-dev` (§13).
- [ ] Decide when to leave the free Supabase plan: storage and traffic caps (§5).

**What a person notices today** (§16)

- [ ] Explore: the country and city filters do nothing, and the category list offers types nobody can choose.
- [ ] No way to invite a colleague (needs email).
- [ ] The Contact form doesn't send anything (needs email).
- [ ] A new organisation lands on an empty dashboard (`DESIGN-TASKS.md` §8).

**Testing only people can do** (`TEST-PLAN.md` Part A)

- [ ] Real phones, real authenticator apps, a screen reader, and publish plus QR on an actual phone.
- [ ] After the address rename (§17): `SMOKE_URL=https://neruma.lignorae.com npm run test:smoke`.

**Suggested order:** decide the controller and the seller, then book the lawyer for the texts; email, the address rename and the Frankfurt
region; the backup rehearsal and the hand-tests with real devices; Stripe live mode and the start date last.
