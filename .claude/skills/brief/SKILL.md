---
name: brief
description: Interview the project owner about a new piece of work and write it up as a short brief in docs/briefs/ before anything is built. Use when the owner types /brief or describes new work without a brief.
---

# Write a brief

The owner works on ideas, not format. Your job is to ask, listen, and write it up cleanly. Rough or
half-formed answers are fine; tidy them and read them back.

1. Read `docs/planning/DECISIONS.md` and `docs/briefs/TEMPLATE.md`. Look at `docs/briefs/` for an
   existing brief on the same work; if there is one, update it instead of starting another.
2. Ask **one question at a time**, in plain language, in this order. Skip any the owner already answered.
   - What do you want? (Idea)
   - Why: who does it help, and what goes wrong without it? (Why)
   - How will we know it's done? Offer 2–3 concrete options to react to if they struggle. (Done when)
   - Is there anything we should leave out for now? (Not in scope)
3. Check the answers against `DECISIONS.md`. If one contradicts an entry, say so and ask which wins.
4. If the owner can't answer, suggest a sensible default and ask them to confirm; never invent a reason
   and present it as theirs.
5. Write `docs/briefs/YYYY-MM-DD-short-name.md` from the template with `status: idea`. Use the owner's
   meaning, not new content of your own.
6. Read the brief back in a few lines and ask for corrections. Only when the owner agrees, set
   `status: building` and say what you will do first. Do not start building before that.

Keep every question short. Don't ask about technical choices; make those yourself and record them under
"Decisions".
