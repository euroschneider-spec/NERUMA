# Test plan: what to test by hand, what is tested for you, what is still open

Written 2026-10-13. It has three parts:

- **Part A: your manual tests.** Things only a person on real systems can check (a real email, a real phone, the real
  Supabase and Vercel settings). Numbered steps, each with what you should see. Tick the boxes as you go.
- **Part B: what the machines already test.** By area, so you can see what is covered and where it lives.
- **Part C: still open.** Cases nobody tests yet, with the reason and a suggestion. Edge cases and findings found while
  writing this file are at the end.

How to run the automated tests is in [TESTING.md](TESTING.md). In short: `npm run check` (types, lint, unit, database,
build), `npm run test:e2e` (browser, real build, no mocked data), `npm run test:workspace` (signed-in flows against a
fake Supabase that runs the real migrations) and `npm run test:smoke` (a deployed site).

---

## Part A: your manual tests

Do them in this order. Parts A1 and A2 matter most: the site can pass every automated test and still not work for a real
organisation, because the real Vercel and Supabase settings are outside the code. (That is how registration stayed
switched off on production on 13 October.)

### A1. The real settings (Vercel and Supabase) — 15 minutes

Open the **production** Supabase project `neruma-prod` (`ywbcsvswisorlgajbkev`). Menu names move around a little; the
setting names below are what to look for.

- [ ] **Vercel, Production variables.** `NEXT_PUBLIC_SUPABASE_URL` is `https://ywbcsvswisorlgajbkev.supabase.co`,
  `VIANORAE_SUPABASE_PROJECT_REF` is `ywbcsvswisorlgajbkev`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` starts
  `sb_publishable_` and was copied from `neruma-prod` (Get Connected → Publishable key). `VIANORAE_WORKSPACE_ENABLED` is `1`.
  Expected: the three Supabase values name the same project. *If not, registration is silently switched off.*
- [ ] **Run the smoke test against production** (needs no key for the first part):
  `SMOKE_URL=https://neruma.lignorae.com npm run test:smoke`. Expected: 6 passed, 7 skipped.
- [ ] **Run it again with the database part.** Copy the public key from Supabase and run the second command in
  [TESTING.md](TESTING.md#testing-a-deployed-site). Expected: all 13 pass. A failing line names the problem
  ("verification migration", "disable_signup", a table readable by anyone…).
  *The database part has not been run against your project yet: the sign-in-settings check follows Supabase's documented answer. If
  a line fails for a reason that looks wrong, tell me and I'll correct the test, not your project.*
- [ ] **Authentication → Sign In / Providers → Email.** *Confirm email* is **on**. *Allow new users to sign up* is **on**.
  Minimum password length is **12**. If you have *Prevent use of leaked passwords*, it is on.
  Expected: these are what the code assumes. *Confirm email off would let anyone register with someone else's address.*
- [ ] **Anonymous sign-ins are off** (same area). *The database treats an anonymous account as unconfirmed, so this is safe
  either way, but it should be off.*
- [ ] **Multi-Factor: *TOTP (App Authenticator)* is enabled** for enrolling and verifying. If you can see *Recovery codes*,
  enable them. *Without TOTP the two-factor screens show an error.*
- [ ] **Authentication → URL Configuration.** Site URL is `https://neruma.lignorae.com`. The only redirect URL is
  `https://neruma.lignorae.com/auth/callback`. No `*` wildcards, no `localhost` left in production.
- [ ] **Storage.** Both buckets (`vianorae-private-photos`, `vianorae-mandate-evidence`) are **private**. Try
  `https://ywbcsvswisorlgajbkev.supabase.co/storage/v1/object/public/vianorae-mandate-evidence/x.pdf` in a browser:
  expected a "Bucket not found" / error page, never a file.
- [ ] **Database → Advisors → Security.** Expected: no *RLS disabled* warnings on `public` tables. Write down any warning
  you don't understand and send it to me.
- [ ] **Migrations installed on production.** In the SQL Editor run the query from the migration job
  (`TECH-TASKS.md` §12). Expected: `true` for everything you have installed on purpose, `false` only for what is waiting.
- [ ] **Preview deployments don't use production data.** Open a Preview deployment's registration page and check it points at
  `neruma-dev`, not `neruma-prod`. *Today Preview still has production's project and a placeholder key (TECH-TASKS step 0).*
- [ ] **Nothing secret is in Vercel's *Config* type variables.** Only the three public values above are. *Config values are
  readable by members; anything secret must be type "Secret".*

### A2. Registration and email, end to end, with a real inbox — 20 minutes

Use an address that belongs to your Supabase team until you have your own email provider (TECH-TASKS §4).

- [ ] **Happy path.** Open `/en/register`, fill every field with fictional details, register. Expected: the "confirm your email"
  message. The email arrives (check spam) in the language of the page. The link opens the site, you can sign in, and the
  account page lets you attach a document and submit.
- [ ] **Same in Romanian and German** (`/ro/register`, `/de/register`). Expected: the page and the email are in that language,
  diacritics (ă î ș ț, ä ö ü ß) show correctly in the email's subject and body.
- [ ] **Click the confirmation link twice.** Expected: the second time a clear "sign in" or "link used" result, not an error page.
- [ ] **Wait for the link to expire** (or use an old one). Expected: you land on the sign-in page with a failure notice, and
  *Resend confirmation email* works.
- [ ] **Register the same address again.** Expected: the same friendly message; no "this email exists" (that would reveal who
  has an account).
- [ ] **An address with `+` and capitals** (`First.Last+test@…`). Expected: registers and signs in; the same address in another
  capitalisation reaches the same account.
- [ ] **A password of exactly 12 characters works; 11 is refused**, in the browser *and* with the browser's check bypassed
  (a developer can do that; the automated suite does it).
- [ ] **A leaked password** (try `Password1234!`) if *Prevent use of leaked passwords* is on. Expected: a message that the
  password is too easy or appeared in a breach — not "email request not completed".
- [ ] **Too many emails.** Click *Resend* five times quickly. Expected: a calm "wait before trying again".
- [ ] **Look at the email as a recipient would.** Remote images are off in your mail app and the message still reads
  clearly. There are no tracking links: the only link is the confirm button.
- [ ] **Sign in with the wrong password, then with an unknown address.** Expected: the same message both times.
- [ ] **Sign in with a confirmed address before submitting the request.** Expected: the account page, no workspace.

### A3. Two-factor with real authenticator apps — 30 minutes

Do this on `neruma-dev` first if the migrations are there; otherwise on production with your own test account.

- [ ] **Set it up with a real phone app** (try Google Authenticator and one more: Microsoft Authenticator, 1Password or Apple
  Passwords). Scan the QR code. Expected: the 6-digit code from the app turns it on and shows 10 backup codes.
- [ ] **Set it up by typing the key** instead of scanning. Expected: the same result.
- [ ] **Backup codes.** Download them (the text file opens). Sign out, sign in, choose *Use a backup code instead*, type one with
  capitals and dashes. Expected: you're in, the account page says 9 of 10 are left. Try the same code again: refused.
- [ ] **Make new backup codes.** Expected: it asks "are you sure?" first; the old codes stop working.
- [ ] **A wrong code five times in a row.** Expected: Supabase locks it for a while; the message says to wait.
- [ ] **A phone with the wrong time.** Set the phone's clock 2 minutes off, try the code. Expected: refused with the "check the
  time on your phone" advice. Set it back; it works.
- [ ] **Reuse a code within 30 seconds.** Expected: Supabase may refuse a code used once already; note what happens.
- [ ] **Remember this device.** Tick the box, sign out, sign in again. Expected: password only. Open a *different* browser:
  it asks for the code. Open the account page: one device listed, with dates only. Forget it: the next sign-in asks again.
- [ ] **Platform administrator.** Sign in as the administrator. Expected: no "remember" box; the code is asked every time.
- [ ] **Lost phone, as the administrator would handle it.** Follow `TWO-FACTOR.md` ("Someone lost their phone") on a test
  account. Expected: after the SQL, the person signs in with the password and is taken to set up two-factor again, and
  their remembered devices are gone.
- [ ] **The deadline.** On `neruma-dev`, set the date to tomorrow, look at the banner as an organisation owner; set it to
  yesterday and sign in. Expected: first the banner with the date, then straight to setup with the workspace closed.
  Put the date back.
- [ ] **Two tabs.** Open the code step in two tabs, finish in one, press Confirm in the other. Expected: no error page; it ends
  in the workspace.
- [ ] **Password change.** Change the password of a test account that has remembered devices. Expected: the devices are gone.

### A4. The administrator's review — 20 minutes

- [ ] Approve a test organisation with a real PDF and a real JPEG as evidence. Expected: the organisation can edit; the review
  history shows who decided and what they checked.
- [ ] Ask for more information, resubmit from the applicant side, then reject. Expected: each step is recorded; a rejected
  applicant cannot edit.
- [ ] **Try to approve your own request.** Expected: refused ("another administrator must review").
- [ ] Suspend an approved organisation. Expected: its published guides and QR codes show "unavailable" within a few minutes
  (photos are cached for five minutes), the owner is still signed in but sees no data.
- [ ] Download a mandate document as the administrator; as another organisation's owner try the same address. Expected:
  the first works, the second is refused.

### A5. Publishing and QR codes on a real phone — 20 minutes

- [ ] Publish a test location in two languages. Print the QR code (or show it on a screen) and scan it with the iPhone camera
  and an Android phone. Expected: the guide opens in the phone's language when published, otherwise in a published one.
- [ ] Rename the location and publish again. Expected: the same QR code still works and the address didn't change.
- [ ] Unpublish. Scan again. Expected: the "isn't available right now" page, with no name of the place.
- [ ] A place called **"Place des Arts"** and one with a very long name (after installing the publishing migration with the
  two address fixes). Expected: both guides open from their QR code and appear in Explore.
- [ ] Photos: open the guide on a slow connection (browser dev tools → Slow 3G). Expected: text first, photos later, no layout jump.
- [ ] **Explore** shows the published place in the visitor's language; the filter finds it by type.

### A6. Accessibility with real assistive technology — 45 minutes

The automated scans (axe) catch contrast and labels; they can't tell if it is *usable*.

- [ ] **Screen reader**, VoiceOver on iPhone or Mac, or NVDA / TalkBack: register, sign in, enter the two-factor code, publish.
  Expected: every field is announced with its label and error; after setting up two-factor the focus lands on the backup
  codes heading; the "are you sure?" dialog announces its title and Cancel has focus.
- [ ] **Keyboard only** (no mouse): the whole of registration, sign-in, setup and the editor. Expected: a visible focus ring
  everywhere, no trap, Escape closes dialogs.
- [ ] **Zoom to 200% and 400%** and a 320-pixel-wide window. Expected: no sideways scrolling, nothing cut off.
- [ ] **Dark, light and high-contrast** on both new two-factor screens. Expected: the QR code is always on white and scannable.
- [ ] **Reduced motion** switched on in the system. Expected: no animation.
- [ ] **Read-aloud on real devices**, Romanian especially: iPhone, Android, Mac, Windows. Expected: a voice exists or the "no voice" message
  appears; nothing is read in the wrong language.

### A7. Privacy, by eye — 10 minutes

- [ ] In a private window open the home page, the example guide and Explore, then the browser's developer tools →
  **Application** (or *Storage*). Expected: no cookies and nothing in Local Storage until you change a reading setting; then
  exactly `vianorae:reading:v1`.
- [ ] Sign in as an organisation. Expected: only cookies starting `sb-` and ending `-auth-token`. Sign out: they are gone.
- [ ] Tick *Remember this device*. Expected: a `neruma_device` cookie, 30 days, marked HttpOnly and Secure in the table.
- [ ] Open the **Network** tab on a public page. Expected: every request goes to `neruma.lignorae.com`, nothing else.
- [ ] Read the privacy page in English, Romanian and German. Expected: it matches what you just saw.
- [ ] In the Supabase dashboard open **Authentication → Users**. Expected: only an email, a creation date, a sign-in date. No
  names of devices, no IP addresses of visitors (Supabase's own logs keep IPs; check how long it keeps them and note it
  for the data controller section of the privacy page).

### A8. Data rights (when the feature exists)

Waiting for "Delete my account and export my data" (TECH-TASKS §13 step 3). Rehearse it on a test account:

- [ ] Export: you receive every piece of data held about the account, in a readable form.
- [ ] Delete: the account, its sign-in, its remembered devices, its uploads and its drafts are gone; the published guides go
  down; the QR codes stay and say "unavailable".
- [ ] Afterwards sign-in fails, and the same email address can register again.

### A9. When something is down — 15 minutes

- [ ] On a Preview deployment, point the Supabase URL at a project that doesn't exist (or pause `neruma-dev`). Expected: the
  public guide pages and the example guide still open; sign-in and registration show a calm notice, never a blank page or a
  stack trace.
- [ ] Open a QR code while the database is slow or unreachable. Expected: a plain error, not a spinner forever.
- [ ] Look at Supabase's **Reports** or **Logs** after a day of real use for repeated errors.

### A10. Devices and browsers — 20 minutes

- [ ] The home page, a guide, registration and the code step on: iPhone Safari, Android Chrome, desktop Firefox, desktop Safari.
  Expected: layout holds, the code field offers the numeric keyboard, the QR code scans from another phone.
- [ ] The password manager (1Password, iCloud Keychain) fills the email and password, and offers to fill the one-time code.

### A11. Payments in Stripe's test mode — 30 minutes

- [ ] Follow `docs/guides/PAYMENTS.md` section 3: pay with a test card, see the plan active, open Stripe's customer page and cancel, an
  admin sees no *Plan & billing*, a failed renewal with a test clock shows the 30 days, and (on a dev database only) switching payments
  on hides an unpaid organisation's guide until it pays. In Romanian and German too.

### A12. Password reset on the real site — 15 minutes

The machines test this against a fake Supabase (`scripts/workspace-fixture.mjs`); only the real one proves the email link, the template variables and the two-factor rule.

- [ ] Paste the two templates from `supabase/templates/auth-email-settings.example.json` into Supabase (*Authentication → Emails → Templates*: **Confirm sign up** and **Reset password**, with the
  subjects in the file) and check *Authentication → URL Configuration*: Site URL `https://neruma.lignorae.com`.
- [ ] On the sign-in page click *Forgot your password?*, enter your own account's address: the same message appears as for an unknown address. The email arrives from `NERUMA <noreply@mail.lignorae.com>`, in your language, text and links only,
  with the link also written out and "Questions? Write to support@lignorae.com."
- [ ] Open the link: a page with one button. Press it: *Choose a new password*. Choose one of 12 or more characters: you land on sign-in with "Your password was changed", the old password is refused and the new one works.
- [ ] Open the same link again and press the button: "That link has expired or was already used".
- [ ] With an account that has two-factor: the page asks for the code first; a wrong code is refused; the right code saves.
- [ ] Open the link on a **different device** than the one that asked (the phone): it works.
- [ ] Look at the email on a phone in dark mode, and read it with a screen reader if you can.

---

## Part B: what is already tested by machines

Levels: **unit** = `tests/unit/*.test.ts`, **db** = `npm run test:db` (real migrations in a real Postgres, as each role),
**workspace** = `npm run test:workspace` (a real browser against a fake Supabase running the real migrations),
**e2e** = `tests/*.spec.ts` (a real browser against the production build, no fake data), **smoke** = `tests/smoke.spec.ts`
(a deployed site). ✅ covered · 🟡 partly · ⬜ not yet (see Part C).

Counts on 13 October 2026: 197 unit, 116 database, 61 workspace, plus the browser specs. CI runs all of them on every pull
request except the smoke test, which needs an address.

### Registration and sign-in

| Case | Level | Where | |
|---|---|---|---|
| Registration is inactive and explained without sign-in settings | e2e | `platform.spec.ts` | ✅ |
| Registration, login and resend pages open in EN/RO/DE with no accessibility violations | e2e, workspace | `platform.spec.ts`, `test-workspace.mjs` | ✅ |
| Registration rules: https website only, no script/data/file addresses, no sign-in details in the address, 2-letter country, lengths at the limit and one over, type from the fixed list, both ticks required | unit | `verification.test.ts` | ✅ |
| A forged `status` or `role` field in the form goes nowhere; the language comes from the page | unit | `verification.test.ts` | ✅ |
| Hostile text in names is kept as plain text | unit | `verification.test.ts` | ✅ |
| Password: 11 and 129 characters and empty refused by the server with the browser's checks removed; 12 accepted | workspace | `test-workspace.mjs` | ✅ |
| Email: malformed, too long, empty refused by the server | workspace | `test-workspace.mjs` | ✅ |
| A wrong password and an unknown email give the same message | workspace, unit | `test-workspace.mjs`, `auth-feedback.test.ts` | ✅ |
| Messages for rate limits, unauthorised address, unconfirmed email, weak password, signups off — in three languages, no raw error code shown | unit | `auth-feedback.test.ts` | ✅ |
| Email rate limit and resend feedback | workspace | `test-workspace.mjs` | ✅ |
| Confirmation callback cannot redirect off-site | e2e | `platform.spec.ts` | ✅ |
| Missing verification or evidence migration fails closed | workspace | `test-workspace.mjs` | ✅ |
| `config.toml`: password length ≥ 12, signups and confirmations on, anonymous off, TOTP on, no SMS, no wildcard redirects | unit | `auth-config.test.ts` | ✅ |
| Confirmation email: three languages, one link each, nothing remote, says it doesn't approve the organisation | unit | `email-template.test.ts` | ✅ |
| Email is actually delivered, in the right language | manual | A2 | ⬜ |
| The hosted project's real settings (confirm email on, signups on) | smoke, manual | `smoke.spec.ts`, A1 | 🟡 |

### Two-factor, backup codes, remembered devices

| Case | Level | Where | |
|---|---|---|---|
| Password-only session cannot read, save, publish, unpublish or report once enrolled; works with the code | db | `test-database.mjs` | ✅ |
| Deadline: before it, nothing changes; after it, an owner without two-factor loses access; editors are not affected; the administrator needs it from day one | db | `test-database.mjs` | ✅ |
| Nobody signed in can read or move the deadline | db | `test-database.mjs` | ✅ |
| Remembered device: token only stored hashed; trust is for one session; another account, an administrator, an expired or forgotten device, a new password, a reset — none let a session through | db | `test-database.mjs` | ✅ |
| Set up, sign out, sign in with the code, wrong codes refused, workspace stays closed | workspace | `test-workspace.mjs` | ✅ |
| Wrong, empty, lettered and full-width codes refused; the workspace stays closed | workspace | `test-workspace.mjs` | ✅ |
| Backup code works once, new set cancels the old, "are you sure?" dialog | workspace | `test-workspace.mjs` | ✅ |
| Remembered device: cookie flags (HttpOnly, Secure, SameSite, 30 days), other browser still asked, administrator has no box, Forget | workspace | `test-workspace.mjs` | ✅ |
| A forged or broken device cookie changes nothing and is thrown away (six forms) | workspace | `test-workspace.mjs` | ✅ |
| Deadline banner, and setup-only page after the deadline | workspace | `test-workspace.mjs` | ✅ |
| Code step and setup in Romanian and German pass the accessibility scan | workspace | `test-workspace.mjs` | ✅ |
| Already-signed-in person is not sent in circles | workspace | `test-workspace.mjs` | ✅ |
| Code parsing, status parsing, copy in three languages | unit | `two-factor.test.ts` | ✅ |
| Real authenticator apps, clock skew, code reuse, brute-force lock | manual | A3 | ⬜ |

### Access, tenancy and privacy of data

| Case | Level | Where | |
|---|---|---|---|
| Every public table has row-level security | db | `test-database.mjs` | ✅ |
| Anonymous, outsider, editor, admin, owner of another organisation, assessor, reviewer: who can read and write what | db | `test-database.mjs` | ✅ |
| Cross-organisation reads and writes denied, including photos, documents, reports and drafts | db, workspace | both | ✅ |
| Metadata cannot grant platform administration | db | `test-database.mjs` | ✅ |
| Suspended organisation: members, assessors, public guides and QR codes all go | db, workspace | both | ✅ |
| Applicants cannot approve, forge evidence, replace evidence, or approve themselves | db | `test-database.mjs` | ✅ |
| Signed-out visitors are sent to sign-in from the code step, admin pages and workspace; private routes refuse them | e2e, workspace | `privacy-security.spec.ts`, `test-workspace.mjs` | ✅ |
| Pages behind sign-in are served `no-store`; sign-out removes the sign-in cookies; going back doesn't reopen the workspace | workspace | `test-workspace.mjs` | ✅ |
| The deployed database refuses an anonymous reader and writer on every private table, and the private buckets aren't public | smoke | `smoke.spec.ts` | 🟡 runs when you give it the public key |
| No secret or database password in any tracked file; `.env` ignored | unit | `no-secrets.test.ts` | ✅ |

### Publishing, addresses and QR codes

| Case | Level | Where | |
|---|---|---|---|
| Publish, republish, unpublish, same address and code, a second place with the same name | db, workspace | both | ✅ |
| Addresses: Romanian and German letters, `ß`, symbols, scripts, empty, `null`, 100 characters, cut at 60 with a hyphen | db | `test-database.mjs` | ✅ |
| A name beginning "Place…" or cut at a hyphen still gets an address a visitor can open, found by its QR code and listed in Explore | db | `test-database.mjs` | ✅ (two bugs found and fixed) |
| Hostile addresses, codes and languages: control characters, 10,000 characters, SQL, script tags, `place-<id>` placeholder — all "not found", never an error | db | `test-database.mjs` | ✅ |
| Odd QR codes and guide addresses are plain 404s showing no code, stack or name | e2e | `privacy-security.spec.ts` | ✅ |
| Photo names with `../`, capitals, extra parts, wrong extension are never accepted — in the database and at `/api/guide-photos` | db, e2e | `test-database.mjs`, `privacy-security.spec.ts` | ✅ |
| Language choice from the phone, an asked-for language wins | unit, e2e | `publishing.test.ts`, `guide-example.spec.ts` | ✅ |
| Scanning on a real phone | manual | A5 | ⬜ |

### Privacy and security of what the browser gets

| Case | Level | Where | |
|---|---|---|---|
| 15 public pages set no cookie and store nothing on the first visit | e2e | `privacy-security.spec.ts` | ✅ |
| The same pages talk only to the site itself; no tracker or embed in what they load | e2e | `privacy-security.spec.ts` | ✅ |
| Changing a setting stores exactly one named key and no cookie, holding no personal data | e2e | `privacy-security.spec.ts` | ✅ |
| Everything stored on the device is listed on the privacy page in three languages; new storage or a tracker fails the build | unit | `storage-disclosure.test.ts` | ✅ |
| Security headers on every page; the content policy blocks other origins, framing, plugins, forged forms, eval; private pages are `noindex` | e2e, smoke | `privacy-security.spec.ts`, `smoke.spec.ts` | ✅ |
| Unknown languages and odd addresses are 404; a cross-site POST has no effect | e2e | `privacy-security.spec.ts` | ✅ |
| Ten script-injection and markup strings typed into the demo editor show as plain text and run nothing; a hand-edited stored value runs nothing; a 5,000-character name doesn't break the layout | e2e | `hostile-text.spec.ts` | ✅ |
| Uploads: SVG, forged raster and oversized files refused | e2e, workspace | `demo-workspace.spec.ts`, `test-workspace.mjs` | ✅ |

### Accessibility and layout

| Case | Level | Where | |
|---|---|---|---|
| Automated WCAG 2.2 AA scans of public, demo, organisation and administrator pages in every theme | e2e, workspace | `platform.spec.ts`, `demo-workspace.spec.ts`, `test-workspace.mjs` | ✅ |
| 320 px reflow, 200% text, keyboard use, reduced motion, high contrast, theme follows the device | e2e | `platform.spec.ts`, `reading-accessibility.spec.ts`, `theme-follows-device.spec.ts` | ✅ |
| Read-aloud: pause, stop, speed, missing voice | e2e | `read-aloud.spec.ts` | ✅ |
| A screen reader, real zoom, real devices | manual | A6, A10 | ⬜ |

---

## Part C: still open

### Cases nobody tests yet

Each is worth a decision. "Why" says what stops it being automated today.

- [ ] **Double publish at the same moment** (two people press Publish together). *Why:* the in-memory test database has one
  connection, so it can't run two at once. *Suggest:* a test on `neruma-dev` with two real sessions, or trust the advisory
  lock and rehearse by hand.
- [ ] **Two tabs saving the same draft.** Covered by the stale-revision check in the database and one workspace test; not by
  two real tabs with a real network delay. *Suggest:* one extra workspace check.
- [ ] **Brute force and replay of the two-factor code.** Supabase decides; the fake doesn't copy it. *Suggest:* test on
  `neruma-dev` by hand (A3) and keep the result in this file.
- [ ] **Email actually delivered, spam folder, DNS records (SPF, DKIM, DMARC).** Needs a real provider (TECH-TASKS §4).
  *Suggest:* after choosing one, an automated check that sends to a test inbox service and reads the mail.
- [ ] **Row-level security against the real production database.** The smoke test does the read-only part with the public key.
  Writes as an *authenticated* user (the real attack: a signed-in owner of A touching B) need two real test accounts on
  `neruma-dev`. *Suggest:* a `smoke` variant with two seeded `@example.test` accounts, run only against dev.
- [ ] **Backups and restore.** Not a test but a rehearsal; see A9 and the plan decision in TECH-TASKS §5.
- [ ] **Load.** What happens with 1,000 visitors scanning one QR code in a minute. The guide pages are static, so probably fine;
  `/q/<code>` and `/api/guide-photos` call the database. *Suggest:* a short `k6` or `autocannon` run on a Preview.
- [ ] **Dependency vulnerabilities.** `npm audit` isn't in CI. *Suggest:* add `npm audit --omit=dev --audit-level=high` as a
  warning, not a blocker, plus Dependabot.
- [ ] **Visual regression** of the home page, a guide and sign-in at 390 and 1280 px (TECH-TASKS §11).
- [ ] **Account deletion and data export.** Not built (TECH-TASKS §13 step 3). When it is: every table that holds a user's
  data gets a "deleted means gone" check in `test-database.mjs`, and the privacy page's retention text is tested against it.
- [ ] **Privacy page promises vs. Supabase's own logs.** Supabase keeps sign-in IP addresses in its logs. Decide how long
  and say so on the privacy page. No test can decide that.
- [ ] **Time zones and daylight saving** for the two-factor deadline and the date shown in the banner (Europe/Berlin). The
  comparison is in the database in UTC, so only the *display* could be off by an hour.
- [ ] **Very large organisations**: 50+ memberships (the page asks for 50), 100 places, all with photos. The dashboard lists
  50 organisations at most; nothing tests the 51st.

### Older tests that don't yet bind the words to the locator

The rule is in [TESTING.md](TESTING.md#finding-elements-the-words-always-travel-with-the-locator): a control is found by
its words, or by a test id that is always checked together with them. Test ids are enforced
(`tests/unit/test-conventions.test.ts`). Finding by a CSS class or bare id is not enforced yet, and the older tests do it in
about **127 places**: `scripts/test-workspace.mjs` 49, `platform.spec.ts` 17, `reading-accessibility.spec.ts` 15,
`demo-workspace.spec.ts` 12, `read-aloud.spec.ts` 11, `guide-example.spec.ts` 10, `top-bar.spec.ts` 9,
`theme-follows-device.spec.ts` 4.

- [ ] Retrofit them one file at a time, each as its own small pull request. For every `locator('.class')` either switch to a
  role or label, or add a `data-testid` and use `button()` / `field()` / `message()` from `tests/support/bound.ts`. Many of
  them already assert text on the next line; those are the quick ones.
- [ ] When the retrofit is done, extend `test-conventions.test.ts` to fail on `locator('.` and `locator('#` outside a short,
  explained allow-list (layout checks that measure a class on purpose, such as the top-bar heights).

### Edge cases found while writing the tests (decisions, not bugs)

Each of these is **written down as a test that documents today's behaviour**, so changing it is a deliberate act.

- [ ] **Names accept line breaks and control characters** (`Muzeul\nde Artă`, a null character). They are stored and shown as
  text, so nothing breaks, but an administrator's list could look odd. *Decide:* reject control characters in the form,
  the server and the database.
- [ ] **Country code is any two capital letters**: `ZZ` passes, and a lowercase `ß` becomes `SS` (South Sudan's code).
  *Decide:* check against the ISO 3166 list.
- [ ] **The website may be an IP address or an internal host** (`https://10.0.0.1/`). It is only shown to the administrator
  (never fetched by the server), so no server-side request forgery, but the administrator might click it. *Decide:*
  refuse IP addresses and `.local` hosts.
- [ ] **Differently-capitalised addresses** (`/EN/terms`) sometimes serve the page instead of a 404. Harmless; search engines
  might index a duplicate. *Suggest:* a `rel="canonical"` link or a redirect to lower case.
- [ ] **Submitting a form before the page has finished loading** sends it as a plain form post; for an invalid entry the page
  reloads without an error message. *Suggest:* disable the buttons until the page is ready, or render the message on the
  server for that path.
- [ ] **A published address is up to 60 characters**, cut where it falls; two long names can end up as `…-2`. Fine, but the
  address is part of every printed QR flow only through the short code, so this only affects links people share.
- [ ] **Preview deployments use production's project** until TECH-TASKS step 0 is finished. Anything a tester types into a
  Preview becomes real data.

### Bugs this review found, now fixed (each has a test that failed first)

1. **A weak or breached password showed "The email request was not completed."** — Supabase answers `weak_password`, the
   app showed the generic email message. Matters as soon as *Prevent use of leaked passwords* is switched on. Now has its own
   message in all three languages. (`auth-feedback.test.ts`)
2. **`supabase/config.toml` had registration and email confirmation switched off.** Nothing reads it in production, but a
   local run or a pushed config would have made a site where nobody can register, or where unconfirmed accounts count as
   confirmed. Now on, and a test keeps it so. (`auth-config.test.ts`)
3. **A published address could end in a hyphen** when cut at 60 characters, and the visitor lookup refuses such an address:
   a guide published and unreachable. Fixed in the publishing migration. (`test-database.mjs`)
4. **A location named "Place des Arts" was published but unreachable and missing from Explore**: any address starting `place-`
   is the placeholder every new place carries, which visitors are never served. Now such names get a `the-` prefix. (`test-database.mjs`)
5. **The wrong Supabase reference** (`uzl…`) in the docs and in Vercel switched the registration form off. Corrected in 11 files.

Findings 3 and 4 are in `supabase/migrations/20261013090000_publishing.sql`, which is **not installed on any real project
yet**, so it was changed in place. If it was already pasted somewhere, paste the two changed statements again
(`private.slug_text` and the part of `public.publish_place` that builds the address).

### Honest limits of the automated tests

- The workspace suite and the end-to-end checks of signed-in flows use a **fake Supabase** (the HTTP layer is simulated; the
  database underneath is the real migrations in a real Postgres). Registration, sign-in, two-factor and publishing are
  therefore tested against *our understanding* of how Supabase behaves. The smoke test and Part A are what check the real one.
- The public-site tests (`privacy-security`, `hostile-text`, the older specs) use **no mocked data**: the real production
  build, real HTTP, a real browser. Signed-in end-to-end tests without any fake would need a dedicated `neruma-dev` project with
  seeded test users and a way to read their confirmation emails; that is the next step if you want it.
- Everything marked "manual" above needs a person. Please tell me what you find, and I'll turn each real failure into a test.
