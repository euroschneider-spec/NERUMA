---
status: done   # idea → building → done
date: 2026-10-26
---

# Real photos in the examples

## Idea
Replace the example pictures with real, safe-to-use photographs of city buildings. The owner supplied four Unsplash photos; two are usable now
(the Bibliotheca entrance and the red brick LIBRARY sign). They replace `entrance.jpg` (example guide step 1 and demo workspace step 1) and
`facade.jpg` (the Explore example card).

## Why
The examples are the first thing a visitor and a new organisation sees; real photographs show what a guide looks like. The files must be ones
we may use.

## Done when
- [x] The example guide, the demo workspace and the Explore example card show the new photos, with alt text and a rights line in EN, RO and DE.
- [x] `docs/guides/PHOTO-CREDITS.md` lists every photo with where it came from and why we may use it.
- [x] The Garden Pavilion photo is replaced (a curved blue glass building; the place is described as a small glass pavilion).
- [ ] The drawings are replaced: the interactive gallery and collection steps now have photos (the new wing and the original building, seen from outside); the other two (reception, quiet room) wait for interior photos (ledger T-018).

## Not in scope
- The Vienna Parliament photo (Unsplash+ watermark: a paid preview) and the spiral staircase photo (an artwork is its subject).
- The drawings in `public/illustrations/`.
- The "photographed on" date, `demoEntrancePhotoDate`, still reads 2026-09-01: the real date of the Unsplash photo is not known.

## Decisions
- The portrait originals (2:3) were cropped to 3:2 so the existing frames (Explore card, step photo, dashboard card) show the sign and the entrance.
- The rights line now says the photo is from Unsplash; the pavilion keeps "supplied by the project owner".
- Photographer and page link of the two photos are not recorded; to add when the owner has them.

## Result
Pull requests #95 (entrance photo and Explore card), #96 (Garden Pavilion photo), #97 (step 1 and pavilion text), #98 (home page preview card) and #99 (collection and
interactive gallery steps, with the lookup of photos by step number).

On the live site now: step 1 entrance, step 3 porch, step 4 new wing, the Explore card, the Garden Pavilion and the home preview card show photos. Steps 2 (reception) and
5 (quiet room) still show drawings; that part moved to ledger T-018 (interior photos). Every description stays at 220 characters or fewer (read-aloud limit, `GOTCHA.md`).

Sources and licence: `docs/guides/PHOTO-CREDITS.md`. All five photos are Unsplash downloads by the owner; Unsplash asks for no credit, so none is shown
(`DECISIONS.md`, 2026-10-27). Not recorded: photographers and page links.

Run on each pull request: typecheck, lint, `test:unit`, the matching browser specs, and CI (`test:db`, `test:workspace`, four browser shards) all green before merging.
Not done: the photo date (`demoEntrancePhotoDate`) is still the old 2026-09-01.
