---
status: idea   # idea → building → done
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

- [ ] On a phone every normal button is 44px tall and every small button 36px; on desktop 40px and 32px.
- [ ] No page shows two buttons of the same kind at different heights side by side (for example in the top bar).
- [ ] Only one set of button classes is left in the code (`.btn` is gone), and the tests still pass, including the contrast checks.

## Not in scope
- No new look: colours, rounded corners and fonts stay as they are.
- Icon-only buttons (the 44px square ones) and the small round info buttons stay as they are.
- No page layout changes: only button sizes and class names.
- No large size. Add one later if a page needs it.

## Decisions
- Two sizes, not three (owner, 2026-10-26): a large size would be picked wrongly and bring the mess back.

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
