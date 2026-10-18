# Decisions

Why things are the way they are, in the project owner's words, tidied up. The task lists say *what* to do;
this file says *why*. If a task contradicts an entry here, the entry wins and the task should be fixed.

Add an entry when a choice is made on purpose. Don't re-open an entry without saying what changed.

## Principles

These three decide the trade-offs below. When two options are close, pick the one that fits them.

1. **Visitors first.** The site should feel made for visitors. Organisations are a smaller group and only
   need to know where to click.
2. **Quick and simple, because organisations do the work themselves.** NERUMA is a small project with no
   capacity to visit institutions and rate every sensory level for them. Organisations do it on their own,
   so a quick path to their dashboard to select the levels is what the project offers. Anything that adds
   clicks, reading or steps works against that.
3. **Mobile first.** Most visitors are expected to use a phone. When a choice is a trade-off, the phone
   version wins. *Assumption, not measured: there are no visitors or customers yet. Check it once real
   visits exist.*

## Context

- **Why now.** An obligation takes effect in January requiring institutions to state the sensory level of
  their spaces (sound, light and so on) for neurodivergent visitors and others with accessibility needs.
  NERUMA's guides are meant to help organisations meet it, and the aim is to show it to museums and other
  organisations as soon as possible. *The law's name and exact date are not yet verified.*
- **No customers yet.** Mock data will be added later to see how the site looks. The site starts empty.

## Design decisions

### Visitors and organisations are separated, organisations are one click away
Visitors see their own material first. Organisations get one clear *For organisations* link, and
everything organisation-specific lives behind it.
Covers: `DESIGN-TASKS.md` section 1.

### Methodology is for everyone, linked from "How it works"
Methodology explains how NERUMA decides what it says and what those decisions rest on. That builds trust
with visitors as well as organisations, so it is **not** moved into the organisations area. The problem was
that it is written for experts (dB(A), lux, PAS 6463, "platform plan v0.1"). "How it works" links to it
("How we decide →"), the plain-language part comes first, and the expert detail stays further down.
Replaces the task "move Methodology out of the visitor navigation".

### One thin "Preview" strip instead of scattered notices
The project is young and we want to show it early. One calm statement says so honestly, instead of several
notices that each sound like something is broken.
Covers: `DESIGN-TASKS.md` section 1, last item.

### Visitor pages are one scrollable page with jump links
Many visitors are in a hurry, on a phone, and don't want to open a menu. Scrolling is the easiest thing to
do and the jump buttons are a shortcut. *Explore* and the guide stay separate pages. Organisations get the
same pattern. This only works if each section is short; the home page is already 4709px tall on a phone.
Covers: `DESIGN-TASKS.md` section 2.

### The menu: jump links, then two buttons
Modelled on a reference site the owner likes (testylify.netlify.app). *How it works · Who it's for ·
Sources* jump to sections of the home page, *Explore* is its own page, then an outlined *Example guide*
button and a filled *For organisations* button. The filled button replaces the earlier "quiet link":
organisations should find it at once. *Explore* stays in the menu. The separate *How it works* page is
gone; `/how-it-works` redirects to the section. Its older long text (four numbered points) was removed with
it and is in git history if wanted. RO and DE wording of the new sections is a draft for native review.
Covers: `DESIGN-TASKS.md` sections 1 and 2.

### Sign in is on screen the moment the organisations page opens
Returning organisations should not scroll to sign in. *Request access* and *Sign in* sit right under the
title of the organisations page, and the menu keeps its single *For organisations* button. *Demo workspace*
is a quiet link lower down. Checked at 1280px, 390px and 320px in EN, RO and DE.

### The location editor opens quietly
The long responsibility box, the "private draft" notice and the paragraph about languages are gone from the top of
the location editor. A single line says **Editing in English**, and the language explanation is a "?" tooltip
(no Draft tag: the dashboard card shows the status). Save, Preview and Publish sit at the top and the bottom. Hints under fields become the same "?" tooltip (the country hint first). The
responsibility text is shown once at registration and again at publication review, not on every page. Owner's
wish, 2026-10-11. The location types no longer say "Other organisation": the last choice is "Other".

### The guide keeps one label: "Museum pre-visit guide"
There are no customers yet, so the example guide is a stand-in. The "fictional" wording is scaffolding for
that stage, not a permanent part of the design.
Open: "fictional" should appear only on mock data and disappear with it, not be typed into the page.
Covers: `DESIGN-TASKS.md` section 3, third item.

### Responsibility text is shown once, at registration
Organisations do the work themselves, so every extra block to read is a cost. The text is shown once, as the
consent step in Register, and linked elsewhere. It probably has legal weight (organisations vouch for what
they publish), so it must stay a real consent step, not only a link that can be skipped.
The same principle covers the rest of `DESIGN-TASKS.md` section 4: form first on Register, Builder steps as
accordions, compact home cards, resend section tucked away on Login, trimmed copy.

### Reading settings move into the top bar as a labelled button
Mobile first: the floating edge tab is easy to miss, has no label, and covers content on phones.
Done 2026-10-12: the top bar keeps language, an icon-only light/dark button and the labelled *Reading settings*
button; *Cool / Warm* (now *Accent colour: Blue / Green*) and *Summary / Full page* moved into the panel, and the
organisation sidebar lost its Cool / Warm switch the same way. The panel opens under the button and scrolls inside
itself on short screens. The top bar scrolls away on long pages, and the owner chose (2026-10-13) to keep it that way:
visitors set their reading preferences once and don't need the button on screen all the time, so it stays next to the
language button (briefly tried in the sticky header on 2026-10-12, then reverted).
Covers: `DESIGN-TASKS.md` section 6. Sections 5 and 7 follow from the three principles above and have not
been discussed one by one.

### The theme follows the visitor's device until they choose
Owner, 2026-10-11. Replaces "dark is the default" (the design still treats dark as the fallback when a device
can't say). A visitor who has not chosen gets light or dark from their device and follows it live; picking a
theme in the reading panel (first choice there: *Match my device*) or with the header button keeps it from then on.
Storing a setting such as text size does not count as choosing a theme. The old code saved a theme with every
setting, which can't be told from a choice, so themes saved before this change are reset once to follow the device
(a `themeV` marker in the stored settings; fine while there are no real visitors, and every later choice is kept).
High contrast stays a deliberate choice: following `prefers-contrast` was considered and left out for now.
The language still comes from the browser later (`TECH-TASKS.md`, section 2).

### Organisations shape their own steps, within limits
More flexibility in the editor (owner, 2026-10-11). Each step card folds in place to one line; the sidebar folds
to icons. Fields are chosen per step: name, description and the sensory profile always stay, so visitors can
compare places; photo, useful note, what happens next and "may skip" can be removed and added back, and
organisations can add their own fields from a few types (short text, yes/no, photo). Not chosen: a list of
steps on the left with one open, dragging the sidebar wider or to the other side, removable sensory channels.
Details (brief `2026-10-11-step-fields.md`): removing a field keeps its text hidden so it can come back; own
fields are a short text or a yes / no question to start with (a photo later); up to 5 per step; a yes / no
has a third answer, *Not answered*, so unknown never reads as no.

### When the app asks "are you sure?"
Owner's question, 2026-10-11. Only for what can't be undone with one click: **removing a step** asks first
(Cancel has focus, Escape cancels), and **publishing** will ask when it exists (it goes public and carries the
responsibility text). Removing a *field* (the ×) does not ask: its text is kept and *Add a field* brings it back.
Save stays on screen in a bar at the bottom of the editor, so a small change deep in a step never means scrolling.

### QR codes: one per location, made at publishing, never reused
Owner, 2026-10-11. A printed code can never change, so these rules are fixed before anything is printed.
- **Only after publishing.** A location gets its code the first time a guide of it is published, in the same
  step. Before that the dashboard card shows no code, so no printed code ever leads to an unfinished guide.
  Not chosen: a code from the start that "works once published" (it would have let signs be printed earlier).
- **A short random code** (`/q/k7f3qz2m`), not one made from the name: it can't clash between places with the
  same name and still fits after a rename. The link shown on the card is the same short link.
- **One code per location, not per language.** One sign for everyone; the guide opens in the visitor's phone
  language when it is published, otherwise in a published one, with the language switch. The `qr_redirects`
  table points at one guide (one language) today, so this needs a database change with publishing.
- **Kept forever.** The code stays with its location for good and is never given to another. If the location
  is unpublished or removed, scanning shows "This guide isn't available right now", not a bare 404;
  publishing again makes it work. Visitors can't read unpublished rows, so the notice needs a server check that
  says only "exists, not available", never the location's name.

### Publishing goes live straight away, all complete languages at once
Owner, 2026-10-13. *Publish* puts the guide live without a NERUMA review: organisations are checked when they register,
and publishing is one confirm step that shows the responsibility text (NERUMA can still take a guide down). One button
publishes every language whose steps are complete; a language missing text waits, and one published before keeps its last
version. Published guides appear in Explore automatically. Organisations can unpublish themselves, with "are you sure?";
the QR code keeps working and shows "This guide isn't available right now". The address is made from the name at the first
publish and never changes. Not chosen: a NERUMA approval queue (slower, and against "quick and simple"), publishing each
language separately, unpublishing only through NERUMA. Plan: brief `2026-10-13-publishing.md`.

### Two-factor sign-in is required for owners, admins and platform administrators
Owner, 2026-10-13. Payments are coming, and a leaked password alone must not reach billing, an organisation's data or
NERUMA's data. Everyone in those roles confirms sign-in with an authenticator-app code. Platform administrators from the day
it is installed; organisation owners and admins after 30 days with a banner, then sign-in leads straight to setup (nobody
is locked out; this follows Microsoft 365, GitHub and Google Workspace). The date is one setting and can move, for example
to the payments launch. The database enforces it, not only the pages. Backup codes are Supabase's own
(experimental; hidden if the project has them off). *Remember this device for 30 days* skips the code on one browser
(an httpOnly cookie; listed by date only, no device details); not for platform administrators. Not chosen: SMS codes (cost,
SIM-swap); passkeys for now. Plan: brief `2026-10-13-two-factor-sign-in.md`; reset steps `docs/guides/TWO-FACTOR.md`.

### Deleting an account deletes everything, after 30 days
Owner, 2026-10-13. A person can delete their own account (or ask an administrator). It is locked at once, shows "deletion in
progress", and after **30 days everything about them is deleted**: their request, documents, review history, acceptance record,
the guide versions they published (even when colleagues keep the organisation; the guide then waits for a colleague to publish
again) and their name in the change history. Within the 30 days an administrator can restore it. Problem reports they sent are
kept, anonymised and labelled "account deleted", and can be deleted by hand. A sole owner's organisation is hidden for 30 days, so
an administrator can **hand it to a verified colleague** (also for someone who was fired), then deleted; its QR codes stay and say
"unavailable". They receive their data, the date they asked and what happens when. Not chosen: keeping an anonymised record that
the organisation was verified (owner accepts that nothing will show the check happened). Plan: brief `2026-10-13-delete-account.md`;
what is stored where: `docs/guides/PERSONAL-DATA.md`.

### Organisations can report a problem to NERUMA
Owner, 2026-10-11. A button in the organisation sidebar, *Report a problem or ask for help*. Chosen: the report
is saved in the database and the platform administrator reads it in the admin area. Not chosen: a link that opens
the person's email program (nothing tracked, and email isn't set up for real use yet, `TECH-TASKS.md` section 4).
Visitors reporting a wrong guide to the organisation is a separate feature that waits for publishing.

### A dev database and a production database
Owner, 2026-10-12. Two hosted Supabase projects, both to be in Central EU (Frankfurt): `neruma-dev` for trying
migrations and features, `neruma-prod` for the live site. Chosen: a second hosted project over local Supabase,
because it needs no Docker and behaves like the real thing, and the owner wants a stable dev. The in-memory fixture
and the isolated PostgreSQL stay for automatic tests. Production is still in Ireland, with test data only, and moves
to Frankfurt as a new project when the owner decides (a region can't be changed). Steps: `docs/guides/DATABASE-ENVIRONMENTS.md`.

### The demo is the real organisation app, saved only in the visitor's browser
Owner, 2026-10-12. The demo at `/demo` uses the same sidebar, dashboard cards, step editor, preview and QR pop-up
as a signed-in organisation, with fictional but realistic data: a published Willow Museum and an unfinished garden
pavilion. Changes are kept only in the visitor's browser, so two visitors never overwrite each other and nothing
reaches the server; *Reset demo* restores the sample. Publishing is switched off. The QR code opens the public
example guide. Not chosen: a shared demo account (visitors would overwrite each other) and keeping nothing (a reload
would lose the visitor's work). Plan: brief `2026-10-12-demo-workspace.md`.

### Platform administrators land on their own dashboard and manage each other from the app
Owner, 2026-10-17. Everyone signs in through the same steps (password, then the authenticator code); where they land depends on
the account. A platform administrator goes to `/admin`: what waits (organisation requests, problem reports, deletions), the
accounts list (searchable by email) and the administrators list. An administrator can add another (an existing confirmed account)
or remove another, never themselves, so the last one can't be removed. Before this, the first one was added with SQL; that is still
how the very first one is made. The administration area always says so: a strip with the signed-in email on every page, and a warm yellow in place of the blue (dark and light themes; high contrast keeps its palette). An administrator can open any account's profile (read only; no actions and no record of who looked, for now). Not chosen yet: a list of organisations, a history of who added whom. Plan: brief `2026-10-17-superadmin-dashboard.md`.

### Payments go through Stripe
Owner, 2026-10-18. The owner wanted a German provider. The research found German payment companies (Unzer, Novalnet, Payone,
Computop) but no German company that also runs subscriptions, VAT and invoices for software sold to businesses; the German
"merchant of record" services (Digistore24 and similar) are built for online courses. Stripe does all of it in one place, so
Stripe it is. This is an exception to the European-provider lean (TECH-TASKS §15): Stripe is a US company that serves EU
customers through Stripe Payments Europe in Ireland, so its data-processing agreement is signed and it is named on the privacy
page as a processor. Still open, for the payments brief: who the seller is (which company, which country; it decides VAT and
the invoice format), the plans and prices, whether institutions can pay by invoice and bank transfer as well as by card or
SEPA direct debit, what happens when an organisation doesn't pay, and how the Stripe webhook writes to the database without a
signed-in user (TECH-TASKS §8). German e-invoices (XRechnung or ZUGFeRD) are not a Stripe feature as far as checked; confirm
before relying on Stripe's PDF invoices for German customers.

## Not yet discussed

- `DESIGN-TASKS.md` sections 5, 6 (other items) and 7.
- `TECH-TASKS.md`.
- Whether Preview-strip wording, the law and its date should be named in the product copy.
