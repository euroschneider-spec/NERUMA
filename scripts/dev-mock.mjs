// Browse the site locally with ready-made users and no real database.
//
// Starts the test fixture (a fake Supabase backed by the real migrations, in memory) and `next dev` wired
// to it. Everything resets when you stop it. No remote project is contacted.
//
// Sign in at /en/login. One shared password for every mock user: see FIXTURE_PASSWORD in
// scripts/workspace-fixture.mjs (test-only, never used in a real environment). Every person, with the state they are in, is
// listed when it starts and in docs/guides/TESTING.md. The data is synthetic and fictional (scripts/synthetic-data.mjs).
//   DEV_MOCK_VOLUME=1 npm run dev:mock   adds 54 organisations for one owner and an organisation with 105 places
//   node scripts/fixture-totp.mjs [owner]   prints the current two-factor code (administrators, or owner.cluj)
import { spawn } from 'node:child_process';
import { people } from './synthetic-data.mjs';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  throw new Error('dev:mock is for local use only.');
}

const port = process.env.DEV_MOCK_PORT || '3000';
const env = {
  ...process.env,
  VIANORAE_TEST_FIXTURE: '1',
  VIANORAE_FIXTURE_DEMO_DATA: '1',
  VIANORAE_FIXTURE_VOLUME: process.env.DEV_MOCK_VOLUME === '1' ? '1' : '',
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
const base = [
  ['owner3@example.test', 'Platform administrator, with two-factor set up (one request waits in the queue)'],
  ['owner1@example.test', 'Owner of "Fixture museum 1", an empty organisation (to try creating a first location)'],
  ['owner2@example.test', 'Owner of the fictional Willow Museum (five steps, from supabase/seed.sql)'],
  ['owner4@example.test', 'Signed in, no organisation yet (can apply)'],
  ['owner5@example.test', 'The applicant behind the waiting Linden Gallery request'],
];
const volume = process.env.DEV_MOCK_VOLUME === '1';
console.log('\nWho is who (shared password: FIXTURE_PASSWORD in scripts/workspace-fixture.mjs):');
for (const [email, note] of [...base, ...people.filter((entry) => volume || !entry.volume).map((entry) => [entry.email, entry.note])]) console.log(`  ${email.padEnd(36)} ${note}`);
console.log('\nTwo-factor code: node scripts/fixture-totp.mjs for the administrators, node scripts/fixture-totp.mjs owner for owner.cluj');
