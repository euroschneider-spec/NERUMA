---
status: building   # idea → building → done
date: 2026-10-11
---

# Separate visitors from organisations

## Idea
Visitors should feel the site is made for them first, and organisations should only need to know where to
click. One visitor page with jump links, one organisations page, and one thin "Preview" strip in place of
the scattered "not active yet" notices.

Covers `docs/planning/DESIGN-TASKS.md` sections 1 and 2.

## Why
Many visitors are in a hurry on a phone, and don't want to open a menu to find things. Organisations do the
work themselves, so every extra click or block of text works against the project. An obligation takes effect
in January and we want to show NERUMA to museums and other organisations soon. See `DECISIONS.md`: visitors
first; quick and simple; mobile first; Methodology is for everyone; one Preview strip; one scrollable
visitor page.

## Done when
Checked by looking, on a phone first.

- [ ] The menu reads *How it works · Who it's for · Sources · Explore*, then an outlined *Example guide*
      button and a filled *For organisations* button (the style of the site the owner likes). Nothing about
      registering or signing in is in the menu or the footer except that one link.
- [ ] Home, *How it works* and "where the information comes from" are one page, and the menu buttons jump to
      its sections.
- [ ] The organisations page is one page with jump links: Why → What you describe → Responsibilities →
      Methodology → Request access.
- [ ] One thin "Preview" strip runs across the site, and the scattered "not active yet" notices are gone
      from the public pages.

## Not in scope
- Dashboards (admin and organisation): not visible to the owner yet.
- Guide examples (`DESIGN-TASKS.md` section 3): the next piece of work.
- Trimming copy and compacting the home cards (section 4): after the page structure is settled.
- Settings, theme and the reading panel (section 6).
- Register and Builder pages, apart from moving organisation links behind the single *For organisations*
  link.

## Progress
- Checks 1 and 2 done (PR #13). Check 3 half done: *Request access* and *Sign in* are at the top of the
  organisations page (PR #14); the jump links are not yet.
- Check 4 (the Preview strip) is **pinned** by the owner: talk about it after the organisation side.
  Done towards it: the "Registration is not active yet" line is gone from the Register and Login forms (PR #15).
- Also done along the way: header stays in view (#13), top-bar controls one size (#16), Register page
  balanced and its step list removed (#17).

## Decisions
Choices made while building, with the reason. Copy the lasting ones into `docs/planning/DECISIONS.md`.

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
