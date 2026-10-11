---
status: building   # idea → building → done
date: 2026-10-11
---

# Fields per step: remove what you don't need, add your own

## Idea
Every step card shows the same fields today. Organisations should be able to shape each step:

- **Remove** a field they don't need (photo, useful note, what happens next, "visitors may skip") and add it back later.
- **Add their own fields**, picked from a few types: a short text ("Opening hours: 10–18") or a yes / no
  question ("Seating available? Yes").
- Choices are made **per step**: the entrance can ask "Ramp?" and the café not.
- **Always there:** the step's name, its description and the sensory profile. Visitors compare places by the
  sensory profile, so it can't be removed (`DECISIONS.md`: *Organisations shape their own steps, within limits*).

## Why
Places are different. A hotel lobby and a gallery don't need the same questions, and empty fields make the
editor long and the guide feel unfinished. Without this, organisations either leave fields blank or squeeze
information into the description, where visitors can't find it.

## Done when
Checked on the mock site, in EN, RO and DE:

- [ ] On a step, *Remove* next to "Useful note" hides it. It is gone from the step and from the preview, and
      *+ Add field* offers it again. Adding it back brings the old text back.
- [ ] *+ Add field → Short text* adds a field with a name and a value; *Yes / no* adds a question with
      *Yes · No* choices. Both are saved and shown in the preview under the step, in the order added.
- [ ] Editing in Romanian shows the same fields; their names and texts are written per language, and an empty
      one marks the step *Needs details*. A yes / no answer is the same in every language.
- [ ] The sensory profile, the step name and the description have no *Remove*.

## How it works (for the owner)
- **Removing doesn't delete.** The text is kept, hidden from visitors. Adding the field back shows it again.
  A removed photo stays attached but hidden, like removed text.
- **Which fields exist is shared by all languages**; what they say is written per language, like step names.
  Yes / no answers and photos are shared, like the sensory levels.
- **Limits** keep guides readable: up to 5 own fields per step, a name up to 80 characters, a short text up to
  500 characters.
- **Visitors** see your own fields under the step, after "What happens next": the name in bold, then the
  value. A yes / no without an answer is not shown. Read-aloud reads them too.

## Not in scope
- A photo as an own field, or several photos per step (needs its own storage change; later).
- Reordering own fields (they keep the order added; remove and add again to change it).
- Fields for the whole location, shared templates between locations, suggested field names.
- Publishing: the published guide will include the fields when publishing exists.

## Decisions
Technical, made by the builder:

- **Storage.** `zones.hidden_fields text[]` (only `photo`, `note`, `next`, `optional`; shared by all languages).
  New tables `zone_fields` (id, zone, place, organisation, `kind` in `text | yes_no`, `sort_order`,
  `answer boolean` for yes / no, `active`) and `zone_field_translations` (field, locale, `label`, `value`), with
  the same keys, row-level security, tenant and audit triggers as `zones` and `zone_translations`. A removed own
  field is set `active = false`, never deleted, like steps.
- **Saving** stays one transaction in `save_place_draft` (replaced in a new, additive migration with the same
  signature). The draft gains `hidden: string[]` and `fields: {id, kind, label, value, answer}[]` per zone; both
  are validated in the database and in `parsePlaceDraft`, and a draft without them is read as "nothing hidden,
  no own fields", so older drafts still save.
- **Loading** (`loadPlace`) reads the new columns and tables for the language being edited; a field without a
  translation in that language opens empty and the step shows *Needs details*.
- **Editor.** Each removable field gets a small *Remove* (×) by its label, with a name for screen readers
  ("Remove Useful note"). *+ Add field* at the bottom of the step lists the removed offered fields and the two
  types as visible choices (no dropdown).
- **Preview and read-aloud** render hidden fields as absent and own fields after "What happens next".
- **Safe before the migration.** `step_fields_schema_version()` answers 1 once the migration is applied. Until then
  the editor reads without the new columns and hides *Remove* and *+ Add field*, so nothing is saved into a
  database that can't keep it.
- **Tests.** `test:db`: hidden fields and own fields save, reload, stay per language, are refused over the limits
  and for another organisation. `test:workspace`: remove / add back, add text and yes / no, RO translation.

Owner's choices, 2026-10-11:

1. Removing keeps the text hidden, so it comes back when the field is added again.
2. Own field types to start with: short text and yes / no. A photo as an own field comes later.
3. Up to 5 own fields per step.
4. A yes / no question has a third answer, *Not answered*, so "unknown" never reads as "no" (like the
   sensory *Not recorded*). An unanswered question is not shown to visitors.

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
