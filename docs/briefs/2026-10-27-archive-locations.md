---
status: done   # idea → building → done
date: 2026-10-27
---

# Archive a location

## Idea
An owner or admin can put a location away from the dashboard (archive it) and bring it back later. Archiving a published
location takes its guide offline.

## Why
Organisations need to get rid of cards they no longer use (a closed exhibition, a test location) without losing the text and photos,
and without a printed QR code leading to a stale guide.

## Done when
- [x] Each card has **Archive**; it asks first, and says plainly when the guide will go offline.
- [x] An archived location leaves the dashboard, is offline (address and QR code say "unavailable"), is not in Explore, and can't be
      edited or published.
- [x] The dashboard has an **Archived locations** list with **Restore**; a restored location is a draft and can be published again at the same address.
- [x] Only owners and admins; never a platform administrator on a visit. The database enforces it, including a direct write to the status.
- [x] English, Romanian and German; keyboard and screen-reader friendly.

## Not in scope
- **Deleting for good.** It needs a way to remove the photo files, a decision about problem reports that name the location, and a QR code
  that then leads nowhere. Proposed as the next step: delete only from the archive, named confirmation, owners only.
- Archiving on the demo workspace.
- Archiving a whole organisation (a platform administrator's business, see account deletion).

## Decisions
Confirmed by the owner (2026-10-27):
- A published location can be archived directly, with a clear warning; the guide goes offline.
- The organisation restores its own archived locations. A restored location comes back as a draft.

## Result
Migration `20261027110000_archive_places.sql` (`archive_place`, `restore_place`, a guard on the status column), `src/lib/archive-places.ts`,
`src/components/archive-controls.tsx`, `archivePlace`/`restorePlace` in `src/app/workspace/actions.ts`.
- Run: `test:db` (new checks), `test:workspace` (workspace group: archive, offline, read-only, restore, republish, axe), `test:unit`, `typecheck`, `lint`.
- Not run: the migration against a real Supabase project (apply it by hand, then `npm run test:smoke`); the Romanian and German words need a native speaker.
