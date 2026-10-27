import { test, expect } from '@playwright/test';

// A read-only check of a DEPLOYED site (production or a Vercel preview) with no mocked data and no accounts created.
// It exists because the local suites run against a fixture and can't see the things only a real deployment gets wrong:
// settings missing in Vercel, a migration not installed, a project the site can't reach (TECH-TASKS §11, "No test runs
// against the deployed Vercel preview"; the registration form was switched off on production for exactly such a reason).
//
//   SMOKE_URL=https://neruma.eu npx playwright test tests/smoke.spec.ts
//
// Optional, and only public values: with the project's address and publishable key it also asks the database, as an
// anonymous visitor, what it will let anyone do:
//   SMOKE_SUPABASE_URL=https://<ref>.supabase.co SMOKE_SUPABASE_KEY=sb_publishable_… SMOKE_URL=… npx playwright test tests/smoke.spec.ts
const site = process.env.SMOKE_URL?.replace(/\/$/, '');
const database = process.env.SMOKE_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SMOKE_SUPABASE_KEY;

test.describe('the deployed site', () => {
  test.skip(!site, 'Set SMOKE_URL to the address of a deployed site to run these.');

  test('the public pages open in every language with no script error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const locale of ['en', 'ro', 'de']) {
      for (const path of ['', '/explore', '/privacy', '/places/willow-museum/guide']) {
        const response = await page.goto(`${site}/${locale}${path}`);
        expect(response?.status(), `${locale}${path}`).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
      }
    }
    expect(errors).toEqual([]);
  });

  test('sign-in and registration are switched on, not greyed out', async ({ page }) => {
    // The form is disabled, with no message, when the site's Supabase settings name different projects; with a message
    // ("Organisation verification is being activated") when the verification migration isn't installed.
    for (const path of ['/en/register', '/en/login']) {
      await page.goto(`${site}${path}`);
      await expect(page.getByText('is being activated', { exact: false }), path).toHaveCount(0);
      await expect(page.getByText('Registration is not active yet', { exact: false }), path).toHaveCount(0);
    }
    // Found by the words a person sees, and required to be usable: a greyed-out form fails here.
    await page.goto(`${site}/en/register`);
    await expect(page.getByLabel('Organisation name', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Password', { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Request organisation access', exact: true })).toBeEnabled();
    await page.goto(`${site}/en/login`);
    await expect(page.getByLabel('Work email', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Password', { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });

  test('the protective headers are present, and plain http is sent to https', async ({ request }) => {
    const response = await request.get(`${site}/en`);
    const headers = response.headers();
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    if (site!.startsWith('https://')) {
      const plain = await request.get(site!.replace('https://', 'http://') + '/en', { maxRedirects: 0 });
      expect([301, 302, 307, 308]).toContain(plain.status());
      expect(plain.headers()['location']).toMatch(/^https:\/\//);
    }
  });

  test('a code nobody made and a language that does not exist are plain 404s', async ({ request }) => {
    expect((await request.get(`${site}/q/nosuchcode`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get(`${site}/xx/login`)).status()).toBe(404);
    expect((await request.get(`${site}/en/places/nosuch-place/guide`)).status()).toBe(404);
  });

  test('private pages and photos refuse a signed-out visitor', async ({ request }) => {
    for (const path of ['/en/workspace', '/en/admin', '/en/admin/organisations', '/en/admin/reports', '/en/admin/accounts', '/en/admin/administrators', '/api/workspace/photos?key=x']) {
      const response = await request.get(`${site}${path}`, { maxRedirects: 0 });
      expect([307, 308, 401, 403, 404], path).toContain(response.status());
    }
  });

  test('the example guide and its QR code work', async ({ request }) => {
    const qr = await request.get(`${site}/q/willow-museum`, { maxRedirects: 0 });
    expect([307, 308]).toContain(qr.status());
    expect(qr.headers()['location']).toMatch(/\/places\/willow-museum\/guide$/);
    const svg = await request.get(`${site}/api/qr/willow-museum`);
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toContain('svg');
  });
});

test.describe('the deployed database, asked as an anonymous visitor', () => {
  test.skip(!database || !key, 'Set SMOKE_SUPABASE_URL and SMOKE_SUPABASE_KEY (the public project address and publishable key).');
  const headers = () => ({ apikey: key!, 'Content-Type': 'application/json' });

  test('the project answers, and the key belongs to it', async ({ request }) => {
    const response = await request.get(`${database}/auth/v1/health`, { headers: headers() });
    expect(response.status()).toBe(200);
  });

  test('every private table refuses an anonymous reader, or shows nothing', async ({ request }) => {
    const tables = ['organizations', 'organization_members', 'organization_applications', 'organization_review_events',
      'organization_evidence_documents', 'problem_reports', 'audit_log', 'users', 'places', 'zones', 'media_assets',
      'guide_steps', 'assessments', 'assessors', 'measurements'];
    for (const table of tables) {
      const response = await request.get(`${database}/rest/v1/${table}?select=*&limit=5`, { headers: headers() });
      if (response.status() === 200) expect(await response.json(), `${table} shows rows to anyone`).toEqual([]);
      else expect([401, 403, 404], table).toContain(response.status());
    }
  });

  test('an anonymous visitor cannot write', async ({ request }) => {
    for (const [table, body] of [['organizations', { name: 'x' }], ['places', { slug: 'x' }], ['problem_reports', { message: 'x' }]] as const) {
      const response = await request.post(`${database}/rest/v1/${table}`, { headers: headers(), data: body });
      expect([401, 403, 404], table).toContain(response.status());
    }
  });

  test('anonymous visitors cannot be platform administrators, file reports or save drafts', async ({ request }) => {
    const admin = await request.post(`${database}/rest/v1/rpc/is_platform_admin`, { headers: headers(), data: {} });
    if (admin.status() === 200) expect(await admin.json()).toBe(false);
    else expect([401, 403, 404]).toContain(admin.status());
    for (const rpc of ['submit_problem_report', 'save_place_draft', 'publish_place', 'unpublish_place', 'close_problem_report', 'review_organization_application', 'remember_device', 'forget_devices']) {
      const response = await request.post(`${database}/rest/v1/rpc/${rpc}`, { headers: headers(), data: {} });
      expect([400, 401, 403, 404], rpc).toContain(response.status());
    }
  });

  test('the private buckets are not public', async ({ request }) => {
    for (const bucket of ['vianorae-private-photos', 'vianorae-mandate-evidence']) {
      const response = await request.get(`${database}/storage/v1/object/public/${bucket}/x.webp`, { headers: headers() });
      expect(response.status(), bucket).not.toBe(200);
    }
  });

  test('the hosted sign-in settings are what the app assumes', async ({ request }) => {
    const response = await request.get(`${database}/auth/v1/settings`, { headers: headers() });
    expect(response.status()).toBe(200);
    const settings = await response.json();
    // Registration open, and email confirmation required: the database trusts a confirmed email.
    expect(settings.disable_signup).toBe(false);
    expect(settings.mailer_autoconfirm).toBe(false);
    expect(settings.external?.email).toBe(true);
    expect(settings.external?.anonymous_users ?? false).toBe(false);
    expect(settings.external?.phone ?? false).toBe(false);
  });

  test('which migrations are installed (informational: the failing line names what is missing)', async ({ request }) => {
    const installed: Record<string, boolean> = {};
    for (const rpc of ['organization_verification_schema_version', 'mandate_evidence_schema_version', 'workspace_schema_version',
      'step_fields_schema_version', 'problem_reports_schema_version', 'publishing_schema_version', 'two_factor_schema_version', 'remember_device_schema_version',
      'account_deletion_schema_version', 'superadmin_schema_version', 'account_profile_schema_version', 'payments_schema_version',
      'platform_visit_schema_version', 'explore_listing_schema_version', 'one_step_schema_version']) {
      const response = await request.post(`${database}/rest/v1/rpc/${rpc}`, { headers: headers(), data: {} });
      installed[rpc] = response.status() === 200 && (await response.json()) === 1;
    }
    test.info().annotations.push({ type: 'installed', description: JSON.stringify(installed) });
    // Printed, so a run in the terminal says which migrations the database still lacks (some, like payments, may be waiting on purpose).
    const missing = Object.keys(installed).filter((rpc) => !installed[rpc]).map((rpc) => rpc.replace(/_schema_version$/, ''));
    console.log(missing.length ? `Migrations not installed: ${missing.join(', ')}` : 'Every migration the app knows about is installed.');
    // The app needs these to register anyone at all.
    expect(installed.organization_verification_schema_version, 'verification migration').toBe(true);
    expect(installed.mandate_evidence_schema_version, 'mandate documents migration').toBe(true);
    expect(installed.workspace_schema_version, 'online builder migration').toBe(true);
  });
});
