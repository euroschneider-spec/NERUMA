// Checks the synthetic data (scripts/synthetic-data.mjs): it loads into a real Postgres with the real migrations, covers every
// state the brief promises, is entirely fictional, and loads the same way twice. `npm run test:data`.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { createSupabaseLikeDatabase } from './pglite-supabase.mjs';
import { loadFixtureBase } from './fixture-base.mjs';
import { loadSyntheticData, people } from './synthetic-data.mjs';
import { showcase } from './synthetic-data/content.mjs';

let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const personId = (email) => id(people.find((entry) => entry.email === email).n);

async function world(options = {}) {
  const db = await createSupabaseLikeDatabase();
  await loadFixtureBase(db, { demo: true });
  const loaded = await loadSyntheticData(db, options);
  return { db, ...loaded };
}
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const one = async (db, sql, params = []) => (await rows(db, sql, params))[0];
const asVisitor = async (db) => { await db.exec('reset role;set role anon;'); await db.query("select set_config('request.jwt.claim.sub','',false)"); await db.query("select set_config('request.jwt.claims','',false)"); };
const asSystem = (db) => db.exec('reset role');

const { db, photos, summary } = await world();
const byKey = Object.fromEntries(summary.places.map((place) => [place.key, place]));

await check('it loads into the real migrations, and loading leaves the database as the system (no role left over)', async () => {
  assert.equal(summary.places.length, 9 + showcase.length);
  assert.equal((await one(db, 'select current_user u')).u !== 'authenticated', true);
});

await check('everything is fictional: every email ends @example.test, every name says so, no real address or link appears anywhere', async () => {
  for (const row of await rows(db, 'select email from auth.users')) assert.match(row.email, /@example\.test$/, row.email);
  for (const row of await rows(db, 'select name from public.organizations')) assert.match(row.name, /\(fictional\)|\(fiktiv\)|FICTIONAL DEMO|^Fixture museum \d$/, row.name);
  for (const row of await rows(db, 'select name from public.place_translations')) assert.match(row.name, /\(fictional\)|\(fiktiv\)|\(fictiv\)|Willow/i, row.name);
  const text = [
    ...await rows(db, "select name||' '||coalesce(short_description,'')||' '||coalesce(arrival_info,'') t from public.place_translations"),
    ...await rows(db, "select title||' '||coalesce(description,'')||' '||coalesce(useful_note,'') t from public.zone_translations"),
    ...await rows(db, 'select message t from public.problem_reports'),
    ...await rows(db, "select organization_name||' '||official_website||' '||representative_name||' '||authorization_description t from public.organization_applications"),
  ].map((row) => row.t).join('\n');
  for (const address of text.match(/[\w.+-]+@[\w.-]+/g) ?? []) assert.match(address, /@example\.test$/, `email-like text: ${address}`);
  for (const link of text.match(/https?:\/\/[^\s"')]+/g) ?? []) assert.match(link, /\.example\.test(\/|$)/, `link: ${link}`);
});

await check('every person exists, is unique, and has the state their note says', async () => {
  const everyone = people.filter((entry) => !entry.volume);
  assert.equal(new Set(everyone.map((entry) => entry.email)).size, everyone.length);
  assert.equal(new Set(everyone.map((entry) => entry.n)).size, everyone.length);
  for (const entry of everyone) {
    const user = await one(db, 'select email_confirmed_at from auth.users where id=$1', [id(entry.n)]);
    assert.ok(user, entry.email);
    assert.equal(user.email_confirmed_at === null, entry.confirmed === false, `${entry.email}: confirmed`);
  }
  assert.equal((await one(db, 'select count(*)::int n from private.platform_admins')).n, 2, 'two platform administrators');
  for (const email of ['admin.second@example.test', 'owner.cluj@example.test']) assert.equal((await one(db, "select count(*)::int n from auth.mfa_factors where user_id=$1 and status='verified'", [personId(email)])).n, 1, `${email} has two-factor`);
  assert.equal((await one(db, 'select count(*)::int n from auth.mfa_factors where user_id=$1', [personId('owner.kunsthaus@example.test')])).n, 0, 'other owners have none');
});

await check('organisations: approved, suspended, and requests pending, asked for information and rejected', async () => {
  const states = Object.fromEntries((await rows(db, 'select approval_status s, count(*)::int n from public.organizations group by 1')).map((row) => [row.s, row.n]));
  assert.ok(states.approved >= 8, JSON.stringify(states));
  assert.equal(states.suspended, 1);
  const applications = Object.fromEntries((await rows(db, 'select status s, count(*)::int n from public.organization_applications group by 1')).map((row) => [row.s, row.n]));
  assert.deepEqual(applications, { pending: 1, needs_information: 1, rejected: 1 });
  assert.equal((await one(db, 'select count(*)::int n from public.organization_review_events')).n, 2, 'the two decisions are in the history');
  assert.equal((await one(db, "select count(*)::int n from public.organization_members where role='admin'")).n, 1, 'an organisation admin who is not an owner');
});

await check('places are published in 3, 2 and 1 languages; one language waits; two are drafts', async () => {
  assert.deepEqual(byKey.cluj.live, ['en', 'ro', 'de']);
  assert.deepEqual(byKey.kunsthaus.live, ['de']);
  assert.deepEqual(byKey.hotel.live, ['en', 'ro']);
  assert.deepEqual(byKey.hotel.waiting, ['de'], 'the German guide has two steps, too short to publish');
  for (const key of ['long-name', 'pavilion']) assert.deepEqual(byKey[key].live, [], key);
  // Harbour Lights is still "published" as a place: it is its organisation that is suspended. Only the railway museum is down.
  assert.equal((await one(db, "select count(*)::int n from public.places where status='published'")).n, 6 + showcase.length);
  assert.equal(byKey.railway.live.length, 1, 'the railway guide was live before it was taken down');
});

await check('a place edited after publishing keeps its live version and asks to publish again', async () => {
  const mill = await one(db, 'select revision, published_revision from public.places where id=$1', [byKey.mill.place]);
  assert.ok(Number(mill.revision) > Number(mill.published_revision), JSON.stringify(mill));
  await asVisitor(db);
  const live = await one(db, 'select public.published_guide($1,$2) g', [byKey.mill.slug, 'en']);
  assert.equal(live.g.content.zones[0].title, 'Mill entrance', 'visitors still see the first version');
  await asSystem(db);
  assert.equal((await one(db, "select title from public.zone_translations zt join public.zones z on z.id=zt.zone_id where z.place_id=$1 and zt.locale='en' order by z.sort_order limit 1", [byKey.mill.place])).title, 'Mill entrance (now with a ramp)');
});

await check('a guide that was taken down, and one from a suspended organisation, say "unavailable" at their QR codes and show no name', async () => {
  await asVisitor(db);
  for (const key of ['railway', 'harbour']) {
    assert.deepEqual((await one(db, 'select public.resolve_qr($1) r', [byKey[key].code])).r, { status: 'unavailable' }, key);
    assert.deepEqual((await one(db, 'select public.published_guide($1,$2) g', [byKey[key].slug, 'en'])).g, { status: 'unavailable' }, key);
  }
  const listed = (await one(db, 'select public.published_places($1) l', ['en'])).l.map((place) => place.slug);
  assert.ok(!listed.includes(byKey.railway.slug) && !listed.includes(byKey.harbour.slug));
  await asSystem(db);
});

await check('a visitor finds the published places in Explore, each in their language when it exists, and no draft', async () => {
  await asVisitor(db);
  const english = (await one(db, 'select public.published_places($1) l', ['en'])).l;
  const romanian = (await one(db, 'select public.published_places($1) l', ['ro'])).l;
  await asSystem(db);
  assert.deepEqual(english.map((place) => place.slug).sort(), [byKey.cluj, byKey.kunsthaus, byKey['place-des-arts'], byKey.mill, ...showcase.filter(([key]) => key !== 'berlin-concerts').map(([key]) => byKey[key])].map((place) => place.slug).sort(), 'Explore lists the organisations it is switched on for, minus the location its owner hid; the hotel is published but not listed');
  const countries = new Set(english.map((place) => place.countryCode));
  assert.deepEqual([...countries].sort(), ['AT', 'CA', 'CH', 'DE', 'RO'], 'Explore can filter by five countries');
  assert.deepEqual([...new Set(english.map((place) => place.placeType))].sort(), ['cultural', 'hotel', 'institution', 'museum', 'other', 'public_service'], 'and by every kind of place')
  assert.equal(romanian.find((place) => place.slug === byKey.cluj.slug).name, 'Muzeul de Artă Vizuală Cluj (fictiv)');
  assert.equal(english.find((place) => place.slug === byKey.kunsthaus.slug).locale, 'de', 'a German-only guide is offered in German');
  assert.ok(!english.some((place) => /^place-/.test(place.slug)), 'no draft placeholder address is listed');
});

await check('a name starting "Place" still gets an address a visitor can open', async () => {
  assert.match(byKey['place-des-arts'].slug, /^the-place-des-arts/);
  await asVisitor(db);
  assert.equal((await one(db, 'select public.published_guide($1,$2) g', [byKey['place-des-arts'].slug, 'en'])).g.status, 'published');
  assert.equal((await one(db, 'select public.resolve_qr($1) r', [byKey['place-des-arts'].code])).r.status, 'published');
  await asSystem(db);
});

await check('the edge content is there: a very long name with Ș, ö, ß, quotation marks and a tick, close to the limit', async () => {
  const name = (await one(db, "select name from public.place_translations where place_id=$1 and locale='en'", [byKey['long-name'].place])).name;
  assert.ok(name.length >= 120 && name.length <= 160, `${name.length} characters`);
  for (const mark of ['Ș', 'ö', 'ß', '„', '”', '✓', '&']) assert.ok(name.includes(mark), mark);
});

await check('the full example has eight steps in three languages, own fields, a removed field, and four photos', async () => {
  const place = byKey.cluj.place;
  assert.equal((await one(db, "select count(*)::int n from public.zones where place_id=$1 and status<>'archived'", [place])).n, 8);
  for (const locale of ['en', 'ro', 'de']) assert.equal((await one(db, 'select count(*)::int n from public.zone_translations where place_id=$1 and locale=$2', [place, locale])).n, 8, locale);
  assert.equal((await one(db, 'select count(*)::int n from public.zone_fields where place_id=$1', [place])).n, 2, 'two own fields on one step');
  // The workshop step removed its note: the text is kept in the draft, and visitors don't get it.
  await asVisitor(db);
  const live = (await one(db, 'select public.published_guide($1,$2) g', [byKey.cluj.slug, 'en'])).g.content.zones;
  await asSystem(db);
  assert.equal(live[4].note, '');
  assert.ok(live[0].note.length > 10);
  assert.equal(photos.size, 4);
  assert.equal((await one(db, "select count(*)::int n from storage.objects where bucket_id='vianorae-private-photos'")).n, 4);
  const media = await rows(db, 'select alt_text from public.media_assets where place_id=$1 and active', [place]);
  assert.equal(media.length, 3, 'three pictures in the example');
  for (const row of media) assert.deepEqual(Object.keys(row.alt_text).sort(), ['de', 'en', 'ro'], 'a description of each picture in each language');
});

await check('the generated pictures are real WebP images of a sensible size', async () => {
  for (const [key, bytes] of photos) {
    assert.match(key, /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 1200);
    assert.ok(bytes.length > 1000 && bytes.length < 300000, `${bytes.length} bytes`);
  }
});

await check('problem reports: two open, one closed by the second administrator', async () => {
  const reports = await rows(db, 'select status, closed_by from public.problem_reports order by created_at');
  assert.equal(reports.length, 3);
  assert.deepEqual(reports.map((report) => report.status).sort(), ['closed', 'open', 'open']);
  assert.equal(reports.find((report) => report.status === 'closed').closed_by, personId('admin.second@example.test'));
});

await check('the QR code of every published place is its own, short and never reused', async () => {
  const codes = summary.places.map((place) => place.code).filter(Boolean);
  assert.equal(codes.length, 7 + showcase.length, 'every place that was published has one, including the two taken down');
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[0-9a-f]{8}$/);
});

await check('loading it twice gives the same world (names, addresses, steps, languages, counts)', async () => {
  const fingerprint = async (database) => JSON.stringify({
    orgs: await rows(database, 'select name, approval_status from public.organizations order by name'),
    places: await rows(database, 'select slug, status, city, place_type from public.places order by slug'),
    names: await rows(database, 'select locale, name from public.place_translations order by locale, name'),
    steps: await rows(database, 'select locale, title, description from public.zone_translations order by locale, title, description'),
    guides: await rows(database, 'select locale, status, current_version from public.guides order by locale, status, current_version'),
    counts: await rows(database, "select (select count(*) from public.zones)::int zones, (select count(*) from public.media_assets)::int media, (select count(*) from public.guide_versions)::int versions, (select count(*) from public.problem_reports)::int reports, (select count(*) from auth.users)::int users"),
  });
  const again = await world();
  assert.equal(await fingerprint(again.db), await fingerprint(db));
  await again.db.close();
});

await check('the loader refuses any database that was not made for tests', async () => {
  await assert.rejects(() => loadSyntheticData(new PGlite()), /only into the in-memory test database/);
  await assert.rejects(() => loadSyntheticData(null), /only into the in-memory test database/);
  await assert.rejects(() => loadSyntheticData({ query: async () => ({ rows: [] }), exec: async () => {} }), /only into the in-memory test database/);
});

await db.close();

// The volume option: one owner of 55 organisations (the app lists 50) and an organisation with a hundred and five places.
const volumeStart = Date.now();
const volume = await world({ volume: true });
await check('volume: one owner has 55 organisations, which the app cannot all list, and one organisation has 105 places', async () => {
  const large = personId('owner.large@example.test');
  assert.equal((await one(volume.db, 'select count(*)::int n from public.organization_members where user_id=$1', [large])).n, 55);
  assert.ok((await one(volume.db, "select count(*)::int n from public.organizations where approval_status='approved'")).n > 60);
  assert.equal((await one(volume.db, "select count(*)::int n from public.places where organization_id=$1", [id(116)])).n, 105);
  assert.equal((await one(volume.db, "select count(*)::int n from public.places where organization_id=$1 and status='published'", [id(116)])).n, 84, 'every fifth is a draft');
  // What the app asks for (src/lib/viewer-server.ts): the first fifty approved organisations. The 51st to 55th are not shown.
  await volume.db.exec('reset role;set role authenticated;');
  await volume.db.query("select set_config('request.jwt.claim.sub',$1,false)", [large]);
  await volume.db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: large, aal: 'aal2', session_id: large })]);
  const listed = await rows(volume.db, "select id from public.organizations where approval_status='approved' order by created_at limit 50");
  const mine = await rows(volume.db, 'select organization_id from public.organization_members where user_id=$1 limit 50', [large]);
  await asSystem(volume.db);
  assert.equal(listed.length, 50);
  assert.ok(mine.length === 50, 'the membership query is capped too');
  assert.ok(Date.now() - volumeStart < 120000, 'it loads in under two minutes');
});
await check('volume: Explore lists every published place for a visitor', async () => {
  await asVisitor(volume.db);
  const list = (await one(volume.db, 'select public.published_places($1) l', ['en'])).l;
  await asSystem(volume.db);
  assert.ok(list.length >= 89, `${list.length} places`);
});
await volume.db.close();

console.log(`\n${checks} synthetic data checks passed (real migrations, in-memory PostgreSQL; nothing real touched).`);
