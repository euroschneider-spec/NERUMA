// Synthetic data: a made-up but realistic world of organisations, people and places, in every state the app can be in.
//
// Everything is fictional: every organisation and place says "(fictional)" or "(fiktiv)", every address ends
// @example.test, and nothing here is, or is copied from, real data (docs/briefs/2026-10-13-synthetic-data.md).
//
// The places are created through the app's own database functions (save_place_draft, publish_place, unpublish_place,
// submit_problem_report, review_organization_application), each called as the person who would call it. So the data is valid
// by construction, and loading it is also a test of those functions. Only what the system owns is inserted directly: users,
// organisations, memberships and applications.
//
// Used by the fake Supabase behind `npm run dev:mock` (scripts/workspace-fixture.mjs) and checked by `npm run test:data`.
// It refuses anything but the in-memory test database made by scripts/pglite-supabase.mjs.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { testDatabase } from './pglite-supabase.mjs';
import { FIXTURE_ADMIN_TOTP_SECRET, FIXTURE_OWNER_TOTP_SECRET } from './fixture-totp.mjs';
import { cluj, kunsthaus, hotel, placeDesArts, longName, pavilion, harbour, railway, mill, showcase, people } from './synthetic-data/content.mjs';

export { people };
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (email) => id(people.find((entry) => entry.email === email).n);
const responsibility = '2026-10-07-v1';
const bucket = 'vianorae-private-photos';
const willow = { org: 'a0000000-0000-4000-8000-000000000001', place: 'a0000000-0000-4000-8000-000000000002' };

// The fixture's own users (owner1 to owner5, see scripts/workspace-fixture.mjs) keep their ids; owner2 owns the Willow Museum.
const owner2 = id(2);

const orgs = {
  cluj: { n: 110, name: 'Visual Arts Museum Cluj (fictional)', type: 'museum', owner: 'owner.cluj@example.test' },
  kunsthaus: { n: 111, name: 'Kunsthaus am Fluss (fictional)', type: 'museum', owner: 'owner.kunsthaus@example.test' },
  hotel: { n: 112, name: 'Hotel Lindenhof Sibiu (fictional)', type: 'hotel', owner: 'owner.hotel@example.test' },
  arts: { n: 113, name: 'Place des Arts Society (fictional)', type: 'cultural', owner: 'owner.arts@example.test' },
  harbour: { n: 114, name: 'Harbour Lights Museum (fictional)', type: 'museum', owner: 'owner.harbour@example.test' },
  railway: { n: 115, name: 'Old Railway Museum (fictional)', type: 'museum', owner: 'owner.railway@example.test' },
  showcase: { n: 117, name: 'Showcase Venues (fictional)', type: 'institution', owner: 'owner.showcase@example.test' },
  archive: { n: 116, name: 'Archive of Everything (fictional)', type: 'institution', owner: 'owner.large@example.test', volume: true },
};

// A warm, abstract picture for a step: no real photograph is needed, and none is used.
const palettes = [['#f3e3c8', '#d9a86c', '#8a5a2b'], ['#f6dfd0', '#e0907a', '#7d3b2e'], ['#e9e2c4', '#b9b56a', '#5b5a22'], ['#f2d9b8', '#e4a853', '#8c5a12']];
async function photo(index) {
  const [light, mid, dark] = palettes[index % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/><rect x="0" y="620" width="1200" height="180" fill="${dark}" opacity="0.35"/>
    <rect x="${300 + index * 40}" y="180" width="260" height="440" rx="18" fill="${dark}" opacity="0.55"/>
    <rect x="${640 + index * 20}" y="260" width="200" height="360" rx="14" fill="${dark}" opacity="0.35"/>
    <circle cx="1000" cy="170" r="70" fill="${light}" opacity="0.9"/></svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

async function actAs(db, userId, aal = 'aal2') {
  await db.exec('reset role;set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: userId, aal, session_id: userId })]);
}
async function actAsSystem(db) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.query("select set_config('request.jwt.claims','',false)");
}

/**
 * Loads the dataset into the in-memory test database, after its migrations (and, for dev:mock, after the fixture's own
 * users and the Willow Museum). Returns what the caller needs: the generated pictures, and a summary of what was made.
 */
export async function loadSyntheticData(db, { volume = false } = {}) {
  assert.equal(db?.[testDatabase], true, 'Synthetic data is loaded only into the in-memory test database made by scripts/pglite-supabase.mjs');
  const photos = new Map();
  const summary = { places: [], reports: 0, applications: [] };
  let zoneCounter = 20000;
  const hasWillow = (await db.query('select 1 from public.organizations where id=$1', [willow.org])).rows.length === 1;

  // 1. People, and the two with an authenticator app. The platform administrator needs one from the first day.
  const everyone = people.filter((entry) => volume || !entry.volume);
  for (const entry of everyone) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3) on conflict(id) do nothing', [id(entry.n), entry.email, entry.confirmed === false ? null : new Date().toISOString()]);
  }
  await db.query('insert into private.platform_admins(user_id) values($1) on conflict do nothing', [person('admin.second@example.test')]);
  for (const [user, secret] of [[person('admin.second@example.test'), FIXTURE_ADMIN_TOTP_SECRET], [person('owner.cluj@example.test'), FIXTURE_OWNER_TOTP_SECRET]]) {
    await db.query("insert into auth.mfa_factors(user_id,friendly_name,status,secret) values($1,'NERUMA','verified',$2)", [user, secret]);
  }

  // 2. Organisations and memberships.
  for (const org of Object.values(orgs).filter((entry) => volume || !entry.volume)) {
    await db.query("insert into public.organizations(id,name,approval_status) values($1,$2,$3)", [id(org.n), org.name, 'approved']);
    await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')", [id(org.n), person(org.owner)]);
  }
  if (hasWillow) await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'admin')", [willow.org, person('admin.willow@example.test')]);

  // 3. Requests that are not approved: asked for more information, and rejected. Reviewed by the second administrator.
  for (const [email, name, type, country, site, status, note] of [
    ['applicant.needsinfo@example.test', 'Brașov History Centre (fictional)', 'cultural', 'RO', 'https://history-centre.example.test', 'needs_information', 'Please send the registry extract and the name of someone who can confirm your appointment.'],
    ['applicant.rejected@example.test', 'Old Mill Craft Studio (fictional)', 'other', 'DE', 'https://craft-studio.example.test', 'rejected', 'We could not confirm that the studio exists as a legal entity.'],
  ]) {
    const applicant = person(email);
    const application = (await db.query(`insert into public.organization_applications(applicant_id,applicant_email,organization_name,organization_type,country_code,official_website,registry_reference,representative_name,representative_role,authorization_description,statement_version,statement_locale)
      values($1,$2,$3,$4,$5,$6,'FIX-REG-9','Elena Marinescu (fictional)','Director','The city cultural office can confirm the appointment of the director by phone.','2026-10-07-v1','en') returning id,revision`, [applicant, email, name, type, country, site])).rows[0];
    await actAs(db, person('admin.second@example.test'));
    await db.query('select public.review_organization_application($1,$2,$3,false,false,$4,$5,$6,$7::uuid[])', [application.id, Number(application.revision), status, '', '', note, []]);
    await actAsSystem(db);
    summary.applications.push({ email, status });
  }

  // 4. Places, through the real functions.
  const save = async (org, place, revision, locale, draft) =>
    Number((await db.query('select public.save_place_draft($1,$2,$3,$4,$5::jsonb) revision', [org, place, revision, locale, JSON.stringify(draft)])).rows[0].revision);
  let photoIndex = 0;

  async function createPlace({ key, org, owner, place, spec, publish = true, then }) {
    const zoneIds = spec.zones.map(() => id(zoneCounter++));
    const assets = spec.zones.map((zone) => (zone.photo ? id(zoneCounter++) : null));
    // An own field is the same field in every language, so its id is made once.
    const fieldIds = spec.zones.map((zone) => (zone.fields ?? []).map(() => id(zoneCounter++)));
    const keys = spec.zones.map((zone, index) => (zone.photo ? `${org}/${place}/${zoneIds[index]}/${assets[index]}.webp` : null));
    for (const photoKey of keys.filter(Boolean)) {
      photos.set(photoKey, await photo(photoIndex++));
      await db.query('insert into storage.objects(bucket_id,name) values($1,$2) on conflict do nothing', [bucket, photoKey]);
    }
    const languages = ['en', 'ro', 'de'].filter((locale) => spec[locale]);
    await actAs(db, owner);
    let revision = 0;
    for (const locale of languages) {
      const words = spec[locale];
      const steps = words.steps ?? (locale === 'en' ? spec.steps : undefined);
      assert.ok(steps, `${key}: no steps in ${locale}`);
      const draft = {
        name: words.name, city: spec.city, address: words.address ?? '', countryCode: spec.country, placeType: spec.type,
        description: words.description ?? '', arrivalInfo: words.arrivalInfo ?? '',
        zones: steps.map((step, index) => {
          const zone = spec.zones[index];
          const out = { id: zoneIds[index], title: step.title, description: step.description, note: step.note, next: step.next, type: zone.type, optional: false, sensory: zone.sensory };
          if (zone.hidden) out.hidden = zone.hidden;
          if (zone.fields) {
            out.fields = zone.fields.map((field, fieldIndex) => {
              const text = words.fields[fieldIndex];
              const fieldId = fieldIds[index][fieldIndex];
              return field.kind === 'yes_no' ? { id: fieldId, kind: 'yes_no', label: text.label, answer: field.answer } : { id: fieldId, kind: 'text', label: text.label, value: text.value };
            });
          }
          if (keys[index] && words.photoAlt?.[index]) out.photo = { id: assets[index], storageKey: keys[index], alt: words.photoAlt[index], rights: 'Own picture (fictional)', photographedOn: '2025-06-15' };
          return out;
        }),
      };
      revision = await save(org, place, revision, locale, draft);
    }
    let published = null;
    if (publish) published = (await db.query('select public.publish_place($1,$2,$3,$4) result', [org, place, revision, responsibility])).rows[0].result;
    if (then) revision = (await then({ org, place, revision, languages, zoneIds, spec, save })) ?? revision;
    await actAsSystem(db);
    summary.places.push({ key, org, place, slug: published?.slug ?? null, code: published?.code ?? null, live: published?.live ?? [], waiting: (published?.waiting ?? []).map((entry) => entry.locale), languages });
    return published;
  }

  const o = (name) => id(orgs[name].n);
  await createPlace({ key: 'cluj', org: o('cluj'), owner: person(orgs.cluj.owner), place: id(1100), spec: cluj });
  await createPlace({ key: 'kunsthaus', org: o('kunsthaus'), owner: person(orgs.kunsthaus.owner), place: id(1101), spec: kunsthaus });
  await createPlace({ key: 'hotel', org: o('hotel'), owner: person(orgs.hotel.owner), place: id(1102), spec: hotel });
  await createPlace({ key: 'place-des-arts', org: o('arts'), owner: person(orgs.arts.owner), place: id(1103), spec: placeDesArts });
  await createPlace({ key: 'long-name', org: o('arts'), owner: person(orgs.arts.owner), place: id(1104), spec: longName, publish: false });
  await createPlace({ key: 'pavilion', org: o('arts'), owner: person(orgs.arts.owner), place: id(1105), spec: pavilion, publish: false });
  await createPlace({
    key: 'mill', org: o('arts'), owner: person(orgs.arts.owner), place: id(1106), spec: mill,
    // Edited after publishing: the visitor still sees the first version, and the card asks to publish again.
    then: async ({ org, place, revision, zoneIds, save: saveAgain }) => {
      const steps = mill.steps.map((step, index) => (index === 0 ? { ...step, title: mill.editedFirstStep } : step));
      return saveAgain(org, place, revision, 'en', {
        name: mill.en.name, city: mill.city, address: mill.en.address, countryCode: mill.country, placeType: mill.type, description: mill.en.description, arrivalInfo: mill.en.arrivalInfo,
        zones: steps.map((step, index) => ({ id: zoneIds[index], title: step.title, description: step.description, note: step.note, next: step.next, type: mill.zones[index].type, optional: false, sensory: mill.zones[index].sensory })),
      });
    },
  });
  await createPlace({
    key: 'railway', org: o('railway'), owner: person(orgs.railway.owner), place: id(1107), spec: railway,
    // Taken down by its owner: the address and the QR code stay, and say the guide isn't available.
    then: async ({ org, place }) => { await db.query('select public.unpublish_place($1,$2)', [org, place]); },
  });
  for (const [index, [key, spec]] of showcase.entries()) {
    await createPlace({ key, org: o('showcase'), owner: person(orgs.showcase.owner), place: id(1200 + index), spec });
  }
  await createPlace({ key: 'harbour', org: o('harbour'), owner: person(orgs.harbour.owner), place: id(1108), spec: harbour });
  await actAsSystem(db);
  // The organisation was suspended after publishing.
  await db.query("update public.organizations set approval_status='suspended' where id=$1", [o('harbour')]);

  // 4b. Explore: the second administrator switches it on for four organisations, through the real function. The hotel, the railway
  // museum and the suspended harbour museum stay without it, so their published guides are not in Explore. The Berlin concert house
  // then hides itself, as its owner can.
  await actAs(db, person('admin.second@example.test'));
  for (const name of ['cluj', 'kunsthaus', 'arts', 'showcase']) await db.query('select public.set_organisation_explore($1,true)', [o(name)]);
  await actAs(db, person(orgs.showcase.owner));
  await db.query('select public.set_place_explore($1,$2,false)', [o('showcase'), id(1200 + showcase.findIndex(([key]) => key === 'berlin-concerts'))]);
  await actAsSystem(db);

  // 5. Problem reports: two open, one closed by the second administrator.
  const report = async (user, org, place, message, locale) => {
    await actAs(db, user);
    const reportId = (await db.query('select public.submit_problem_report($1,$2,$3,$4) id', [org, place, message, locale])).rows[0].id;
    await actAsSystem(db);
    summary.reports++;
    return reportId;
  };
  await report(person(orgs.cluj.owner), o('cluj'), null, 'The photo upload stops at 90 percent when I use my phone.', 'en');
  if (hasWillow) await report(owner2, willow.org, willow.place, 'The quiet room step lost its second paragraph after I saved twice.', 'en');
  const closed = await report(person(orgs.kunsthaus.owner), o('kunsthaus'), null, 'Die Vorschau zeigt das Foto im Ruheraum doppelt an.', 'de');
  await actAs(db, person('admin.second@example.test'));
  await db.query('select public.close_problem_report($1)', [closed]);
  await actAsSystem(db);

  // 6. Volume: one owner with 55 organisations (the app lists 50), and one organisation with a hundred and five places.
  if (volume) {
    const large = person('owner.large@example.test');
    for (let index = 1; index <= 54; index++) {
      const orgId = id(200 + index);
      await db.query("insert into public.organizations(id,name,approval_status) values($1,$2,'approved')", [orgId, `Volume organisation ${String(index).padStart(2, '0')} (fictional)`]);
      await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')", [orgId, large]);
    }
    const towns = [['Timișoara', 'RO'], ['Graz', 'AT'], ['Leipzig', 'DE'], ['Oradea', 'RO'], ['Linz', 'AT']];
    for (let index = 1; index <= 105; index++) {
      const [city, country] = towns[index % towns.length];
      const label = String(index).padStart(3, '0');
      await createPlace({
        key: `archive-${label}`, org: o('archive'), owner: large, place: id(3000 + index), publish: index % 5 !== 0,
        spec: {
          type: ['museum', 'hotel', 'cultural', 'institution', 'public_service'][index % 5], city, country,
          zones: [{ type: 'entrance', sensory: cluj.zones[0].sensory }, { type: 'collection', sensory: cluj.zones[2].sensory }, { type: 'quiet-room', sensory: cluj.zones[5].sensory }],
          en: { name: `Archive place ${label} (fictional)`, address: `Strada Arhivei ${index}`, description: 'A generated place for testing long lists.', arrivalInfo: 'Generated for the volume option.' },
          steps: [
            { title: 'Entrance', description: 'A plain entrance with an automatic door.', note: '', next: 'Walk straight ahead.' },
            { title: 'Main room', description: 'One room with even light and benches.', note: 'Staff are happy to help.', next: 'The quiet room is on the right.' },
            { title: 'Quiet room', description: 'A small room with low light.', note: '', next: 'Thank you for visiting.' },
          ],
        },
      });
    }
  }
  if (volume) {
    await actAs(db, person('admin.second@example.test'));
    await db.query('select public.set_organisation_explore($1,true)', [o('archive')]);
  }
  await actAsSystem(db);
  return { photos, summary };
}
