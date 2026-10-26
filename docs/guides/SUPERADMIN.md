# Adding a superadmin (while the site can't send email)

A superadmin (in the app: *platform administrator*, menu item **Administrators**) manages NERUMA and every account. It is not an
organisation admin. A superadmin is someone you add to the list in the app. The person needs a **confirmed account** first.
Confirmation normally arrives by email, so until email is set up (`docs/planning/TECH-TASKS.md`), create the account
yourself in Supabase and confirm it there.

Do it on `neruma-dev` first if you are trying it out. Production is `neruma-prod`.

## 1. Create the account (Supabase)

1. Open the Supabase dashboard and choose the project.
2. **Authentication → Users → Add user → Create new user.**
3. Type the person's email and a password. Give them the password in person or over a channel you trust, and tell them to change
   it on the account page after the first sign-in.
4. Leave **Auto Confirm User** ticked. This is the step that replaces the confirmation email.
5. Click **Create user**. The new row shows a confirmed date.

## 2. Make them a superadmin (the app)

1. Sign in at `https://neruma.eu/en/login` as an existing superadmin (email, password, then the 6-digit code).
2. Open **Administrators** in the menu (`/en/admin/administrators`).
3. Type the new person's email and click **Add administrator**.
4. The message says "Added." and they appear in the list. "There is no confirmed account with that email" means step 1 is
   missing, or the email is spelled differently.

## 3. The new superadmin signs in

1. They sign in at the same login page with the email and the password from step 1.
2. They are sent straight to setting up two-factor, which is **required** for superadmins. They scan the QR code with an
   authenticator app, enter the 6-digit code, and **save the backup codes**.
3. They land on the administration dashboard (`/en/admin`).

## Removing a superadmin

**Administrators** in the menu, then **Remove** next to the person (you confirm in a dialog). They keep their account. Nobody can remove themselves, so the last administrator can't be removed.
See `docs/planning/DECISIONS.md` (superadmin).

## If the app can't be used (nobody can sign in as a superadmin)

Add the first superadmin in the SQL Editor. Replace the email address in the single statement below, then run it:

```sql
insert into private.platform_admins(user_id)
select id from auth.users where lower(email) = lower('someone@example.com') and email_confirmed_at is not null;
```

The person still has to set up two-factor on first sign-in.
