// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The confirmation email is the first thing an organisation receives. It must say what it does and does not do, in the
// person's language, and carry nothing that tracks them (no remote images, no tracking pixels, no third-party links).
const html = readFileSync('supabase/templates/confirmation.html', 'utf8');
const example = JSON.parse(readFileSync('supabase/templates/auth-email-settings.example.json', 'utf8')) as Record<string, string>;

describe('confirmation email', () => {
  it('has a version for each language, with English as the fallback', () => {
    expect(html).toContain('{{ if eq .Data.preferred_locale "ro" }}');
    expect(html).toContain('{{ else if eq .Data.preferred_locale "de" }}');
    expect(html).toContain('{{ else }}');
    for (const lang of ['ro', 'de', 'en']) expect(html).toContain(`lang="${lang}"`);
  });
  it('links only to the confirmation address Supabase fills in, once per language', () => {
    expect((html.match(/href="/g) ?? []).length).toBe(3);
    expect((html.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length).toBe(3);
  });
  it('loads nothing from anywhere else: no images, scripts, styles, forms or fonts', () => {
    expect(html).not.toMatch(/<(img|script|link|iframe|form|video|audio|object|embed)\b/i);
    expect(html).not.toMatch(/url\(|@import|https?:\/\//i);
  });
  it('only uses the template variables Supabase provides here', () => {
    const variables = new Set([...html.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((match) => match[1]));
    for (const variable of variables) expect(variable).toMatch(/^(\.ConfirmationURL|if eq \.Data\.preferred_locale "(ro|de)"|else if eq \.Data\.preferred_locale "(ro|de)"|else|end)$/);
  });
  it('says that confirming the address does not approve the organisation, in every language', () => {
    expect(html).toContain('does not approve your organisation');
    expect(html).toContain('nu aprobă organizația');
    expect(html).toContain('genehmigt keinen Organisationszugang');
  });
  it('tells someone who did not ask for it to ignore it', () => {
    expect(html).toContain('If you did not request this account, ignore this email.');
    expect(html).toContain('ignoră acest email');
    expect(html).toContain('ignorieren Sie diese E-Mail');
  });
  it('is the same text as the example settings file that is pasted into the dashboard', () => {
    const pasted = example.mailer_templates_confirmation_content;
    expect(pasted.replace(/\s+/g, ' ')).toContain(html.replace(/\s+/g, ' ').trim().replace(/^<!doctype html>.*?<body[^>]*>/i, '').slice(0, 200));
  });
});
