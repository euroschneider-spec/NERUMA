---
status: building   # idea → building → done
date: 2026-10-13
---

# Delete my account, export my data, and hand an organisation to a colleague

## Idea
A person can delete their NERUMA account, and gets a copy of everything held about them. Deletion has a 30-day grace period,
after which **everything** about them is gone. When someone leaves an organisation (for example because they were fired), an
administrator can hand the organisation to a verified colleague, so its guides survive. (TECH-TASKS §13 step 3.)

## Why
GDPR gives people the right to have their data deleted and to receive a copy of it. Today neither is possible: an account that
has done anything can't even be deleted (`docs/guides/PERSONAL-DATA.md`, finding 1). And an organisation whose only owner
leaves is stuck, with nobody able to edit its guides.

## Done when
- [x] **The person deletes their own account** with a "Delete my account" button on the account page. They confirm with their
      password and their two-factor code. Before confirming they read the **exact date** everything will be deleted (30 days later).
- [x] **The account is locked at once**: they can't sign in, their guides go down, and everything that mentions them shows
      "deletion in progress".
- [x] **They receive their data**: everything held about them, the date they asked, what happens to each part and when, and how to
      change their mind. Photos and documents come as a private download link that works for 7 days without signing in.
      *Until the email provider exists (§4), the export is offered on screen right after confirming (owner, 2026-10-14).*
- [x] **Within 30 days an administrator can restore the account** if the person changes their mind.
- [x] **After 30 days everything is deleted**: sign-in, two-factor, remembered devices, request, documents, review history,
      acceptance record, guide versions they published, and their name in the change history. A database check proves nothing
      with their email or id is left.
- [x] **Problem reports they sent stay**, with the sender anonymised and marked "account deleted" (or "deletion in progress"
      during the 30 days). An administrator can delete them by hand.
- [x] **Their organisation**, if they were its only owner: published guides go down at once, QR codes say "unavailable", and the
      content is hidden for 30 days, in which an administrator can hand it to a colleague; then it is deleted.
- [ ] **Hand an organisation to a colleague**: the colleague registers and proves their mandate like a new request; an
      administrator checks them independently and transfers ownership; the former owner loses access at once.
- [x] **An administrator can do the same on request** (a person who writes in), after checking it is really them, with the steps
      written down.
- [ ] Texts in EN, RO and DE; the privacy page says how to ask, what is deleted and when.

## Not in scope
- Automatic emails (the export, the confirmation, a reminder 3 days before the final deletion): they need the email provider
  (TECH-TASKS §4). The administrator sends them by hand until then.

## Decisions
Owner, 2026-10-13:
- **Review history and acceptance proof are deleted too** (option B: everything goes), knowing that afterwards nothing shows the
  check ever happened.
- **Guide versions the person published are deleted even if the organisation stays** (option A): the guide goes down until a
  colleague publishes again.
- **The organisation of a sole owner is kept hidden for 30 days**, then deleted (option B), so a colleague can be given it.
- **The person's own data waits 30 days too**, locked, restorable by an administrator (option B: protects against a mistaken or
  forged request).
- **Problem reports are kept, anonymised and labelled**, and can be deleted by hand.
- **Ownership transfer is part of this work** (option A).
- **There is a self-service button**, as well as the administrator path.

Technical, to be confirmed while building:
- The final deletion after 30 days is a list of "due" deletions the administrator runs (no scheduler exists yet); a scheduled job
  can replace it later.
- Every table in `docs/guides/PERSONAL-DATA.md` gets an explicit rule (delete or anonymise), and the 15 blocking foreign keys get a
  defined behaviour. The inventory test already fails when a new personal column appears.
- Deleting requires a recent sign-in with the second factor, so a session left open can't delete an account.
- The export includes the organisation's guides and photos only when the person is its only owner.

## Result
**Step 1** (delete, export, restore, erase): migration `20261016090000_account_deletion.sql`; *Delete my account* (`/account/delete`);
*Account deletions* for administrators (`/admin/deletions`, steps in `docs/guides/ACCOUNT-DELETION.md`); reports of a deleted sender
labelled and deletable; the privacy page says how it works. Every page tells a locked account it is locked. Ran: typecheck, lint,
`test:unit` (217), `test:db` (131, 14 new, incl. a scan of every column after the erase), `test:data` (18), `test:workspace` (64,
3 new end-to-end). Not yet known: whether hosted Supabase lets the functions update and delete `auth.users` (try on `neruma-dev`).

**Step 2** hand an organisation to a colleague, **step 3** the emails: to do.
