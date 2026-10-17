---
status: done   # idea → building → done
date: 2026-10-17
---

# Account profile page (superadmin)

## Idea
A platform administrator opens a person from the Accounts list and sees that account's profile: email, when it was created and last
signed in, whether the email is confirmed, administrator or not, two-factor on or off, the organisations the person belongs to with
their role and the organisation's status, their organisation request and its status, and whether a deletion is in progress (when it
was asked for, by whom, and when it is due). The page says "You are viewing this account as a platform administrator."

## Why
The Accounts list shows one line per person. An administrator who gets a question ("I can't sign in", "my organisation isn't visible")
needs the whole picture of one account in one place, without reading the database. (TECH-TASKS §14, item 1; owner, 2026-10-17.)

## Done when
- [x] Each email in the Accounts list opens that account's profile (`/admin/accounts/<id>`), on a phone as well as a desktop.
- [x] The profile shows the details above, in English, Romanian and German, and the line "You are viewing this account as a platform administrator."
- [x] An unknown or malformed id is a plain 404; a signed-out person, an organisation owner or admin sees nothing of it.
- [x] The page is read only: no button changes anything.

## Not in scope
- Actions on the page (reset two-factor, start or restore a deletion): those stay where they are. Owner chose read only, 2026-10-17.
- A record of who looked at which profile: owner chose not yet, 2026-10-17. The page shows what the Accounts list and the other
  administration pages already show an administrator.
- A list of organisations; the history of who added administrators.

## Decisions
- One new function, `public.admin_account(p_user)`, in an additive migration (`20261017120000_account_profile.sql`) with its own
  `account_profile_schema_version()`. The superadmin migration is already installed in production and is not edited.
- No new stored data, so nothing new in `docs/guides/PERSONAL-DATA.md` beyond saying administrators see this page.

## Result
Built on the pull request for this branch. `src/app/[locale]/admin/accounts/[id]/page.tsx` (reached from the email in the Accounts list), `public.admin_account(p_user)`
in `supabase/migrations/20261017120000_account_profile.sql` with `account_profile_schema_version()`, `parseProfile` and the copy in `src/lib/superadmin.ts`.
**The migration must be installed in the VIANORAE project's SQL editor, after the superadmin one; until then the page says the tools are being activated.**

Ran: typecheck, lint, unit (227), `test:db` (136, two new checks), `test:workspace` (66, one new check: open from the list, who is viewing, read
only, accessibility scan, 404 for a malformed or unknown id and for an organisation applicant). Not run: `test:data`, the browser specs.
