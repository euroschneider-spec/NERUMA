---
status: done   # idea → building → done
date: 2026-10-18
---

# Warnings on forms: say which field needs filling or checking

## Idea
When a field is missing or wrong, the screen still jumps to it, but the field is marked and says what to do, so the person doesn't have to guess.
A warning goes away as soon as its field is right. Going back and forth in the browser leaves no stale warnings and loses nothing typed.
Registration and sign-in first, written down as one general rule for every form.

## Why
If the screen jumps to a field without saying what is wrong, the person is guessing, and that is frustrating (owner, 2026-10-18).
Today the forms use the browser's own pop-up, which speaks the browser's language and not the site's, shows one field at a time, and is not
announced reliably by a screen reader. WCAG 2.2 AA (the project's target, `docs/guides/ACCESSIBILITY.md`) asks for errors to be identified in text,
described, and suggested; `TECH-TASKS.md` §6 already lists "error messages per field, linked to the field".

## Done when
Checked on the registration form and the sign-in form, on a phone first:

- [x] Press *Send* with empty fields. The screen jumps to the first field that needs attention, and every such field shows a message in the site's
  language (for example "Enter the organisation name"), in words and not only colour.
- [x] Fix one field. Its message disappears at once, without pressing *Send* again; the others stay.
- [x] Press *Send*, leave the page, come back with the browser's back button. Nothing typed is lost and no old warning is showing.

## Not in scope
- No checking while typing: a warning appears when *Send* is pressed and clears while the field is fixed. A field you haven't finished shows nothing (owner).
- Other forms (passwords, the guide editor, the organisation request on the account page) later, one by one, with the same rule. Registration and sign-in are in this pull request (owner, 2026-10-18).
- No new rules about what counts as valid; the existing checks become visible and clear.

## Decisions
- The general rule goes in `docs/guides/ACCESSIBILITY.md` and the pieces are shared, so the next form reuses them.
- Scope confirmed by the owner, 2026-10-18: registration and sign-in in one pull request; the rest later. "No new rules about what counts as valid" is the working default.

## Result
Registration and sign-in (and, since it is the same component, the organisation request on the account page) use `useFormWarnings`, `Field` and `CheckField`
(`src/components/form-field.tsx`) and the words in `src/lib/form-warnings.ts`. The rule is in `docs/guides/ACCESSIBILITY.md`. Run: typecheck, lint, `test:unit` (274),
`test:db`, `test:workspace` (72, one new: warnings, clearing, Back, server refusal keeps the typed values, Romanian and German, accessibility checks), `platform`, `privacy-security`
and `reading-accessibility` specs. Not run: a phone, a real screen reader, the real Supabase.
