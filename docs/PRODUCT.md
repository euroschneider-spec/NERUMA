# NERUMA: what the product does

Functionality only: what each kind of person can do today, and the rules they meet. How it is built is in
`docs/architecture/`; why things are this way is in `docs/planning/DECISIONS.md`; what is planned is in `docs/planning/TECH-TASKS.md`.
Written 2026-10-13 from the code. **Keep it current:** a pull request that changes what someone can do updates this file.

**Read first.** Some features exist in the code but only switch on once their database migration is installed on a project
(publishing, QR codes for real places, Explore with real places, two-factor, remembered devices, step fields, problem reports,
mandate documents). On production today the verification, mandate-document, builder, step-field and problem-report migrations are
installed; publishing, two-factor and remembered devices are not (TECH-TASKS §12, the migration job).

Languages everywhere: **English, Romanian, German.** Root `/` opens English; an unknown language is a 404.

---

## 1. Visitors (no account, nothing to sign in to)

### What they can read
- **Home**: what NERUMA is, how it works in three steps, who it is for, the six sensory channels, where information comes from
  (three source levels), and a link to the example guide.
- **Text pages**: For organisations, Methodology, Privacy, Terms, Accessibility. Privacy and Terms are **drafts**.
- **Explore**: every published guide, plus the fictional example (Willow Museum). Filter by category.
- **The example guide** (`/places/willow-museum/guide`): fictional, always available.
- **A published guide** (`/places/<address>/guide`), in the visitor's language when it is published in it, otherwise in a published
  one, with links to the other languages. A guide that was taken down shows a neutral "isn't available right now" page that never
  names the place.

### The guide
- **Step by step**, mobile first: step counter and progress, title, photo (optional), description, the **six channels** (sound, light,
  crowding, smell, temperature, visual complexity), each as *not recorded / low / moderate / high / variable*, a support note, what
  comes next, the organisation's own fields (a yes/no left unanswered is never shown as "no"), and "you may skip this".
- Previous / Next, a finish screen with Restart, jump to any step.
- **Full text view**: every step on one page.
- Arrival information and where the information comes from (and when it was published).
- Works without sound; nothing plays on its own.

### QR codes
- Each published place has **one QR code**, made at its first publish and never reused. It carries no language: scanning opens the
  guide in the **phone's language** when published, otherwise in a published one (`?locale=` can ask for one).
- A code of a guide that is down opens the "isn't available" page. An unknown code is a plain 404.
- The QR image is an SVG, downloadable.

### Reading settings (every page)
- Text size (normal, large, larger), theme (follows the device, light, dark, high contrast), accent colour (blue, green),
  line width, typeface (default or Atkinson Hyperlegible), extra spacing, and on text pages full or summary length. Reset.
- Remembered in the browser only, applied before the page appears (no flash).
- The panel can be moved by dragging or with the keyboard, and closes with Escape.

### Read aloud
- Uses the device's own voice; **no text is sent anywhere**. Play, pause, resume, stop, speed 0.75× / 1× / 1.25×.
- Reads the page, the current step or the whole guide. If the device has no voice for the page language, it says so instead of
  reading in another language.

### Contact
- A form that **prepares** a message (name, email, organisation, message) and copies it; nothing is sent or stored.

### Privacy for visitors
- No account, no analytics, no advertising, no third parties, no cookie on a first visit. Settings are stored on the device only
  after the visitor changes one (listed on the privacy page; enforced by tests).

---

## 2. Anyone trying the organisation tool (no account): the demo

- `/demo`: the **real organisation app**, saved only in this browser. Two fictional locations: a published museum (with a sample QR
  code and visit count) and an unfinished pavilion.
- Everything a real organisation can do except publishing (switched off, and says so). Photos up to 5 MB, stored in the browser.
- *Reset demo* (asks first) brings back the originals and removes the browser's photos. Nothing is sent to a server.

---

## 3. People applying for an organisation (signed in, not yet approved)

### Register
- **Organisation**: name, type (institution, museum, hotel, cultural venue, public service, other), official website (https),
  country code, registry reference (optional).
- **Representative**: name, role, and how their authority can be confirmed (20 to 2,000 characters).
- **Account**: work email and password (12 to 128 characters).
- **Two statements**, both required: "I am authorised to represent this organisation" and the responsibility statement for the
  content. Their wording, language and time are recorded.
- The server applies every rule even if the browser's checks are skipped.

### Confirm the email, then submit
- A confirmation email (in the registration language); a link back signs them in. *Resend confirmation* is on the sign-in page.
  Until NERUMA has its own email provider, Supabase only sends to the project team's addresses.
- After signing in: attach **1 to 3 documents** proving the mandate (PDF, JPEG or PNG, up to 3 MB each; images are re-encoded and
  stripped of hidden data; PDFs are checked), then submit for **manual review**.
- While pending, editing is locked. If asked for more information, they correct and resubmit.

---

## 4. Everyone who signs in: security

- **Two-factor sign-in** with an authenticator app: set up on the account page (QR code, or a key to type), then a 6-digit code
  after the password. **Required** for platform administrators from day one, and for organisation owners and admins from a set
  date (30 days after installation; a banner shows the date until then). After the date, sign-in leads straight to setup.
- **Backup codes**: a set of single-use codes (Supabase's; typically 10) shown once after setup (downloadable); "use a backup code instead" at sign-in; count left
  and a new set (asks first) on the account page. Hidden if the Supabase project has them switched off.
- **Remember this device for 30 days** (organisation owners and admins, never platform administrators): one browser skips the code;
  the account page lists remembered devices by date only and can forget them. A new password or an administrator's reset forgets all.
- **Lost phone**: write to NERUMA from the account's email; an administrator checks who they are and resets two-factor.
- The rule is enforced by the database: a session that didn't pass the second factor can't read or change organisation data.
- **Delete my account** (account page): confirmed with the password and the two-factor code, after reading the exact date. The
  person gets a ZIP of all their data at once (a private link that works 7 days without signing in). The account is locked
  immediately (every page says so), deleted completely 30 days later, and restorable by an administrator until then. Problem
  reports they sent stay without their name. An organisation they owned alone is hidden for 30 days, then deleted; its QR codes
  keep saying the guide isn't available.

---

## 5. Organisation owners and admins (approved organisation)

### Dashboard
- One card per location (up to 100): photo, name, draft or published, address, and **what needs attention** (fewer than 3 steps,
  a step without name or description in this language, a photo without a description, changes not yet published).
- Per card: edit, **QR code and link** (published only: view, download, copy link), open the public guide.
- Several organisations: a switcher.

### Building a guide
- **Location**: name, city, address, country, type, description, arrival information.
- **Steps**: 1 to 8 per location (3 to 8 to publish). Each: name, description, a useful note, what comes next, "visitors may skip",
  six sensory levels, and a photo.
- **Photos**: JPEG, PNG or WebP up to 3 MB, resized and re-encoded, hidden data removed. A description (in each language), who holds
  the rights and the date taken are required. Private until published.
- **Own fields**: up to 5 per step, short text or yes/no. Standard fields (photo, note, next, may skip) can be removed per step
  without losing their text.
- **Languages**: names and texts per language; photos, levels and order shared. Missing translations are flagged.
- **Save**: never publishes. Two people editing at once can't overwrite each other; the later one is asked to reload.
- **Preview**: exactly what visitors will see, from the saved draft, with read aloud.

### Publishing
- **Publish** (owners and admins) shows which languages go live and which wait and why, then the responsibility statement and one
  tick. It goes live **straight away**, every complete language at once, without a NERUMA review.
- The first publish makes the web address (from the name and city; never changes) and the QR code (never changes).
- Editing after publishing changes nothing public until the next publish; the card says so.
- **Unpublish** (asks first): the address and QR code stay and say "isn't available", without the name; photos become private again.

### Report a problem
- From the sidebar: a message to NERUMA (10 to 2,000 characters), optionally about one location. Up to 5 an hour, 20 a day. The
  confirmation says plainly it was **saved, not emailed**.

### Not there yet
- No page to invite or manage team members; organisation **admin** and **owner** are the only roles the app knows.

---

## 6. Platform administrators (NERUMA)

- **Dashboard** (`/admin`, where an administrator lands after signing in): the three queues below with how many wait in each, and
  the number of accounts and administrators. The same sign-in and two-factor steps as everyone else. The account page of an administrator with no organisation of their own has a link to it and no registration form. Every administration page has a Sign out button in its menu, a strip saying "Platform administration" with the signed-in email, and a warm yellow look that sets it apart from the rest of the site.
- **Accounts** (`/admin/accounts`): every account, newest first, 25 a page, searchable by email: confirmed or not, administrator,
  two-factor on or off, deletion in progress, last sign-in, and the organisations the person belongs to.
- **Administrators** (`/admin/administrators`): who they are; add one by the email of a confirmed account; remove another one
  (never yourself, so there is always at least one). The very first administrator is still added with SQL.
- **Organisation review queue**: pending requests (25 a page) and a history of decisions. Each request shows the organisation,
  representative, role, website, country, registry reference, authority statement and documents.
- **Decisions**: approve (requires confirming the organisation and the mandate independently, the source checked, the evidence, and
  each document marked as reviewed), ask for more information, reject, suspend. Every decision needs a note to the applicant, and
  is recorded with who decided and what was checked. An administrator can't approve their own request.
- **Suspending** an organisation removes its members' access and takes its guides and QR codes down at once.
- **Problem reports**: open and closed lists, the sender's email, close a report.
- **Account deletions** (`/admin/deletions`): every deletion in progress with its date; restore within 30 days; erase when due;
  erase a hidden organisation when due; start a deletion for someone who wrote in and download their data to send it to them.
  Problem reports from a deleted sender are labelled and can be deleted by hand. Steps: `docs/guides/ACCOUNT-DELETION.md`.
- **Two-factor** is always required, and "remember this device" is never offered to them.

---

## 7. Decided, not built yet

- **Hand an organisation to a verified colleague** (brief `docs/briefs/2026-10-13-delete-account.md`, step 2), and the emails that go
  with a deletion (step 3, after the email provider).
- **Terms of use tick** at registration, with the accepted version recorded (proposed; waits for real terms text).
- **Email provider** for confirmations, reminders and notices (TECH-TASKS §4).
- **Visit counts** per location (privacy decision pending).
- **Plan & billing** for organisations (payments not started).
- **A consistent read-aloud voice** generated once per text (researched, not started).

## 8. Visible gaps (things a person can notice today)

- **Explore**: the **country** and **city** filters are shown but do nothing. The category filter offers **Theatre** and **Clinic**,
  which no location can be (the builder's types are institution, museum, hotel, cultural venue, public service, other), and it doesn't
  offer institution, public service or other.
- The **privacy** page's introduction still describes "the demonstration, before live accounts", and does not name the data controller,
  retention or processors (see `docs/guides/PERSONAL-DATA.md`).
- **Terms** are a draft for the demonstration.
- **Contact** prepares a message but does not send it.
- **Emails** reach only the Supabase team's addresses until there is an email provider.
- **Teams**: no way to add a colleague in the app.
- The **methodology** describes on-site and independent assessments; none can be recorded in the app yet.
