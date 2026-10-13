---
status: done   # idea → building → done (the migration still has to be installed on dev and production)
date: 2026-10-13
---

# Publishing a guide, with its QR code

## Idea
An organisation presses *Publish* and its guide is live: a public address, a QR code made in the same step, and a
place in Explore. Later changes stay a draft until they publish again. They can take the guide down themselves, and
the printed QR code then says "This guide isn't available right now" until they publish again.

## Why
It is the reason organisations come to NERUMA (`DECISIONS.md`, Context): without publishing, nothing reaches a
visitor. The QR rules are already fixed (`DECISIONS.md`, "QR codes"); this brief is the rest.

## Owner's decisions (2026-10-13)
- **Live straight away.** No NERUMA review before a guide goes public. Organisations are checked when they register,
  and publishing is one confirm step that shows the responsibility text. NERUMA can still take a guide down.
- **All complete languages at once.** One *Publish* button. Every language whose steps all have a name and a
  description goes live together; a language still missing text waits, and the confirm step says which.
- **In Explore automatically**, with its city and type.
- **Organisations can unpublish**, with "are you sure?". The QR code keeps working and shows the notice.

## Done when
Checked with `npm run dev:mock` as `owner2@example.test` (Willow Museum), on a phone first, then at 1280px.

- [ ] A saved location with at least 3 steps has an active *Publish*. It asks first: which languages go live, which
      wait (and why), and the responsibility text. Unsaved changes: *Publish* asks to save first.
- [ ] After publishing, the card says *Published*, has a **QR code and link** (a short random code, `/q/k7f3qz2m`),
      and the guide opens at `/<lang>/places/<address>/guide` for anyone, signed in or not, with its photos.
- [ ] The QR code opens the guide in the visitor's phone language when it is published, otherwise in a published one,
      with the language switch.
- [ ] Editing after publishing changes nothing public. The card says *Unsaved for visitors: publish to update*
      (*Needs attention*), and *Publish* again updates every complete language.
- [ ] *Unpublish* asks first. The guide address and the QR code then show "This guide isn't available right now",
      never the location's name. Publishing again makes both work, with the same code.
- [ ] Published locations appear in Explore; unpublished ones disappear from it.
- [ ] Only an owner or admin can publish or unpublish (the database refuses anyone else, not just the page).
- [ ] A visitor can never read a draft: not its words, not its photos, not that it exists by name.
- [ ] EN, RO and DE everywhere; axe passes on the new pages in dark, light and high contrast.

## Not in scope
- Visit counts (privacy decision first, `TECH-TASKS.md`).
- NERUMA's own "take down" button in the admin area (the database allows it for a platform admin; the page later).
- Choosing the address by hand, or changing it after the first publish.
- Visitors reporting a wrong guide to the organisation.
- Scheduling, version history pages, comparing versions.

## Decisions (technical, agreed before building)
- **The address** (`willow-museum-cluj`) is made from the location's name and city the first time it is published,
  with diacritics turned into plain letters and `-2`, `-3` added on a clash. It never changes after that, even after a
  rename, so links people saved keep working. Until then the internal `place-<id>` value is never shown.
- **A language that was published but is now incomplete** keeps its last published version live and the confirm step
  says "Română: stays on the previous version, 1 step has no text". A visitor never loses a guide because someone added
  a step in another language.
- **Publishing needs the saved version.** The page sends the revision it shows; if someone saved since, nothing is
  published and the editor says so (the same conflict rule as saving).
- **The responsibility statement version** is stored with every published version (`guide_versions`), next to who
  published it and when.

### Technical design
1. **Migration `20261013090000_publishing.sql`**, additive:
   - `places.published_revision` (the saved revision that is live) and `places.slug` set at first publish.
   - `qr_redirects`: one row per place (`unique(place_id)`), `guide_id` no longer required, `created_at`.
   - `guide_versions.responsibility_version`.
   - `public.publish_place(org, place, expected_revision, responsibility_version)` and
     `public.unpublish_place(org, place)`: invoker functions (RLS and the existing `protect_publish` trigger still
     apply: owner or admin only). Publish builds each complete language's snapshot from the saved rows (texts,
     levels, photos with their alt text in that language, own fields, hidden fields, step order and "may skip"),
     inserts it into `guide_versions`, points the guide at it, creates the place's QR code if it has none, and sets
     the place to published. It returns which languages went live and which waited.
   - Visitors read through `security definer` functions that return only published data:
     `public.published_guide(slug, locale)`, `public.published_places(locale)` (Explore) and
     `public.resolve_qr(code)` (returns the address and published languages, or only "unavailable").
   - Photos: a storage read policy for `anon` on objects that a current published version references, so the public
     photo route needs no service key.
   - `public.publishing_schema_version()` so the page hides *Publish* until the migration exists, like the fields.
2. **Server**: `publishPlace` and `unpublishPlace` server actions (`src/app/workspace/actions.ts`) with the usual
   `getUser()` and role checks, then `revalidatePath` for Explore and the guide.
3. **Public pages**: `/[locale]/places/[slug]/guide` keeps the example static and renders a published guide for any
   other address through the same `GuestGuide` component (it gains photos, own fields and "may skip");
   `/[locale]/guide-unavailable` for the notice. `/q/[code]` and `/api/qr/[code]` look codes up instead of the fixed
   list. A new `/api/guide-photos` route serves published photos.
4. **Workspace**: the dashboard card gets the real status, QR code and the *publish to update* attention; the editor's
   *Publish* opens the confirm step; *Unpublish* sits under the editor's actions once published.
5. **Tests**: `test:db` for every permission and visibility rule above; unit tests for the address maker and the
   language check; `test:workspace` for the whole flow against the fixture (publish, open as a visitor, QR, edit,
   unpublish, notice, publish again); browser specs for the public pages.

## Result
Built on branch `feat/publishing`.

**What changed.** Migration `20261013090000_publishing.sql`: `places.published_revision`, one `qr_redirects` row per place
(unique, no longer tied to a language, never updated), `publication_check`, `publish_place`, `unpublish_place`, a trigger that
freezes an address once made and keeps publication fields to owners and admins, and the visitor functions `published_guide`,
`published_places`, `resolve_qr` (security definer, snapshots only) plus a storage policy for published photos. App: the publish
confirm step (`publish-dialog.tsx`), *Unpublish*, real QR and "changes not yet published" on the cards, `/q/[code]` and
`/api/qr/[code]` looking codes up (one code, phone language chosen by `Accept-Language`), `/[locale]/places/[slug]/guide` for
published addresses through the same `GuestGuide` (photos, own fields, "may skip"), `guide-unavailable`, `/api/guide-photos`, and
published guides in Explore. The seed's example place no longer holds the address `willow-museum`.

**Ran.** typecheck, lint, 80 unit tests (13 new), `test:db` 93 (12 new, covering every permission and visibility rule in
"Done when"), `test:workspace` 48 (6 new: the whole flow including a visitor with a Romanian phone, the QR code, editing after
publishing, unpublishing and the notice, axe on the published guide in three themes), all 93 browser tests.

**Not done / left.**
- The migration is not installed on the dev or production projects (steps are in `TECH-TASKS.md`, the friend's job, and below).
- Visit counts, NERUMA's own take-down button, choosing the address by hand, and *Plan & billing* gating are later work.
- A published guide's own sensory-measurement, certificates and "verified on site" labels don't exist yet.
- Pre-existing and unchanged: the example guide still says "fictional" in its own copy.
