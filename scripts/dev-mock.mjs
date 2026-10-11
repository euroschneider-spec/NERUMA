// Browse the site locally with ready-made users and no real database.
//
// Starts the test fixture (a fake Supabase backed by the real migrations, in memory) and `next dev` wired
// to it. Everything resets when you stop it. No remote project is contacted.
//
// Sign in at /en/login. One shared password for every mock user: see FIXTURE_PASSWORD in
// scripts/workspace-fixture.mjs (test-only, never used in a real environment).
//   owner3@example.test  platform administrator (lands on the organisation review queue)
//   owner1@example.test  owner of "Fixture museum 1" (approved organisation)
//   owner2@example.test  owner of "Fixture museum 2" (approved organisation)
//   owner4@example.test  signed-in user with no organisation (can apply)
//   owner5@example.test  signed-in user with no organisation (can apply)
import { spawn } from 'node:child_process';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  throw new Error('dev:mock is for local use only.');
}

const port = process.env.DEV_MOCK_PORT || '3000';
const env = {
  ...process.env,
  VIANORAE_TEST_FIXTURE: '1',
  VIANORAE_SUPABASE_PROJECT_REF: 'vianorae-fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://vianorae-fixture.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  VIANORAE_WORKSPACE_ENABLED: '1',
  VIANORAE_SITE_URL: `http://localhost:${port}`,
};
const children = [];

function run(args, extra = {}) {
  const child = spawn(process.execPath, args, { env: { ...env, ...extra }, stdio: 'inherit' });
  children.push(child);
  return child;
}

function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });

const fixture = run(['scripts/workspace-fixture.mjs']);
fixture.on('exit', (code) => { console.error(`The fixture stopped (${code}).`); stop(); process.exit(code || 1); });

for (let attempt = 0; attempt < 120; attempt++) {
  try {
    if ((await fetch('http://127.0.0.1:3012/health')).ok) break;
  } catch {
    // Not up yet.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const next = run(
  ['node_modules/next/dist/bin/next', 'dev', '--port', port],
  { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ${process.cwd()}/scripts/workspace-fixture-fetch.mjs` },
);
next.on('exit', (code) => { stop(); process.exit(code || 0); });

console.log(`\nMock site: http://localhost:${port}/en/login  (stop with Ctrl+C; data resets each run)`);
console.log('Users: owner3@example.test is the platform administrator; owner1 and owner2 own approved organisations.');
