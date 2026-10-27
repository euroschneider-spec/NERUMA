---
status: done   # idea → building → done
date: 2026-10-26
---

# One button system, two sizes (T-009)

## Idea
Today there are two button systems: `.btn` (36px) and `.button` (48px), plus `.button-small` (32px), `.btn-lg`
(48px) and a 40px override on phones. Settle on one system with two sizes, and let each size change with the screen:

| Size | Phone | Desktop |
|---|---|---|
| Normal | 44px | 40px |
| Small | 36px | 32px |

The main action is told apart by colour, not by a bigger box. The old second class set goes away.

## Why
Phone users tap more easily: today phone buttons (40px) are smaller than desktop ones (48px), which is the wrong way round
for a finger. One rule for button size also stops new pages from inventing a third size, which is how two systems
grew apart. (`docs/planning/DESIGN-TASKS.md`, section 7.)

## Done when
On a phone first:

- [x] On a phone every normal button is 44px tall and every small button 36px; on desktop 40px and 32px.
- [x] No page shows two buttons of the same kind at different heights side by side (for example in the top bar).
- [x] Only one set of button classes is left in the code (`.btn` is gone), and the tests still pass, including the contrast checks.

## Not in scope
- No new look: colours, rounded corners and fonts stay as they are.
- Icon-only buttons (the 44px square ones) and the small round info buttons stay as they are.
- No page layout changes: only button sizes and class names.
- No large size. Add one later if a page needs it.

## Decisions
- Sizes are two CSS variables, `--button-h` and `--button-h-small`, set in `globals.css`; phone is up to 450px, the width the file already used for phones.
- Fields (`.input`, `input`, `select`) follow `--button-h`, as PR #73 decided (fields as tall as the buttons beside them): 44px on phones, 40px on desktop.
- The top bar controls and the sidebar footer controls are small buttons; the menu's *Example guide* and *For organisations* are normal. Read-aloud buttons lost their own 44px and follow the system.
- The password eye fills the height of its field (`min-height: 0`), because a 44px eye stuck out of a 40px field (found by `test:workspace`).
- `.btn` and its variants, and `.side-link`, were used by no component: deleted.
- Two sizes, not three (owner, 2026-10-26): a large size would be picked wrongly and bring the mess back.

## Result
Pull request #94. `src/app/globals.css` only: one button system, two sizes (table above); `.btn*` and `.side-link` removed.

Measured on the production build: phone 390px normal 44, small 36, fields 44; desktop 1280px normal 40, small 32, fields 40, menu buttons 40, top bar controls 32 (same height).

Run: typecheck, lint, `test:unit` (299), `test:db` (155), `test:workspace` (75), and the browser specs `platform`, `top-bar`, `read-aloud`, `reading-accessibility` (61 passed). One failed: `platform.spec.ts:125` ("For organisations links to the responsibility text"); it fails the same way on `main` without this change, so it is not from the buttons. Not run: the other browser specs (CI runs them); the hostile-text and privacy specs.
