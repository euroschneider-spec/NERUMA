---
status: building   # idea → building → done
date: 2026-10-11
---

# What an organisation sees

## Idea
Signed-in organisations get one app of their own, like the reference the owner likes (testylify.netlify.app,
signed in): a sidebar with the organisation name and your role (*Dashboard · Guide editor · Team*), a guide
editor with the zones on the left and one zone open on the right, visible choices instead of dropdowns, and a
live preview of exactly what guests see. The demo workspace looks the same, so organisations see what they will
get.

## Why
Organisations do the work themselves, so the tool must be quick and calm (`DECISIONS.md`: quick and simple).
Today an organisation meets four separate pages (account, workspace, location editor, demo builder), the
editor is one 3,000–8,000px page with 30 dropdowns, and the header gives no sign of being signed in.

## Done when
Checked on the mock site (`npm run dev:mock`), on a phone first.

Part 1 — the look and navigation, using what the database already has:
- [x] 0. Mock data: an organisation with a location and five zones, and a request waiting for review.
- [x] 1. (1a) App shell around `/workspace`: sidebar with organisation name and role, *Dashboard* and *Public site*,
      language, theme and *Sign out*; locations overview with name, address and status. Still to do: the *Team*
      link (step 6), the demo workspace in the same shell, a photo on each card, QR codes, needs attention.
- [ ] 2. No dropdowns in organisation and admin forms: one shared sensory control (*Not recorded · Low ·
      Moderate · Intense · Varies*) in both builders; organisation type, location type and the admin decision
      as visible choices.
- [ ] 3. Guide editor: each step card folds in place to one line (number, name, photo thumbnail, a tick when
      complete); the sidebar folds to icons. (Replaces the zones-on-the-left list: owner, 2026-10-11.)
- [ ] 3b. Fields per step: name, description and the sensory profile always stay; photo, useful note, what
      happens next and "may skip" can be removed and added back; organisations can add their own fields from a
      few types (short text, yes/no, photo). Needs a database change.
- [ ] 4. Live preview beside the editor, built from the guide component visitors see.
- [ ] 5. Dashboard: status badges, a *Needs attention* list from existing data (missing alt text, fewer than
      three zones, not verified on site), the QR and link card.
- [ ] 6. Team page, read-only: members, roles and what each role may do.

## Task breakdown (owner's wishes, 2026-10-11)
**Task 1, the dashboard** (owner does everything for the MVP; no reviewer role yet): all locations with name,
address and a photo; a QR code and link per location; visitor counts; billing (owner only); what needs
attention (unpublished changes, missing alt text, too few zones).
- 1a Sidebar shell and a locations overview (name, address, status). 1b Needs attention. 1c QR and link per
  location, plus a photo on the card. (Photo and 1b done in PR #29. The QR code is made at publishing, so it
  moves into the publishing task: `DECISIONS.md`, "QR codes".) 1d Plan & billing page, owners only, a placeholder until payments exist.
  1e Visit counts (privacy decision first).

**Task 2, seeing changes live** (desktop and laptop only; no effort for phones): the editor keeps changes in
memory, so the preview next to it reads from that and updates as you type, without saving. Same guide
component visitors see; a picked photo shows at once. Narrow screens get a *Preview* button, nothing more.
- 2a zones listed left, one open on the right. 2b the live preview beside it. 2c add, remove and reorder zones.
  2d the photo is optional (no empty box). 2e every field we offer can be removed and added back.
  Fields with their own names ("Opening hours") come later and need a database decision.

## Not in scope
Part 2, each needing the owner's decision before a database change: guest settings (default senses, layout A/B,
read-aloud), measurements next to the levels, the editor role and invitations, publishing, visitor counts.
Part 3: the administrator side in the same shell.

## Decisions
- *Not recorded* stays as a fifth sensory choice: unknown must stay visible and never read as low
  (methodology). The reference site has only four.
- The demo workspace gets the same shell as the real one.
- No dropdowns applies to organisation and admin forms only; the reading panel, language menu and Explore
  filters stay as they are. Country stays a two-letter text field (about 200 countries cannot be buttons).
- Organisation accounts: owner only for now. Reviewers, editors and invitations wait.
- The Organisation account page is for applicants and people waiting only; approved owners get *Sign out* in the
  sidebar and never need it.
- Steps fold in place rather than a list on the left with one open step: simpler, and it works on phones.
- The sidebar folds to a strip of icons, remembered in this browser. No dragging it wider or to the other side.
- Fields are chosen per step, not for the whole location. The sensory profile can't be removed, so guides stay
  comparable between places (visitors first).
- Mock browsing data is on only under `VIANORAE_FIXTURE_DEMO_DATA=1` (set by `dev:mock`), so the test suites
  start from the plain fixture.

## Result
Filled in at the end: the pull requests, what changed, what was run, what was not run.
