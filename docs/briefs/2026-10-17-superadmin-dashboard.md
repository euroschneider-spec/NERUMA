---
status: idea   # idea → building → done
date: 2026-10-17
---

# Superadmin dashboard

## Idea
Organisations and the platform owner sign in through the same steps (login, then two-factor). The difference is where they
land: an organisation goes to its workspace, the platform administrator ("superadmin") goes to a superadmin dashboard at
`/admin`. The dashboard is a hub with:

- **Menu + numbers**: links to Organisation requests, Problem reports and Account deletions, each with how many are waiting.
- **Accounts list**: every account, searchable.
- **Manage admins**: add and remove other platform administrators from the app.

## Why
The person who runs NERUMA has no home page today. The three admin pages are not linked to each other, accounts can't be
looked at, and a new platform administrator has to be added with SQL in the Supabase editor. (Proposed reason, to be confirmed
by the owner.)

## Done when
- [ ] Signing in as a platform administrator (same login and two-factor as everyone) opens `/admin`, not the organisation workspace.
- [ ] `/admin` shows links to the three existing admin pages, each with a count of what waits, and works on a phone.
- [ ] The accounts list can be searched by email and shows each account's state (active, deletion pending, two-factor on/off).
- [ ] A platform administrator can add or remove another one from the app; nobody can remove the last one or change their own role.
- [ ] A signed-out person, an organisation owner or admin sees nothing of `/admin` (as today for the other admin pages).

## Not in scope
- A list of organisations (not chosen for the first version).
- Visit statistics, billing, editing other people's content.

## Decisions
- Already true today: one login for everyone, and `landingPath()` in `src/lib/roles.ts` sends a platform administrator to
  `/admin/organisations`. This work changes that target to `/admin`.
- Platform administrators keep two-factor always on and never get "remember this device" (DECISIONS: two-factor).

## Result
Filled in at the end.
