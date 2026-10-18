---
status: done
date: 2026-10-18
---

# Change the password while signed in

## Idea
A signed-in person can change their password from the account page, without asking for an email.

## Why
Today the only way is "Forgot your password?", which needs a working email. A person who simply wants a new password should not have to wait for one
(`TECH-TASKS.md` §4).

## Done when
- [x] The account page has *Change your password*: current password, new password twice (12 to 128 characters), in English, Romanian and German.
- [x] A wrong current password changes nothing. An account with two-factor also gives its 6-digit code.
- [x] The person stays signed in; every other device is signed out and remembered devices are forgotten.

## Not in scope
- A "your password was changed" notice email (needs the other emails first).

## Decisions
- The current password is checked with a sign-in that keeps nothing, so the person's own session and its two-factor level are untouched (a normal sign-in
  would drop it to the first level and a wrong code would then send them to the code page).
- Same rules and wording as the reset (`src/lib/password-reset.ts`).

## Result
Built on top of the password reset. Tests: `test:workspace` (wrong current password, mismatch, too short, same password, success, other device signed out,
old password refused, the two-factor code, Romanian and German with the accessibility checks), `test:unit`. Not proven: the real Supabase (hand test in `TEST-PLAN.md` A12).
