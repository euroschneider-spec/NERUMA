import { describe, it, expect } from 'vitest';
import { applicationFromForm, validApplication, getVerificationCopy, type ApplicationInput } from '@/lib/verification';
import { organisationTypes } from '@/lib/organisation-copy';
import { locales } from '@/lib/i18n';

// The registration form's rules, as the server applies them after any browser checks are skipped. Every case is a way a
// request can reach the server that the form itself would not send.
const good: ApplicationInput = {
  organisation: 'Muzeul de Artă', type: 'museum', representative: 'Ana Popescu', website: 'https://muzeu.example.ro',
  country: 'RO', registry: 'RO-REG-42', representativeRole: 'Director', authorization: 'The city cultural office can confirm my appointment.',
  locale: 'en', authority: true, responsibility: true,
};
const ok = (patch: Partial<ApplicationInput>) => validApplication({ ...good, ...patch });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const filled: Record<string, string> = {
  organisation: good.organisation, type: good.type, representative: good.representative, website: good.website, country: good.country,
  registry: good.registry, representativeRole: good.representativeRole, authorization: good.authorization, authority: 'on', responsibility: 'on',
};

describe('validApplication', () => {
  it('accepts a complete request, and an empty optional registry reference', () => {
    expect(ok({})).toBe(true);
    expect(ok({ registry: '' })).toBe(true);
  });

  describe('official website', () => {
    it.each([
      ['http instead of https', 'http://muzeu.example.ro'],
      ['a script address', 'javascript:alert(1)'],
      ['a data address', 'data:text/html,<script>alert(1)</script>'],
      ['a file address', 'file:///etc/passwd'],
      ['no host dot', 'https://localhost'],
      ['sign-in details inside the address', 'https://user:secret@muzeu.example.ro'],
      ['only a user name', 'https://user@muzeu.example.ro'],
      ['a space inside', 'https://muzeu .example.ro'],
      ['a tab or newline inside', 'https://muzeu.example.ro/\n'],
      ['not an address at all', 'muzeu.example.ro'],
      ['empty', ''],
      ['more than 500 characters', `https://muzeu.example.ro/${'a'.repeat(500)}`],
    ])('rejects %s', (_label, website) => {
      expect(ok({ website })).toBe(false);
    });
    it.each([
      ['a path and query', 'https://muzeu.example.ro/despre?lang=ro'],
      ['a port', 'https://muzeu.example.ro:8443'],
      ['a punycode domain (münchen)', 'https://xn--mnchen-3ya.de'],
      ['an accented domain written as typed', 'https://münchen.de'],
    ])('accepts %s', (_label, website) => {
      expect(ok({ website })).toBe(true);
    });
    it('knows a limit: an address pointing at an internal host or IP passes (it is only shown to the administrator, never fetched)', () => {
      expect(ok({ website: 'https://10.0.0.1/' })).toBe(true);
    });
  });

  describe('country code', () => {
    it.each(['R', 'ROU', '1R', 'R O', '', 'ro1'])('rejects %j', (country) => {
      expect(ok({ country })).toBe(false);
    });
    it('needs capitals; the form turns lowercase into capitals before this check', () => {
      expect(ok({ country: 'ro' })).toBe(false);
      expect(applicationFromForm(form({ ...filled, country: 'ro' }), 'en')?.country).toBe('RO');
    });
    it('knows a limit: any two capital letters pass, valid country or not', () => {
      expect(ok({ country: 'ZZ' })).toBe(true);
    });
  });

  describe('lengths', () => {
    it.each([
      ['organisation', 160], ['representative', 160], ['representativeRole', 160],
    ] as const)('%s is accepted at %i characters and rejected one above', (field, max) => {
      expect(ok({ [field]: 'a'.repeat(max) })).toBe(true);
      expect(ok({ [field]: 'a'.repeat(max + 1) })).toBe(false);
    });
    it('needs an organisation name, a representative and a role of at least two characters', () => {
      expect(ok({ organisation: '' })).toBe(false);
      expect(ok({ representative: '' })).toBe(false);
      expect(ok({ representativeRole: 'D' })).toBe(false);
      expect(ok({ representativeRole: 'CEO' })).toBe(true);
    });
    it('needs 20 to 2000 characters of authorisation, and at most 300 of registry reference', () => {
      expect(ok({ authorization: 'a'.repeat(19) })).toBe(false);
      expect(ok({ authorization: 'a'.repeat(20) })).toBe(true);
      expect(ok({ authorization: 'a'.repeat(2000) })).toBe(true);
      expect(ok({ authorization: 'a'.repeat(2001) })).toBe(false);
      expect(ok({ registry: 'a'.repeat(300) })).toBe(true);
      expect(ok({ registry: 'a'.repeat(301) })).toBe(false);
    });
  });

  describe('organisation type', () => {
    it('accepts exactly the types the form offers', () => {
      for (const type of organisationTypes) expect(ok({ type })).toBe(true);
    });
    it.each(['', 'Museum', 'bank', "museum'; drop table organizations;--", '__proto__', 'constructor', 'toString'])('rejects %j', (type) => {
      expect(ok({ type })).toBe(false);
    });
  });

  describe('the two statements the person must make', () => {
    it('refuses a request that does not confirm their authority or accept the responsibility text', () => {
      expect(ok({ authority: false })).toBe(false);
      expect(ok({ responsibility: false })).toBe(false);
    });
  });
});

describe('applicationFromForm', () => {
  it('reads a complete form and trims the text fields', () => {
    const input = applicationFromForm(form({ ...filled, organisation: '  Muzeul de Artă  ', representative: '\tAna Popescu\n' }), 'ro');
    expect(input).toMatchObject({ organisation: 'Muzeul de Artă', representative: 'Ana Popescu', locale: 'ro', authority: true, responsibility: true });
  });
  it('returns nothing when a box is not ticked, or a field is missing', () => {
    expect(applicationFromForm(form({ ...filled, authority: '' }), 'en')).toBeNull();
    expect(applicationFromForm(form({ ...filled, responsibility: 'off' }), 'en')).toBeNull();
    expect(applicationFromForm(new FormData(), 'en')).toBeNull();
  });
  it('takes the language from the page, never from a form field', () => {
    const input = applicationFromForm(form({ ...filled, locale: 'de' }), 'ro');
    expect(input?.locale).toBe('ro');
  });
  it('ignores fields that are not part of the form, so a forged "status" or "role" goes nowhere', () => {
    const input = applicationFromForm(form({ ...filled, status: 'approved', role: 'platform_admin', organization_id: 'x' }), 'en');
    expect(input).not.toBeNull();
    expect(Object.keys(input!).sort()).toEqual(['authority', 'authorization', 'country', 'locale', 'organisation', 'registry', 'representative', 'representativeRole', 'responsibility', 'type', 'website']);
  });
  it('keeps hostile text as plain text: it is stored and shown escaped, never interpreted', () => {
    const input = applicationFromForm(form({ ...filled, organisation: '<img src=x onerror=alert(1)>', representative: '"><script>alert(1)</script>' }), 'en');
    expect(input?.organisation).toBe('<img src=x onerror=alert(1)>');
  });
  it('treats a file in a text field as text', () => {
    const data = form(filled);
    data.set('organisation', new File(['x'], 'a.txt'));
    expect(applicationFromForm(data, 'en')?.organisation).toBe('[object File]');
  });
});

describe('known gaps, written down so they are decisions and not surprises', () => {
  it('a control character or a line break inside a name is accepted', () => {
    expect(ok({ organisation: 'Muzeul\nde Artă' })).toBe(true);
    expect(ok({ representative: 'Ana\u0000Popescu' })).toBe(true);
  });
  it('the German ß becomes “SS” and passes as a country code', () => {
    const input = applicationFromForm(form({ ...filled, country: 'ß' }), 'en');
    expect(input?.country).toBe('SS');
  });
});

describe('verification copy', () => {
  it('has every text in every language', () => {
    const keys = Object.keys(getVerificationCopy('en')).sort();
    for (const locale of locales) expect(Object.keys(getVerificationCopy(locale)).sort()).toEqual(keys);
  });
});
