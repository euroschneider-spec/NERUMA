---
status: idea   # idea → building → done
date: 2026-10-27
---

# A guide needs one step, not three

## Idea
A location can be published with as few as **one step**. The minimum of 3 steps goes away. A language does not need text on every
step to go live. Nothing in the building's size or layout is assumed.

## Why
We don't know what kind of building organisations have. A small shop, a clinic room or a single hall may have one or two places
worth describing, and the rule "at least 3 steps" stops them from publishing at all. The owner's words (2026-10-27): "we don't know
what kind of building they have, so we shouldn't have a limitation at the moment."
This changes "at least 3 steps to publish" from `docs/briefs/2026-10-13-publishing.md` and the *Publishing* section of `docs/PRODUCT.md`.

## Done when
- [ ] A saved location with **one step** (a name and a description) has an active *Publish*, and its guide goes live and opens for a visitor.
- [ ] The Publish box, the dashboard card ("Needs attention") and the location editor no longer say "at least 3 steps", in English, Romanian and German.
- [ ] A language goes live when it has a name and at least one step with text, even if other steps have no text in that language; those steps
      are left out of that language's guide and the Publish box says which ones.

## Not in scope
- Changing how photos work: every photo that is shown still needs its description.
- Plans, prices, or anything about Explore.
- A new rule about how many steps are too many (see the open question below).

## Decisions
Owner's answers (2026-10-27):
- The minimum drops from 3 to 1 step.
- "They don't need to have language for each card": my reading is that a step may be missing in a language and the language still goes
  live without it (what I called option A). **To confirm with the owner.** The risk I named: a visitor in one language can get a shorter
  guide than a visitor in another, and a step's "what comes next" text can point at a step that language doesn't show.

Open, for the owner:
- **The maximum of 8 steps.** "No limitation at the moment" may also mean removing the maximum. Today the editor, the database and the
  publish check all stop at 8. Options: keep 8, raise it, or remove it.

Where the rule lives (so it is changed everywhere, not in one place): `publication_check` in `supabase/migrations/20261013090000_publishing.sql`
(`steps between 3 and 8`, and missing text blocks a language), `parsePlaceDraft` and the editor in `src/lib/workspace.ts`, the reasons in
`src/lib/publishing.ts` (`waitFewSteps`), the dashboard's `attentionFewSteps`, `docs/PRODUCT.md`. A new migration replaces the database function.

## Result
Filled in at the end.
