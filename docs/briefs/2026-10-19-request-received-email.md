---
status: idea   # idea → building → done
date: 2026-10-19
---

# "Request received" email

## Idea
When someone submits their organisation's request, they get an email saying we have it.

## Why
Today nothing is emailed after submitting, so the applicant is left guessing whether it arrived.
This is item 4 of "The emails we need" in `docs/planning/TECH-TASKS.md` §4. Email rules (text and links only,
in the account's language, no support address named) are in `docs/planning/DECISIONS.md`, "Emails are text and links only".

## Done when
Built one point at a time, in this order; each is ticked when it has been seen working.

- [ ] 1. After a request is submitted, an email arrives within a minute, in the language the person registered in. It says we have the request, an administrator will check it, and that the email does not approve anything.
- [ ] 2. The email goes out once only: reloading or pressing submit twice does not send a second one.
- [ ] 3. If the email can't be sent, the request is still saved and the person still sees the normal "request received" page.
- [ ] 4. It is sent only for a real submission, not for someone who has only registered.

## Not in scope
The other applicant emails (approved, more information needed, rejected), the emails to NERUMA's administrators, payment and
deletion emails, and a support mailbox. Each is its own brief.

## Decisions
- Sent by the app through Resend (the sender and verified domain already exist). Needs a Resend key set in Vercel by the owner. Free to create; Resend's plan limits to be checked in its dashboard.

## Result
Filled in at the end.
