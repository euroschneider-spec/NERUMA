// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The emails NERUMA sends through Supabase (confirmation, password reset). They are the first thing an organisation receives. Each must say what it does
// in the person's language and carry nothing that tracks them: text and links only (DECISIONS.md, "Emails are text and links only"), no images, no
// tracking pixels, no remote files, and one link per language that points at this site.
const confirmation = readFileSync('supabase/templates/confirmation.html', 'utf8');
const recovery = readFileSync('supabase/templates/recovery.html', 'utf8');
const example = JSON.parse(readFileSync('supabase/templates/auth-email-settings.example.json', 'utf8')) as Record<string, string>;
const emails = { confirmation, recovery };

describe.each(Object.entries(emails))('%s email', (name, html) => {
  it('has a version for each language, with English as the fallback', () => {
    expect(html).toContain('{{ if eq .Data.preferred_locale "ro" }}');
    expect(html).toContain('{{ else if eq .Data.preferred_locale "de" }}');
    expect(html).toContain('{{ else }}');
    for (const lang of ['ro', 'de', 'en']) expect(html).toContain(`lang="${lang}"`);
  });
  it('has one link per language and nothing else to click', () => {
    expect((html.match(/href="/g) ?? []).length).toBe(3);
    expect(html).not.toMatch(/mailto:/i);
  });
  it('loads nothing from anywhere else: no images, scripts, styles, forms or fonts', () => {
    expect(html).not.toMatch(/<(img|script|link|iframe|form|video|audio|object|embed)\b/i);
    expect(html).not.toMatch(/url\(|@import|https?:\/\//i);
  });
  it('uses the new look: charcoal on off-white, a text header, and none of the old green', () => {
    expect(html).toContain('background:#faf9f6');
    expect(html).toContain('color:#292929');
    expect(html).toContain('>Neruma</p>');
    expect(html).not.toMatch(/#304f41|#24392f|#fbf8f3|#c5d1c8/);
  });
  it('says where to write, in every language', () => {
    expect(html).toContain('Questions? Write to support@lignorae.com.');
    expect(html).toContain('Întrebări? Scrie-ne la support@lignorae.com.');
    expect(html).toContain('Fragen? Schreiben Sie an support@lignorae.com.');
  });
  it('tells someone who did not ask for it to ignore it', () => {
    expect(html).toMatch(/ignore this email/);
    expect(html).toContain('ignoră acest email');
    expect(html).toContain('ignorieren Sie diese E-Mail');
  });
  it('is the same text as the example settings file that is pasted into the dashboard', () => {
    const pasted = example[`mailer_templates_${name}_content`];
    expect(pasted.replace(/\s+/g, ' ').trim()).toBe(html.replace(/\s+/g, ' ').trim());
  });
  it('has a subject in the example settings file that names NERUMA and all three languages', () => {
    const subject = example[`mailer_subjects_${name}`];
    expect(subject).toMatch(/^NERUMA — /);
    expect(subject.split('·').length).toBe(3);
  });
});

describe('confirmation email', () => {
  it('links only to the confirmation address Supabase fills in', () => {
    expect((confirmation.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length).toBe(3);
  });
  it('only uses the template variables Supabase provides here', () => {
    const variables = new Set([...confirmation.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((match) => match[1]));
    for (const variable of variables) expect(variable).toMatch(/^(\.ConfirmationURL|if eq \.Data\.preferred_locale "(ro|de)"|else if eq \.Data\.preferred_locale "(ro|de)"|else|end)$/);
  });
  it('says that confirming the address does not approve the organisation, in every language', () => {
    expect(confirmation).toContain('does not approve your organisation');
    expect(confirmation).toContain('nu aprobă organizația');
    expect(confirmation).toContain('genehmigt keinen Organisationszugang');
  });
});

describe('password reset email', () => {
  it('links to this site in the language of the email, with only the one-time token', () => {
    for (const lang of ['en', 'ro', 'de']) {
      const link = `{{ .SiteURL }}/${lang}/login/reset/continue?token_hash={{ .TokenHash }}`;
      expect(recovery, lang).toContain(`href="${link}"`);
      // The link is also written out, for a mail program that doesn't show the button.
      expect(recovery.split(link).length - 1, lang).toBe(2);
    }
  });
  it('only uses the template variables Supabase provides here', () => {
    const variables = new Set([...recovery.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((match) => match[1]));
    for (const variable of variables) expect(variable).toMatch(/^(\.SiteURL|\.TokenHash|if eq \.Data\.preferred_locale "(ro|de)"|else if eq \.Data\.preferred_locale "(ro|de)"|else|end)$/);
  });
  it('says the link works once and for one hour, in every language', () => {
    expect(recovery).toContain('works once, for one hour');
    expect(recovery).toContain('o singură dată, timp de o oră');
    expect(recovery).toContain('einmal und eine Stunde lang');
  });
  it('says the password stays as it is if the person did not ask', () => {
    expect(recovery).toContain('Your password stays as it is');
    expect(recovery).toContain('Parola ta rămâne neschimbată');
    expect(recovery).toContain('Ihr Passwort bleibt unverändert');
  });
});
