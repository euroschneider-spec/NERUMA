# Database environments

Two hosted Supabase projects, so a migration is tried somewhere that doesn't matter before it reaches the one that does.
Why: `docs/planning/DECISIONS.md`, "A dev database and a production database".

| | Name | Region | Reference | Gets migrations by | Who uses it |
|---|---|---|---|---|---|
| Dev | `neruma-dev` | Central EU (Frankfurt) | `yfwpywjkztfuwiehyysg` | `npx supabase db push` | Developing and trying things, never real organisations |
| Production (today) | `neruma-prod` | West EU (Ireland) | `ywbcsvswisorlgajbkev` | Pasting each file into the SQL Editor, in order | The live site. **Planned to move to Frankfurt**, see `docs/planning/TECH-TASKS.md` |

Two more kinds of "database" exist and are separate: the in-memory fixture behind `npm run test:workspace` and
`npm run dev:mock`, and the isolated PostgreSQL behind `npm run test:db`. They need no account. Use them for
every code change; use the dev project to check against a real Supabase.

## Rules

1. **Never run `supabase link` or `db push` against production.** Its first migrations were pasted in by hand, so it has
   no installation history, and `db push` would try to run everything again. Production gets migrations by
   pasting the files into the SQL Editor, oldest first, each once.
2. **Every new migration goes to dev first**, and is checked there, before anyone installs it on production.
3. **Secrets stay local.** The dev database password and reference live in `.env.dev` (gitignored, mode 600). Never
   put them in a commit, an issue or a pull request. Keys shown in the Supabase dashboard stay in the dashboard
   and in Vercel's settings.
4. Dev holds **fictional data only**, with `@example.test` addresses where an address is needed.

## One-time setup on a computer

1. Sign in (opens a browser page; click **Authorize**, no token to create):

```bash
npx supabase login
```

2. Connect this folder to the **dev** project. It asks for the database password; copy it from `SUPABASE_DEV_DB_PASSWORD`
   in `.env.dev`. The link is stored in `supabase/.temp/`, which Git ignores.

```bash
npx supabase link --project-ref yfwpywjkztfuwiehyysg
```

3. Install every migration, oldest first. Answer **y** when it lists them:

```bash
npx supabase db push
```

4. Check in the dev project's **SQL Editor** (expect `1 | 1`; later migrations add their own version checks):

```sql
select public.step_fields_schema_version(), public.problem_reports_schema_version();
```

5. To sign in to the app against dev, make a git-ignored `.env.local` with the dev project's values from
   **Project Settings → API**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `VIANORAE_SUPABASE_PROJECT_REF` and `VIANORAE_WORKSPACE_ENABLED=1` (names as in `.env.example`). Then
   `npm run dev`. The first platform administrator has to be added by hand, as `docs/architecture/DATABASE.md` says
   for `platform_admins`.

## Adding a migration

1. Create the file. The command names it with the current time, which is the order migrations run in:

```bash
npx supabase migration new what_it_does
```

2. Write the SQL (additive only, with the `STOP` guard at the top like the existing files), then run
   `npm run test:db` and the tests that touch the change (`docs/guides/TESTING.md`).
3. Install it on **dev**:

```bash
npx supabase db push
```

4. Try the feature against dev, then write the check query into the pull request description.
5. After the pull request is merged, install the same file on **production** by pasting it into the SQL Editor.
   Add a line to the "job for the owner's friend" list in `docs/planning/TECH-TASKS.md` until that is done. The
   app hides the controls for a missing migration instead of failing.

## Things to know

- **Free plan:** two active projects at most, and a project that sees no activity for a week is paused. If dev
  stops answering, open it in the dashboard and press **Restore**. A paused project loses nothing.
- **Project settings:** dev was created with *Data API* on, *Automatically expose new tables* on and *Automatic RLS*
  on. Turning the second off is a possible hardening, to be tried on dev first (`TECH-TASKS.md`).
- **Region:** a project's region can't be changed after creation; moving production means a new project.
- **Resetting dev:** no one-button reset exists on a hosted project. To start empty, create a new project and push
  again, or delete rows in the SQL Editor.
