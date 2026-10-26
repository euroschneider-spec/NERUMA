# Ledger

Small tasks for Claude Code chats, so a fresh chat can start from one line ("do the next task").
Read and changed with `/ledger` (see `mods/README.md`); it can also be edited by hand.
One task per line, fields split by " | ". Open: `- [ ] T-001 | title | context`.
Done: `- [x] T-001 | title | note | cost`.

## Open

- [ ] T-006 | Delete the unused styles .pilot and .principle | DESIGN-TASKS section 7. Quick win.
- [ ] T-007 | Check and tick: builder steps as accordions, Sign in label mismatch, Sign in widths | Probably already done. Measure Sign in at 320, 390 and 1280px before ticking.
- [ ] T-008 | Tick the four boxes of DESIGN-TASKS section 8 | Done in pull request 77.
- [ ] T-009 | Buttons: settle on three sizes in one button system | DESIGN-TASKS section 7. Needs a brief first.
- [ ] T-010 | Dashboard on phones: tabs in one scrolling row, the three stat cards in one row | DESIGN-TASKS section 4. Needs a brief first.
- [ ] T-011 | Register: put the form first, before the four information blocks | DESIGN-TASKS section 4. Needs a brief first.
- [ ] T-012 | Account and admin pages align left like every other page | DESIGN-TASKS section 7.
- [ ] T-013 | Language: pick EN/RO/DE from the browser at the root address | TECH-TASKS section 2. Needs a brief first.
- [ ] T-014 | Photos: let the organisation move and zoom a photo inside its frame, like a profile picture | Needs a brief first: which frame ratio, whether the crop is stored as numbers (position, zoom) or baked into the image, and the keyboard way to move it. Photos live in the private Storage bucket `vianorae-private-photos`, re-encoded to WebP by `src/app/api/workspace/photos/route.ts`.
- [ ] T-015 | QR code: show the location's name with it (on the image and in the download file name) | Needs a brief first. Today the SVG is the code only and the file is `neruma-guide-qr-<code>.svg` (`src/app/api/qr/[code]/route.ts`, `src/components/qr-dialog.tsx`). The database never gives the name to the public code route on purpose (`resolve_qr`), so the name must come from the signed-in side.
- [ ] T-016 | Check the QR code after the domain change: print one from production and scan it | Codes follow the address they are made on, so one made on an old domain still points there. Decide whether `VIANORAE_SITE_URL` should fix the address, and whether the old domain keeps redirecting.

## Done
- [x] T-001 | Sign in: fold the resend-confirmation section behind "Didn't get the email?" | Folded in a details element (EN/RO/DE); workspace test opens it first. Pull request 83, CI green. | not measured
- [x] T-002 | Home: feature cards 3 x 2 on desktop, two columns on phones | New .channel-grid-six: 2 columns, 3 from 900px. Pull request open, CI decides. | not measured
- [x] T-003 | Explore: hide the filters while there is only one place | Country and city filters show only once a published place exists; category stays. Pull request open, CI decides. | not measured
- [x] T-005 | Home: the dot before the tagline and the check mark sit between lines when the text wraps | Both now align to the first line (`.tiny-sun`, `.reassurance svg`); measured at 320px in RO. Pull request open, CI decides. | not measured
