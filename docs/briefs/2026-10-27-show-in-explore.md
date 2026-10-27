---
status: idea   # idea → building → done
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
- [ ] A platform administrator opens an organisation, switches "Explore" on, and a note appears in that organisation's change log.
      The owner then sees a **Show in Explore** switch on each location, already on.
- [ ] That owner turns a location off: it disappears from Explore, while its QR code and guide address still work. Turning it on
      brings it back.
- [ ] An organisation without the feature has no switch and none of its places is in Explore, published or not. Switching the
      feature off removes the switch and the places from Explore at once, and writes a change-log note.
- [ ] All of it reads right in English, Romanian and German, and on a phone.

## Not in scope
- Plans, prices, Stripe, or setting the feature from a subscription.
- A "Featured" flag or any ranking in Explore.
- Visit counts or statistics.
- The fictional Willow example, which stays in Explore as it is.
- Telling an organisation by email that the feature was switched on.

## Decisions
Confirmed by the owner unless marked proposed:
- The flag belongs to the **organisation** (off by default); the switch belongs to each **location** (on by default once the
  feature is on). *Proposed, waiting for the owner:* the location's choice is kept when the feature is switched off, so switching
  it back on restores it.
- **The feature starts off for every organisation.** No real organisation is live yet, so nothing disappears from Explore when this
  ships (owner, 2026-10-27).
- The platform administrator's switch is on the **Accounts side**, next to the existing *Visit* button for an organisation, so it
  is found where organisations are already managed.
- Only a platform administrator can change the flag, only with two-factor, as for the other administrator actions. Owners and admins
  can change the location switch, as for publishing.
- The database decides what Explore lists (flag on, location switch on, guide published); the page never filters on its own. Fail closed.
- The change log is the existing one, which shows what NERUMA support changed and never names the administrator. The
  owner's own use of the switch is not listed there.

## Result
Filled in at the end.
