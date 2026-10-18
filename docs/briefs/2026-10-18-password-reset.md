---
status: done   # idea → building → done
date: 2026-10-18
---

# Password reset, and the sign-in emails in the new look

## Idea
A person who forgot their password clicks *Forgot your password?* on the sign-in page, enters their email, receives an email with a link, and chooses a new
password. The confirmation email and the new reset email use the new text-only look, in English, Romanian and German, and say where to write for help
(`support@lignorae.com`, owner, 2026-10-18).

## Why
There is no way to reset or change a password anywhere in the app today, and Supabase's default recovery email (English only, unstyled) is what would arrive.
Needed before real organisations sign in (TECH-TASKS §4 and §18).

## Done when
- [x] The sign-in page has *Forgot your password?*. The reset page asks for an email and always answers the same way, whether or not an account exists.
- [x] The email arrives in the account's registration language (English when unknown), is text and links only, shows the link written out, and names `support@lignorae.com`.
- [x] The link opens a page with one button; only the button uses the one-time link, so a mail program that opens links to check them can't use it up.
- [x] The new-password page needs the new password twice (12 to 128 characters). An account with two-factor also needs its 6-digit code first.
- [x] After saving, the person is signed out everywhere, remembered devices are forgotten, and sign-in says the password was changed. The old password no longer works.
- [x] A used or expired link says so and offers a new one. The page can't be reached without a reset link.
- [x] The confirmation email is restyled the same way (no more green), still in three languages.

## Not in scope
- Changing the password from the account page while signed in (not asked for yet; TECH-TASKS).
- The "your password was changed" security notice email (a later item, §4).
- Reset by a platform administrator, and a lost two-factor phone (still the written procedure, `docs/guides/TWO-FACTOR.md`).
- A reply-to header on Supabase's emails (Supabase doesn't offer one): the address is written in the text instead.

## Decisions
- **The link goes to our own site, not through supabase.co.** The email template builds it from the site address and the token (`{{ .SiteURL }}/<language>/login/reset/continue?token_hash=…`);
  the page shows a button; the button's action checks the token (`verifyOtp`, type recovery). Reason: a plain link is used up by mail scanners, and it works when the
  email is opened on a different device than the one that asked (the code-exchange link needs the same browser).
- **Two-factor stays required.** Supabase refuses a password change from a session without the second factor when the account has one, so the new-password page asks
  for the code first. Email alone never takes over an account with two-factor.
- **No account enumeration.** The request page answers identically for unknown addresses and for errors; only a rate limit says so.
- **A short-lived cookie `neruma_reset`** (httpOnly, 15 minutes) says "this session came from a reset link", so the new-password page can't be used by a normal
  signed-in session without the current password. Listed on the privacy page like the other cookie.
- **The language of the email is the language chosen at registration** (`preferred_locale`); accounts without one get English. The pages after the link follow the address.

## Result
`src/app/auth/password-actions.ts` (ask for a link, use it, save the password), `src/lib/password-reset.ts` (the rules and the texts in three languages), the three pages
under `src/app/[locale]/login/reset/` and `account/password/`, `src/components/password-reset-forms.tsx`, the cookie in `src/lib/password-reset-server.ts` (listed on the
privacy page), *Forgot your password?* and the "password was changed" notice on the sign-in page, `verifyTotp` shared with the sign-in code step, and
`supabase/templates/recovery.html` plus the restyled `confirmation.html` and the settings file that is pasted into the dashboard.

Ran: typecheck, lint, unit (269: new `password-reset.test.ts`, the email template tests rewritten for both emails, the storage disclosure), `test:workspace` (70: two new checks,
the whole reset against the fixture's Auth service with and without two-factor, and the pages in all three languages with automated accessibility checks).

**Not proven by the machines, needs a try on the real site** (`docs/guides/TEST-PLAN.md` A12): the email link and template variables on the real Supabase, the real two-factor
rule, opening the link on another device. **The templates must be pasted into Supabase** (*Authentication → Emails → Templates*), and the Site URL must be
`https://neruma.lignorae.com` (*URL Configuration*). Until the new recovery template is pasted, Supabase sends its English default, whose link does not work with this flow.
