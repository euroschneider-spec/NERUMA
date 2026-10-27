---
status: building   # idea → building → done
date: 2026-10-27
---

# Show in Explore: a feature a platform administrator hands out

## Idea
Being listed in Explore becomes something a platform administrator switches on, one organisation at a time. An organisation
without it is not in Explore. An organisation with it is listed, and its owners and admins get a **Show in Explore** switch for
each location, on by default, so they can leave. When the administrator switches the feature off again, the organisation is out of
Explore and the switch disappears from its workspace. Every on and off is written to the organisation's change log.

## Why
A hotel or a clinic may want a QR guide for its guests or patients without being listed publicly for anyone to find, and the
owner wants to decide by hand who gets the Explore listing while there is no billing plan (Stripe is waiting on email domains).
When billing exists, the same on/off flag can be set by a plan instead of by hand; nothing for that is built now.
This changes the 13 October decision "Published guides appear in Explore automatically" (`docs/planning/DECISIONS.md`): the
owner chose this on 27 October.

## Done when
- [x] A platform administrator opens an organisation, switches "Explore" on, and a note appears in that organisation's change log.
      The owner then sees a **Show in Explore** switch on each location, already on.
- [x] That owner turns a location off: it disappears from Explore, while its QR code and guide address still work. Turning it on
      brings it back.
- [x] An organisation without the feature sees the switch greyed out with a tooltip saying to contact NERUMA, and none of its places is in
      Explore, published or not. Switching the feature off greys the switch out and removes the places from Explore at once, and writes a change-log note.
- [x] All of it reads right in English, Romanian and German, and on a phone.

## Not in scope
- Plans, prices, Stripe, or setting the feature from a subscription.
- A "Featured" flag or any ranking in Explore.
- Visit counts or statistics.
- The fictional Willow example, which stays in Explore as it is.
- Telling an organisation by email that the feature was switched on.

## Decisions
Confirmed by the owner unless marked proposed:
- The flag belongs to the **organisation** (off by default); the switch belongs to each **location** (on by default once the
  feature is on). The location's choice is kept when the feature is switched off, so switching it back on restores it (owner, 2026-10-27).
- **The feature starts off for every organisation.** No real organisation is live yet, so nothing disappears from Explore when this
  ships (owner, 2026-10-27).
- Without the feature the organisation's switch is **greyed out, with a tooltip to contact NERUMA**, not hidden (owner, 2026-10-27, after the first build).
- The platform administrator's switch is on the **Accounts side**, next to the existing *Visit* button for an organisation, so it
  is found where organisations are already managed.
- Only a platform administrator can change the flag, only with two-factor, as for the other administrator actions. Owners and admins
  can change the location switch, as for publishing.
- The database decides what Explore lists (flag on, location switch on, guide published); the page never filters on its own. Fail closed.
- The change log is the existing one, which shows what NERUMA support changed and never names the administrator. The
  owner's own use of the switch is not listed there.

## Result
Built in this pull request (migration `20261027100000_explore_listing.sql`; `src/lib/explore-listing.ts`, `src/components/explore-switch.tsx`,
`explore-toggle.tsx`, `src/app/admin/explore-actions.ts`).

- The flag is `organizations.explore_listing` (off), the choice is `places.show_in_explore` (on). `published_places` lists only published places where both allow it.
- The platform administrator's switch is on the account page only, not on the Accounts list.
- Run: `typecheck`, `lint`, `test:unit`, `test:db` (new checks for who may switch what, the remembered choice and the log), `test:data`, `test:workspace` (the whole flow
  in a browser, with axe on the dashboard), `platform`, `privacy-security` and `hostile-text` specs.
- Not run: the migration against a real Supabase project (apply it by hand, then `npm run test:smoke`); the Romanian and German words need a native speaker.
