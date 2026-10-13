import { describe, it, expect } from 'vitest';
import { fill, guideFromPublished, parseLanguageChecks, parsePublishedGuide, parsePublishedPlaces, parseQrTarget, parsePublishedContent, waitingReasons } from '@/lib/publishing';

const zone = (extra = {}) => ({ id: 'z1', title: 'Entrance', description: 'Step-free.', note: '', next: 'Reception', optional: true,
  sensory: { sound: 'low', light: 'moderate', crowding: 'loud', smell: 'unknown', temperature: 'unknown', visual: 'high' },
  photo: { key: 'o/p/z/ph.webp', alt: 'Glass doors', rights: 'Own', photographedOn: '2026-01-02' },
  fields: [{ label: 'Lift', kind: 'yes_no', value: '', answer: 'yes' }, { label: '', kind: 'text', value: 'x', answer: 'unanswered' }], ...extra });
const content = { locale: 'en', slug: 'willow-bay', name: 'Willow', description: 'A museum', arrival: 'Use the main door', city: 'Bay', address: '1 Square', place_type: 'museum', zones: [zone()] };

describe('reading a published guide', () => {
  it('keeps what is valid and drops what is not', () => {
    const parsed = parsePublishedContent(content)!;
    expect(parsed.zones[0].sensory.crowding).toBe('unknown');
    expect(parsed.zones[0].sensory.visual).toBe('high');
    expect(parsed.zones[0].fields).toEqual([{ label: 'Lift', kind: 'yes_no', value: '', answer: 'yes' }]);
    expect(parsed.zones[0].photo?.key).toBe('o/p/z/ph.webp');
  });
  it('refuses a snapshot that is not usable', () => {
    expect(parsePublishedContent(null)).toBeNull();
    expect(parsePublishedContent({ ...content, zones: [] })).toBeNull();
    expect(parsePublishedContent({ ...content, locale: 'fr' })).toBeNull();
    expect(parsePublishedContent({ ...content, slug: '../x' })).toBeNull();
  });
  it('knows a guide that is down, and one it cannot read', () => {
    expect(parsePublishedGuide({ status: 'unavailable' })).toEqual({ status: 'unavailable' });
    expect(parsePublishedGuide({ status: 'published', locale: 'en', locales: ['en', 'xx', 'ro'], content, publishedAt: '2026-10-13' }))
      .toMatchObject({ status: 'published', locales: ['en', 'ro'] });
    expect(parsePublishedGuide({ status: 'published', locale: 'en', locales: [], content })).toBeNull();
    expect(parsePublishedGuide('x')).toBeNull();
  });
  it('turns a snapshot into the visitor guide without any demo wording', () => {
    const guide = guideFromPublished(parsePublishedContent(content)!);
    expect(guide.isDemo).toBe(false);
    expect(guide.title).toBe('Willow');
    expect(guide.zones[0].photo?.src).toBe('/api/guide-photos?key=o%2Fp%2Fz%2Fph.webp');
    expect(guide.zones[0].optional).toBe(true);
  });
});

describe('the lists a visitor and an owner read', () => {
  it('Explore entries need a good address and language', () => {
    expect(parsePublishedPlaces([{ slug: 'ok-one', name: 'A', city: 'B', placeType: 'museum', locale: 'ro', locales: ['ro', 'en'], steps: 4 }, { slug: 'Bad Slug', locale: 'en' }, { slug: 'x', locale: 'fr' }]))
      .toEqual([{ slug: 'ok-one', name: 'A', city: 'B', placeType: 'museum', locale: 'ro', locales: ['ro', 'en'], steps: 4 }]);
    expect(parsePublishedPlaces('nope')).toEqual([]);
  });
  it('a QR target is either an address or "unavailable", never a name', () => {
    expect(parseQrTarget({ status: 'published', slug: 'willow-bay', locales: ['en'] })).toEqual({ status: 'published', slug: 'willow-bay', locales: ['en'] });
    expect(parseQrTarget({ status: 'unavailable', name: 'Secret museum' })).toEqual({ status: 'unavailable' });
    expect(parseQrTarget({ status: 'published', slug: 'x', locales: [] })).toBeNull();
  });
  it('language checks keep only the three languages', () => {
    const checks = parseLanguageChecks([{ locale: 'en', started: true, ready: true, published: false, steps: 3, missingText: 0, missingAlt: 0, hasName: true }, { locale: 'fr' }, 7]);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ locale: 'en', ready: true, steps: 3 });
  });
});

describe('why a language waits', () => {
  const base = { locale: 'ro' as const, started: true, ready: false, published: false, steps: 3, missingText: 0, missingAlt: 0, hasName: true };
  it('names each reason in the owner\'s language', () => {
    expect(waitingReasons({ ...base, started: false }, 'en')).toEqual(['not started']);
    expect(waitingReasons({ ...base, steps: 2, missingText: 1, missingAlt: 2, hasName: false }, 'en'))
      .toEqual(['no location name', 'fewer than 3 steps', '1 step(s) without a name or description', '2 photo(s) without a description']);
    expect(waitingReasons({ ...base, steps: 2, published: true }, 'de')).toEqual(['weniger als 3 Schritte', 'Besucher sehen weiter die vorherige Version']);
  });
  it('fills in numbers', () => expect(fill('{n} steps in {where}', { n: 3, where: 'Cluj' })).toBe('3 steps in Cluj'));
});
