---
status: idea   # idea → building → done
date: 2026-10-18
---

# Mods: a task ledger and cheaper helpers

## Idea
Tooling for working on this repo with Claude Code (not part of the NERUMA product), built as mods:

- A **ledger**: a task list and handoff notes that live in the repo, so a fresh chat can pick up the next small task without being re-explained. It is also the place mods leave tasks, findings and costs for each other.
- **Helpers**: subagents on cheaper models for bulk work: a *scout* (read-only search of the code), a *runner* (runs the test suites from `docs/guides/TESTING.md` and reports only what failed) and a *translator* (drafts RO/DE copy, flagged for native review).

Later, not now: a guard (rules from `CLAUDE.md` and `GOTCHA.md` checked on tool calls), a reviewer, design checks.

## Why
The owner works alone and feels overwhelmed by handling tokens, quality and design at once. To save tokens they start new chats more often and work in the smallest steps possible, so the work has to be tracked outside any one chat. Without it, every new chat starts by re-explaining, and plain jobs (test runs, searches) use the most expensive model.

## Done when
- [ ] In a fresh chat, one line from the owner ("do the quick wins") is enough: Claude reads the ledger, finds the next small task and its context, and starts without being re-explained.
- [ ] At the end of a chat the ledger says what was done, what is left and what it cost, so the next chat starts from there.
- [ ] A plain job (running the tests, searching the code) is handed to a cheaper model, and the ledger shows which model did it.

## Not in scope
- The guard, reviewer and design mods: they come after the ledger and helpers prove useful.
- Changes to the NERUMA app, and new rules in `CLAUDE.md` beyond a short pointer to the ledger.
- Switching the model of the main chat automatically; only the helpers use cheaper models.
- Anything that runs by itself in the background (scheduled jobs); the ledger is read and updated when a chat starts or ends.
- Sharing with other people or other repos.

## Decisions
Choices made while building, with the reason. Copy the lasting ones into `docs/planning/DECISIONS.md`.

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
