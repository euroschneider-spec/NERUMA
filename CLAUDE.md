# Project rules for AI agents

These files are loaded into every conversation, so you start with them already read:
`AGENTS.md` (Next.js 16 differs from older versions), `GOTCHA.md` (mistakes already made here; don't
repeat them) and `docs/guides/TESTING.md` (which tests to run).

@AGENTS.md
@GOTCHA.md
@docs/guides/TESTING.md

## Briefs and decisions

Non-trivial work starts from a brief in `docs/briefs/` (template: `docs/briefs/TEMPLATE.md`; the `/brief`
command writes one). Read the brief before building, and check "Done when" before saying it is finished.
`docs/planning/DECISIONS.md` records why things are the way they are; don't re-open an entry without the
owner saying what changed. Write a new entry when the owner makes a deliberate choice.

## What the product does

`docs/PRODUCT.md` describes, functionality only, what every kind of person can do today. A change that adds, removes or alters
something a person can do updates it in the same pull request. Personal data that is stored anywhere new goes into
`docs/guides/PERSONAL-DATA.md` (the database tests enforce the column list).

## Prefer reuse over new code

Before writing anything new, in this order:

1. **Does it need to exist?** If the request can be met by changing or deleting existing code, do that.
2. **Is it already here?** Search `src/lib/` and `src/components/` for a helper, type or component that
   does the job. Examples: `uuidPattern`, `isLocale`, `isOrganisationRole`, `getViewer`,
   `verificationReady`, `approvedOrganization`, `parsePlaceDraft`. Extend it rather than copy it.
3. **Does the platform cover it?** Prefer React/Next/Supabase/standard-library features over a new
   dependency. Pinned versions in `package.json` stay pinned; adding a dependency needs a stated reason.
4. **Only then write it**, as small as the task allows. No speculative options, abstractions or
   config for cases that don't exist yet.

When you duplicate logic that already exists in two places, say so rather than adding a third copy.

## What "less code" never cuts

- Input validation, `getUser()` / approval / role checks, and fail-closed behaviour on server paths.
- Accessibility: labels, focus handling, text alternatives, contrast, reduced motion. WCAG 2.2 AA is
  the target (`docs/guides/ACCESSIBILITY.md`).
- All three languages (EN/RO/DE): every user-facing string goes through the copy dictionaries.
- Tests for behaviour you change. Keep unit tests in `tests/unit/` and e2e in `tests/*.spec.ts`.

## Style

- Match the surrounding file. Don't reformat code you aren't changing.
- New code: normal line breaks, one statement per line. Don't extend the dense one-line style that
  some older files use.
- The displayed brand is NERUMA; VIANORAE is the repository/infrastructure name (see README). Don't
  introduce a third name.

## Before you commit or open a pull request

- Run `npm run typecheck && npm run lint && npm run test:unit`, then the matching browser specs from
  `docs/guides/TESTING.md`. Before a pull request also run `npm run test:db` and `npm run test:workspace`,
  because CI runs both.
- `npm run test:workspace` leaves a build with fictitious auth settings in `.next`. Run `npm run build`
  before any Playwright spec that follows it.
- When you rename a class, id, route or visible label, search `src tests scripts` for the old name.
  The workspace suite in `scripts/` finds elements by those names too.
- The tests rewrite the images in `docs/verification/screenshots/`. Check `git status` for `.png`
  changes and restore them with `git checkout -- docs/verification/screenshots` unless the screenshots
  were meant to change.
- Never merge while a CI check is red, even if `main` was already red. Fix it in the same pull request
  and say so.
- Add a `GOTCHA.md` entry for any mistake that cost real time.

## Working rules

- Secrets live in a gitignored `.env`; never commit one or paste one into docs.
- Don't edit the generated block in `AGENTS.md`; add project rules here.
- Say plainly what you changed, what you ran, and what you did not run.
