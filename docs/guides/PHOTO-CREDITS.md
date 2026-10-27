# Photo credits

Where each photograph on the site comes from and what lets us use it. Check a photo's licence on its own page before adding it;
a search result is not proof. Add a row in the same pull request that adds a photo.

## Where the pictures came from

The owner downloaded the example photos from **Unsplash** (unsplash.com) with a free account, on 2026-10-26 and 2026-10-27. The photographers'
names and the photo page links were not written down at the time, so they are not recorded here (see "Still to fill in").

Unsplash's own licence (https://unsplash.com/license), as read on 2026-10-26:

- Free for commercial and non-commercial use, with no permission needed.
- **Credit is not required** (it is appreciated). See Unsplash's help page, "Do I have to give credit to a contributor when I use their image?"
  (https://help.unsplash.com/en/articles/2612337-do-i-have-to-give-credit-to-a-contributor-when-i-use-their-image).
- It does **not** cover trademarks, logos or brands in a photo, recognisable people, or works of art shown in a photo.
- We may not sell a photo as it is, or use Unsplash photos to build a service that competes with Unsplash.
- **Unsplash+** photos are a paid product with a different licence. Their previews carry an "Unsplash+" watermark. We use none of them.

**Decision (owner, 2026-10-27):** because the licence asks for no credit, the site shows none. The visitor-facing rights line says the photo is from
Unsplash (entrance, facade) or is a free-to-use stock photo (the others). If a photo ever comes from a source that does require credit, show the credit
next to the photo and record it here. Photos the owner takes (ledger T-018) need no licence check.

Read the current licence text again before relying on this for a legal question; it can change.

## Rules we follow

- Free to use without credit (Unsplash licence, CC0, public domain), or our own, or supplied by someone who may give it.
- Not the paid Unsplash+ previews (they carry a watermark), and not "CC BY-SA" or "GFDL" files, which force terms on what we build.
- The photo must not show a recognisable person, a logo or brand, or an artwork as its subject: those are not covered by the licence.
- Exteriors, not museum interiors (artworks inside have their own copyright).
- Metadata (EXIF, location) is stripped before the file is added.
- Every photo is cropped to 3:2 (1200 x 800), which is the frame the site uses.

## Photos on the site

| File | Used for | Source | Licence | Photographer | Checked |
|---|---|---|---|---|---|
| `public/photos/entrance.jpg` | Step 1 of the example guide and of Willow Museum in the demo workspace, and the home page preview card | Unsplash (page link not recorded) | Unsplash licence | not recorded | 2026-10-26 |
| `public/photos/facade.jpg` | The example card in Explore | Unsplash (page link not recorded) | Unsplash licence | not recorded | 2026-10-26 |
| `public/photos/hall.jpg` | Step 3 (the collection gallery) of the example guide and of Willow Museum in the demo workspace, shown from outside as the original building | Unsplash, per the owner (page link not recorded) | Unsplash licence | not recorded | 2026-10-27 |
| `public/photos/wing.jpg` | Step 4 (the interactive gallery) of the example guide and of Willow Museum in the demo workspace, shown from outside as the new wing | Unsplash, per the owner (page link not recorded) | Unsplash licence | not recorded | 2026-10-27 |
| `public/photos/pavilion.jpg` | Garden Pavilion in the demo workspace, step 1 and its dashboard card | Unsplash, per the owner (page link not recorded) | Unsplash licence | not recorded | 2026-10-27 |

The entrance crop leaves out a person walking in front of the door.

## Supplied but not used

- A photo of the Austrian Parliament: an Unsplash+ preview with a watermark. Not licensed for use.
- A photo of a spiral staircase in a courtyard: the staircase is an artwork, which the Unsplash licence does not cover.
- A black and white photo of a curved tower: no step fits it.

## Still showing drawings

Step 2 (reception) and step 5 (quiet room) of the example guide and of Willow Museum still show the site's own drawings in `public/illustrations/`.
They stand for interior spaces and wait for interior photos (ledger T-018).

## Still to fill in

- The Unsplash page link and the photographer's name for each photo above. Credit is not required, but the link proves where the file came from if anyone asks.
- The "photographed on" date in the example guide (`demoEntrancePhotoDate` in `src/lib/demo.ts`, 2026-09-01) belongs to an earlier photo and is not the real date of these.
