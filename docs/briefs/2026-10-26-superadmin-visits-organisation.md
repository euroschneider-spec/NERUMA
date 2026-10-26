---
status: done   # idea → building → done
date: 2026-10-26
---

# A platform administrator visits an organisation

## Idea
A platform administrator ("superadmin") can open an organisation's own workspace from the accounts list and see it exactly as the
organisation sees it, with the administration yellow and a strip that says so on every page ("You are viewing <organisation> as a
platform administrator", with a button to leave).

In that mode a superadmin can:
- edit the text and photos that are already there, and replace or remove photos (as a draft);
- **take a guide down** (unpublish) to remove harmful content at once. This asks first, in words that say it is done as a platform
  administrator.

A superadmin can **not**: publish anything, create new locations, add or remove steps, use billing or payment pages, or delete the organisation.

Every change a superadmin makes is **recorded** (who, what, from what into what, when) and the organisation sees it in a change log.

## Why
To remove harmful content at once (a bad photo, harmful text) and to help an organisation that is stuck, without asking for
screenshots or passwords. (Owner, 2026-10-26.)

## Done when
- [x] From the accounts list a superadmin opens an organisation and sees its workspace, with a yellow strip on every page (phone first)
  naming the organisation and a button that leaves. The words stay when colours change, and a screen reader reads the strip.
- [x] In that mode the superadmin can edit text and photos and take a guide down. Taking down asks "Take this guide down as a platform
  administrator?" first. Publish, new location, adding or removing a step and billing are not offered, and the server refuses them if asked anyway.
- [x] Each change appears in the organisation's own change log as "changed by NERUMA support: what changed, from what into what, when".
  A superadmin sees the same log.
- [x] An organisation owner or admin can't open another organisation, and a signed-out person can't open any (as for the admin pages today).

## Not in scope
- A separate "take down now" button on the admin pages; the workspace is where it happens.
- A second administrator approving a change first.
- An email to the organisation when it changes (the change log is how they find out).
- Restoring a change from the log: it is a list.
- Deleting an organisation or its account: that stays on the Account deletions page.
- Adding or removing steps. Owner, 2026-10-26: NERUMA can't see what is in the building and can't validate it, so what a guide contains stays the organisation's responsibility; a superadmin only corrects or removes what is there.

## Decisions
- The visit is a database row per administrator (valid eight hours), not a cookie. `private.has_role` passes an administrator only during a visit, as an
  admin (owner-only policies stay closed). Publishing and creating are refused by triggers; `save_place_draft` checks that a visit adds nothing and then sets
  a flag the insert triggers accept. Details in DECISIONS.md, "A platform administrator can correct and take down, never add or publish".
- The change log is `organization_change_log`, filled by triggers only during a visit and read through `organisation_change_log()`: the organisation sees "NERUMA
  support", an administrator sees the address. Rows keep the administrator's id until the account is deleted, then it is emptied.
- Platform administrators keep two-factor always on (DECISIONS: two-factor). The administration area already has its strip and yellow
  (`2026-10-17-admin-area-marker.md`); this builds on it.

## Result
Built on pull request #92 (migration `20261026090000_platform_admin_visit.sql`; `src/lib/platform-visit.ts`; `src/app/admin/visit-actions.ts`;
the strip in `workspace/layout.tsx`; `workspace/log/page.tsx`). Run: `npm run typecheck`, `lint`, `test:unit` (299), `test:db` (155, ten new for the visit),
`test:workspace` (75, one new scenario: visit, mark, correct, take down, leave, the owner's change log, and 320px), and the browser specs `platform`,
`privacy-security`, `demo-workspace`, `guide-example`, `hostile-text`, `top-bar` (105). Not run: a visit on production, and a check by a person on a phone.
RO and DE wording in `platform-visit.ts` and `superadmin.ts` is a draft that needs a native speaker.
Two things change for everyone: an administrator can no longer read an organisation's drafts without a visit, and the migration must be installed
before the app that calls it (the Visit button and the change-log link stay hidden until `platform_visit_schema_version()` answers).
