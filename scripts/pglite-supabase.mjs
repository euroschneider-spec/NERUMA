// A Postgres that looks enough like Supabase to run this project's real migrations: the roles, an `auth` schema with
// `auth.uid()` / `auth.jwt()` and a minimal `auth.users` / `auth.mfa_factors`, and a `storage` schema. Nothing is faked
// about the project's own tables, policies or functions. Shared by the database tests (scripts/test-database.mjs), the
// fake Supabase behind `npm run dev:mock` and `test:workspace` (scripts/workspace-fixture.mjs), and the synthetic data checks.
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Set on every database made here. Code that must never touch a real database (the synthetic data) checks for it.
export const testDatabase = Symbol.for('vianorae.in-memory-test-database');

export async function createSupabaseLikeDatabase() {
  const db = new PGlite();
  db[testDatabase] = true;
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now(),is_anonymous boolean not null default false,email text default 'fixture@example.test',encrypted_password text,banned_until timestamptz,created_at timestamptz not null default now(),last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),friendly_name text,factor_type text not null default 'totp',status text not null default 'unverified',secret text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated;
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on storage.objects to authenticated,service_role;grant select on storage.objects to anon;
grant all on storage.buckets to service_role;`);
  const migrations = (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
  assert.equal(new Set(migrations.map((file) => file.split('_')[0])).size, migrations.length, 'migration timestamps must be unique');
  for (const file of migrations) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  return db;
}
