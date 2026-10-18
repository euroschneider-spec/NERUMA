---
status: idea   # idea → building → done
date: 2026-10-18
---

# Warnings on forms: say which field needs filling or checking

## Idea
When a field is missing or wrong, the screen still jumps to it, but the field is marked and says what to do, so the person doesn't have to guess.
A warning goes away as soon as its field is right. Going back and forth in the browser leaves no stale warnings and loses nothing typed.
Registration first, written down as one general rule for every form.

## Why
If the screen jumps to a field without saying what is wrong, the person is guessing, and that is frustrating (owner, 2026-10-18).
Today the forms use the browser's own pop-up, which speaks the browser's language and not the site's, shows one field at a time, and is not
announced reliably by a screen reader. WCAG 2.2 AA (the project's target, `docs/guides/ACCESSIBILITY.md`) asks for errors to be identified in text,
described, and suggested; `TECH-TASKS.md` §6 already lists "error messages per field, linked to the field".

## Done when
Checked on the registration form, on a phone first:

- [ ] Press *Send* with empty fields. The screen jumps to the first field that needs attention, and every such field shows a message in the site's
  language (for example "Enter the organisation name"), in words and not only colour.
- [ ] Fix one field. Its message disappears at once, without pressing *Send* again; the others stay.
- [ ] Press *Send*, leave the page, come back with the browser's back button. Nothing typed is lost and no old warning is showing.

## Not in scope
- No checking while typing: a warning appears when *Send* is pressed and clears while the field is fixed. A field you haven't finished shows nothing (owner).
- Other forms (sign-in, passwords, the guide editor, the organisation request on the account page) later, one by one, with the same rule.
- No new rules about what counts as valid; the existing checks become visible and clear.

## Decisions
- The general rule goes in `docs/guides/ACCESSIBILITY.md` and the pieces are shared, so the next form reuses them.
- Which of the two last "not in scope" lines are confirmed by the owner: pending (suggested defaults, 2026-10-18).

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
