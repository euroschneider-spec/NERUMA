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
- [ ] 1. App shell: sidebar with organisation name and role, *Dashboard · Guide editor · Team*, language and
      theme at the bottom, *Account / Sign out* visible. The demo workspace uses the same shell.
- [ ] 2. No dropdowns in organisation and admin forms: one shared sensory control (*Not recorded · Low ·
      Moderate · Intense · Varies*) in both builders; organisation type, location type and the admin decision
      as visible choices.
- [ ] 3. Guide editor: zones listed on the left (01, 02, + Add zone, move up / down), one zone open on the
      right, a save bar that stays on screen, a compact photo with alt text.
- [ ] 4. Live preview beside the editor, built from the guide component visitors see.
- [ ] 5. Dashboard: status badges, a *Needs attention* list from existing data (missing alt text, fewer than
      three zones, not verified on site), the QR and link card.
- [ ] 6. Team page, read-only: members, roles and what each role may do.

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
- Mock browsing data is on only under `VIANORAE_FIXTURE_DEMO_DATA=1` (set by `dev:mock`), so the test suites
  start from the plain fixture.

## Result
Filled in at the end: the pull requests, what changed, what was run, what was not run.
