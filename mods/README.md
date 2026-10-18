# Mods

Tooling for working on this repo with Claude Code. It is not part of the NERUMA product. Brief: `docs/briefs/2026-10-18-mods-ledger-helpers.md`.

| Mod | What it is | How you use it |
|---|---|---|
| **ledger** | Your task list across chats. Lives in `docs/ledger/LEDGER.md`. | Say "do the next task" in a fresh chat. Or type `/ledger` (next tasks), `/ledger add <title> \| <context>`, `/ledger done <id> \| <what was done>`. |
| **helpers** | Three assistants on cheaper models. Claude hands them bulk work. | You do nothing: Claude chooses them, or say "use the scout / runner / translator". |

## The helpers

| Helper | Model | Does | Never does |
|---|---|---|---|
| `scout` | Haiku | Searches the code and answers with file paths and line numbers | Changes files |
| `runner` | Haiku | Runs the checks from `docs/guides/TESTING.md`, reports only failures, restores the screenshots | Fixes anything |
| `translator` | Sonnet | Drafts RO and DE versions of English copy, marked "needs a native speaker" | Changes files |

## How the ledger works

- Each chat starts knowing the **next open task** (it is added to Claude's instructions), so one line from you is enough.
- When a task is finished, `/ledger done T-001 | what was done` moves it to *Done* and writes **which helpers ran and how many tokens the main chat used**. That is where you see the cost.
- The file is plain text. You can open and edit it by hand; keep one task per line.

## For whoever maintains them

- `ledger`: `hooks/ledger.ts` is the file format (tested in `hooks/ledger.test.ts`), `hooks/register.ts` connects it to Claude Code.
- `helpers`: one Markdown file per helper in `agents/`. Change the `model:` line to change what it runs on.
- Check: `claude plugin validate mods/<name>` and `claude plugin test mods/ledger`.
- They are listed in `.claude-plugin/marketplace.json` and switched on in `.claude/settings.json`.
