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
Covers: `DESIGN-TASKS.md` section 6. Sections 5 and 7 follow from the three principles above and have not
been discussed one by one.

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

### Organisations can report a problem to NERUMA
Owner, 2026-10-11. A button in the organisation sidebar, *Report a problem or ask for help*. Chosen: the report
is saved in the database and the platform administrator reads it in the admin area. Not chosen: a link that opens
the person's email program (nothing tracked, and email isn't set up for real use yet, `TECH-TASKS.md` section 4).
Visitors reporting a wrong guide to the organisation is a separate feature that waits for publishing.

## Not yet discussed

- `DESIGN-TASKS.md` sections 5, 6 (other items) and 7.
- `TECH-TASKS.md`.
- Whether Preview-strip wording, the law and its date should be named in the product copy.
