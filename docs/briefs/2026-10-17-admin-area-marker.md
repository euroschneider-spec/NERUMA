---
status: done   # idea → building → done
date: 2026-10-17
---

# Mark the administration area

## Idea
A superadmin should always see that they are acting as a platform administrator. Every administration page shows a strip
with an icon and words, and the signed-in email. The whole administration area also looks different from the rest of the site,
in a warm yellow, so it can't be mistaken for the organisation side. An account's profile page (a later task, TECH-TASKS §14)
adds "you are viewing this account as a platform administrator".

## Why
A platform administrator sees every account and can add administrators. The same person may also own an organisation, and the
two sides look alike today. A clear mark lowers the chance of acting in the wrong place, and shows a bystander or a screenshot
whose view it is. (Proposed reason, to be confirmed by the owner.)

## Done when
- [x] Every administration page (dashboard, accounts, administrators, review queue, reports, deletions) shows a strip with an icon,
  the words "Platform administration" and the signed-in email, on a phone as well as a desktop.
- [x] The administration area has a warm yellow accent in every theme (dark, light, high contrast, warm dark, warm light) and
  passes the automated contrast checks in each; high contrast stays at least as strong as it is now.
- [x] The strip and the colour are not the only signal: the words stay when colours are changed, and a screen reader reads the strip.
- [x] Nothing outside the administration area changes colour.

## Not in scope
- The profile page itself and its "you are viewing this account" line (TECH-TASKS §14, item 1): this brief only prepares the wording.
- A colour for organisation owners and admins.

## Decisions
- Proposed wording: strip "Platform administration · signed in as {email}"; profile line "You are viewing this account as a platform administrator."
  (RO and DE to be written with the same meaning.)
- Colour is applied by one class on the administration pages that replaces the accent colours, so no other page is affected.

## Result
Built on pull request #57. `src/app/[locale]/admin/layout.tsx` wraps every administration page in `admin-area` and shows the strip (same gate as the
pages, a plain 404 for anyone else). The yellow is in `globals.css` (`.admin-area`, dark and light; contrast 5.2 to 10.9 for links and
button text). High contrast keeps its palette and gets the strip only; the reader's warm-green accent is replaced inside the area.

Ran: typecheck, lint, unit (224), `test:workspace` (65; new checks: the strip on all six pages with the email, and axe in dark, light, warm dark,
warm light and high contrast on the dashboard and administrators pages, and no strip on `/account`), and the full Playwright run (151 passed,
13 skipped). One test failed once in the full run, "the header stays in view while the page scrolls" (home page anchor, 55px against 60px), and
passed alone straight afterwards; the home page does not use this layout. Not run: `test:db`, `test:data`. RO and DE pages have no automated
contrast scan beyond the shared tokens.
