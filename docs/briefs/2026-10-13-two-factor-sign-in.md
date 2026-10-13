---
status: building   # idea → building → done
date: 2026-10-13
---

# Two-factor sign-in for owners and admins

## Idea
Organisation owners, organisation admins and platform administrators confirm each sign-in with a 6-digit code from an
authenticator app, on top of their password. It becomes required for everyone in those roles: platform administrators
from the day it ships, organisation owners and admins after 30 days' notice. (TECH-TASKS §13, step 2.)

## Why
Payments are coming (TECH-TASKS §8). A leaked password alone must not be enough to reach billing, an organisation's
data, or NERUMA's own data.

Required rather than optional, following common practice (Microsoft 365, GitHub, Google Workspace): a notice period,
then sign-in leads straight to setup and can't be skipped. Nobody is locked out on the deadline.

## Done when
On a phone first:

- [x] On the account page, an owner scans a QR code with an authenticator app, types the 6-digit code, and two-factor
      is on.
- [x] At the next sign-in, after the password, it asks for the code. A wrong code gets a clear message, and the
      workspace stays closed.
- [x] Someone who knows the password but not the code can't open the workspace, publish, unpublish or reach the
      admin area. This is checked in the database, not only on the page.
- [x] Before the deadline, an organisation owner or admin without two-factor sees a banner with the date. After it,
      sign-in leads straight to setup. A platform administrator without it is sent to setup from day one.
- [x] If someone loses their phone, a platform administrator can switch off their two-factor after checking who they
      are. Those steps are written down.
- [x] An end-to-end test goes through the whole path as a person would: set up two-factor, sign out, sign in with the
      code, check that a wrong code is refused, and check that the workspace stays closed without the code. It runs
      in CI.
- [ ] When entering the code, an organisation owner or admin can tick *Remember this device for 30 days*. On that
      device, the next sign-ins within 30 days ask only for the password. On the account page they can see their
      remembered devices and forget them; changing the password or an administrator's reset forgets them all.
- [x] When two-factor is set up, the person is shown 10 backup codes once, with a prompt to save them. At sign-in,
      *Use a backup code* lets them in without the phone; each code works once. They can make a new set on the
      account page, which cancels the old one. The administrator's reset stays for when the codes are lost too.
- [ ] All new text is in EN, RO and DE. *(Done for PR 1; repeat for PRs 2 and 3.)*

## Not in scope
- Text-message (SMS) codes.
- Passkeys and fingerprint/face sign-in. These could come later.
- Visitors: they have no accounts.

## Decisions
- **Deadline is one setting**, so it can move (for example to match the payments launch). Platform administrators:
  required from the day this ships. Organisation owners and admins: 30 days after it ships.
- Supabase Auth MFA with TOTP (authenticator app). No new dependency.
- The database enforces it: row policies and the publishing functions check the session's assurance level (`aal2`)
  for anyone who has enrolled, and for everyone in those roles once their deadline has passed. The page checks are
  only for showing the right screen.
- **Remember this device** (owner, 2026-10-13). Supabase has no such option, so it is ours: a random token in a
  secure, `httpOnly` cookie on the device, stored only as a hash with an expiry of 30 days. After a password sign-in,
  the server checks the token through a database function that marks that one session as trusted; the policies
  accept `aal2` *or* a trusted session. A stolen cookie alone is useless without the password. Platform
  administrators are always asked for the code, because their accounts can approve organisations (owner agreed).
- **Backup codes are Supabase's own** (owner, 2026-10-13, PR 2). supabase-js 2.117 has recovery codes behind
  `auth.experimental.recoveryCodes`: ten single-use codes, a lock after repeated wrong tries, a new set cancels the old
  one, and a correct code moves the session to `aal2`, so the database rule from PR 1 needs no change. Chosen over our own
  codes, which would have added hashing, attempt limits and a trusted-session exception to the rule every permission goes
  through. Risk: it is experimental and Supabase's docs don't describe it yet; if the hosted project has it switched off,
  every backup-code control stays hidden and a lost phone goes through the administrator reset. Making a new set asks
  "are you sure?" first (it can't be undone; `DECISIONS.md`).
- The test fixture (`scripts/workspace-fixture.mjs`) fakes the MFA endpoints, so `test:workspace` and the e2e test
  run without a real Supabase. Codes are computed with `scripts/fixture-totp.mjs` (Node's crypto, no dependency).
- One function, `private.second_factor_ok()`, is added to `has_role` and `is_platform_admin`, through which every policy
  and RPC already goes, and to `submit_problem_report`, which checks membership directly. Roles other than owner and
  admin (the unused editor, assessor, reviewer) are not required to use two-factor.
- When setup is required, the account page shows only the setup: until then the database hides the person's
  organisation, so the rest of the page would wrongly offer to apply for one.
- Install order: the app first, then the migration. The other way round, platform administrators would be asked for a
  code by a site that can't set one up yet.

## Result
**PR 1** (setup, code at sign-in, database rule, deadline and banner, reset steps, end-to-end test):
migration `20261014090000_two_factor.sql`; `/[locale]/login/verify`; setup on the account page; banner in the workspace;
`docs/guides/TWO-FACTOR.md`. Ran: typecheck, lint, `test:unit` (92), `test:db` (100, 7 new), `test:workspace` (51,
3 new), `tests/platform.spec.ts` (39). Not run: the other browser specs (CI runs them). Not yet done: installing the
migration on the hosted projects.

**PR 2** (backup codes, Supabase's recovery codes): shown after setup with a download, *Use a backup code instead* on the
code step, count and a new set on the account page. Ran: typecheck, lint, `test:unit` (94), `test:workspace` (52, 1 new),
`test:db` (100, unchanged rule). Not yet known: whether the hosted projects have recovery codes switched on.

**PR 3** remember this device: to do.
