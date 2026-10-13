// The fixture's base world, in the in-memory test database: owner1 to owner5, two approved organisations, the platform
// administrator (owner3, with an authenticator app), and, for `npm run dev:mock`, the Willow Museum and one waiting request.
// Shared by the fake Supabase (scripts/workspace-fixture.mjs) and the synthetic data checks (scripts/test-synthetic-data.mjs),
// so what `dev:mock` shows and what `test:data` checks are the same thing.
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { FIXTURE_ADMIN_TOTP_SECRET } from './fixture-totp.mjs';

export const fixtureId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const fixtureEmail = (n) => `owner${n}@example.test`;

/**
 * @param demo adds the browsing data: owner2 owns the fictional Willow Museum (five steps, from supabase/seed.sql) and
 * owner5 has a request waiting for review, with a document. Returns the files (by storage key) that go with it.
 */
export async function loadFixtureBase(db, { demo = false } = {}) {
  const files = new Map();
  for (let n = 1; n <= 2; n++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [fixtureId(n), fixtureEmail(n)]);
    await db.query("insert into public.organizations(id,name,approval_status) values($1,$2,'approved')", [fixtureId(100 + n), `Fixture museum ${n}`]);
    await db.query('insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)', [fixtureId(100 + n), fixtureId(n), 'owner']);
  }
  for (let n = 3; n <= 5; n++) await db.query('insert into auth.users(id,email) values($1,$2)', [fixtureId(n), fixtureEmail(n)]);
  await db.query('insert into private.platform_admins(user_id) values($1)', [fixtureId(3)]);
  // The platform administrator has an authenticator app from the start (code: node scripts/fixture-totp.mjs).
  await db.query("insert into auth.mfa_factors(user_id,friendly_name,status,secret) values($1,'NERUMA','verified',$2)", [fixtureId(3), FIXTURE_ADMIN_TOTP_SECRET]);
  if (!demo) return { files };

  const willow = 'a0000000-0000-4000-8000-000000000001';
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
  await db.query("update public.organizations set approval_status='approved' where id=$1", [willow]);
  await db.query('delete from public.organization_members where user_id=$1', [fixtureId(2)]);
  await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')", [willow, fixtureId(2)]);
  const application = (await db.query(`insert into public.organization_applications(applicant_id,applicant_email,organization_name,organization_type,country_code,official_website,registry_reference,representative_name,representative_role,authorization_description,statement_version,statement_locale)
    values($1,'owner5@example.test','Linden Gallery (fictional)','museum','RO','https://linden-gallery.example.test','RO-REG-0042','Ana Popescu (fictional)','Director','The city cultural office can confirm the director appointment by phone. A signed authorisation is attached.','2026-10-07-v1','en') returning id`, [fixtureId(5)])).rows[0].id;
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const documentId = randomUUID();
  const key = `${fixtureId(5)}/${documentId}.pdf`;
  await db.query(`insert into public.organization_evidence_documents(id,applicant_id,application_id,storage_key,filename,mime_type,byte_size,sha256,uploaded_at)
    values($1,$2,$3,$4,'signed-authorisation.pdf','application/pdf',$5,$6,now())`, [documentId, fixtureId(5), application, key, pdf.length, createHash('sha256').update(pdf).digest('hex')]);
  await db.query("insert into storage.objects(bucket_id,name) values('vianorae-mandate-evidence',$1)", [key]);
  await db.query('update public.organization_applications set evidence_document_ids=array[$1::uuid] where id=$2', [documentId, application]);
  files.set(key, pdf);
  return { files };
}
