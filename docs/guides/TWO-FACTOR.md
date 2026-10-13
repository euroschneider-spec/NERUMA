# Two-factor sign-in: resetting a lost phone, moving the date

Organisation owners, organisation admins and platform administrators confirm each sign-in with a 6-digit code from an
authenticator app. The rule lives in the database (`supabase/migrations/20261014090000_two_factor.sql`). Why it exists:
`docs/briefs/2026-10-13-two-factor-sign-in.md`.

Both tasks below are done in the Supabase project: **SQL Editor → New query**. Do them on `neruma-dev` first when
trying something out.

## Someone lost their phone

First ask whether they saved their backup codes: each one signs them in once without the phone (*Use a backup code
instead* on the code step). Once in, they can make a new set on the account page. Only when they have none left:

Resetting two-factor gives the account back to whoever controls its email and password. So check the person first.

1. **The request must come from the account's own email address.** Reply to that address, not to any other address
   the message gives, and ask them to confirm.
2. **For an organisation owner or admin**, also confirm with the organisation through a contact you found yourself (its
   official website or registry entry), as in the organisation review. A matching email domain alone isn't enough.
3. **Write down** who asked, the date, and how you checked. Keep it with your organisation review notes.

Then, in the SQL Editor (replace the email address):

```sql
-- 1. Find the account. Check that exactly one row comes back.
select id, email, last_sign_in_at from auth.users where email = 'person@example.org';
```

```sql
-- 2. Remove their authenticator app and backup codes, and sign them out on every device.
--    Paste the id from step 1 in both places.
delete from auth.mfa_factors where user_id = 'PASTE-THE-ID';
delete from auth.sessions where user_id = 'PASTE-THE-ID';
```

3. Tell them to sign in again. If two-factor is required for their account, they are taken straight to setup and scan a
   new QR code.

A platform administrator can't reset their own two-factor this way through the app; whoever has access to the Supabase
project does it.

## Moving the date for organisations

Platform administrators need two-factor from the moment the migration is installed. Organisation owners and admins
need it from one date, set to 30 days after installation. Until then they see a banner with the date in the workspace.

```sql
-- See the current date
select organisations_from from private.two_factor_policy;
```

```sql
-- Move it (example: 1 January 2027, midnight in Romania)
update private.two_factor_policy set organisations_from = '2027-01-01 00:00+02';
```

The banner and the sign-in follow the new date straight away.
