---
status: done   # idea → building → done
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
- [x] A saved location with **one step** (a name and a description) has an active *Publish*, and its guide goes live and opens for a visitor.
- [x] The Publish box, the dashboard card ("Needs attention") and the location editor no longer say "at least 3 steps", in English, Romanian and German.
- [x] A language goes live when it has a name and at least one step with text, even if other steps have no text in that language; those steps
      are left out of that language's guide and the Publish box says which ones.

## Not in scope
- Changing how photos work: every photo that is shown still needs its description.
- Plans, prices, or anything about Explore.
- A new rule about how many steps are too many (see the open question below).

## Decisions
Owner's answers (2026-10-27):
- The minimum drops from 3 to 1 step.
- "They don't need to have language for each card": a step may be missing in a language and the language still goes live without it
  (confirmed by the owner, 2026-10-27). The risk named: a visitor in one language can get a shorter
  guide than a visitor in another, and a step's "what comes next" text can point at a step that language doesn't show.

- **The maximum stays at 8 steps** (owner, 2026-10-27).

Where the rule lives (so it is changed everywhere, not in one place): `publication_check` in `supabase/migrations/20261013090000_publishing.sql`
(`steps between 3 and 8`, and missing text blocks a language), `parsePlaceDraft` and the editor in `src/lib/workspace.ts`, the reasons in
`src/lib/publishing.ts` (`waitFewSteps`), the dashboard's `attentionFewSteps`, `docs/PRODUCT.md`. A new migration replaces the database function.

## Result
Built in this pull request (migration `20261027120000_one_step_minimum.sql`; `src/lib/publishing.ts`, `src/lib/workspace.ts`, `src/components/publish-dialog.tsx`).

- One database definition of "this step has its words in this language" (`private.step_complete`) is used by the publish check and by what visitors are given. The check now
  reports `includedSteps`; a language is ready with a name, at least one such step, at most 8 steps in all, and descriptions only for photos on included steps.
- The stored guide's own check (`guide_versions.content`, 3 to 8 steps) is now 1 to 8: a third place the old rule lived, found by the database tests.
- A language saved in the editor always has words for every step it holds, so "left out" happens when a step is added later in another language.
- The hotel's German guide in the mock data (two of four steps) now goes live; the QR code now leads to the visitor's own language when it is published.
- Also in this pull request, on the owner's request: the Explore switch is greyed out with a tooltip, not hidden (see `2026-10-27-show-in-explore.md`).
- Run: `typecheck`, `lint`, `test:unit`, `test:db` (new checks), `test:data`, `test:workspace`, and the `platform`, `demo-workspace`, `guide-example`, `hostile-text` and `privacy-security` specs.
- Not run: the migration against a real Supabase project (apply by hand, then `npm run test:smoke`). The Romanian and German words need a native speaker.
