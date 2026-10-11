# neruma-guard

A Claude Code mod for this repository. It adds a short rules reminder to every conversation and blocks
`git commit` and `gh pr create` until the checks in `CLAUDE.md` have run since the last code change.
It also refuses Playwright runs without `PORT=` and edits to `.env` files.

Limits: it only tracks edits made in the current session, and it cannot see staged screenshots.

## Install (once per machine, from a terminal)

```sh
claude plugin marketplace add /path/to/Vianorae-euroschneider
claude plugin install neruma-guard@neruma --scope project
```

`--scope project` records it in `.claude/settings.json`, so it loads in every session in this repository.

## Change it

Edit `hooks/register.ts`, then `claude plugin validate tools/neruma-guard` and
`claude plugin test tools/neruma-guard`. `tools/` is excluded from the app's `tsc`, because the mod's types
come from Claude Code, not from `node_modules`.
