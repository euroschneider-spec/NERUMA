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

## Not yet discussed

- `DESIGN-TASKS.md` sections 5, 6 (other items) and 7.
- `TECH-TASKS.md`.
- Whether Preview-strip wording, the law and its date should be named in the product copy.
