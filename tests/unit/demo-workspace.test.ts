import { describe, it, expect } from 'vitest';
import { DEMO_ORG, demoPlaceIds, demoPlaceList, demoSampleSource, listDemoPlaces, loadDemoPlace, resetDemo, saveDemoPlace, type KeyValueStore } from '@/lib/demo-workspace';
import { newOwnField, parsePlaceDraft } from '@/lib/workspace';
import type { Locale } from '@/lib/i18n';

const memory = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
};
const locales: Locale[] = ['en', 'ro', 'de'];

describe('the demo samples', () => {
  it.each(locales)('every location is a valid draft in %s, with photos that exist', (locale) => {
    const kv = memory();
    for (const id of demoPlaceList) {
      const { draft, missingTranslation } = loadDemoPlace(id, locale, kv)!;
      expect(missingTranslation).toBe(false);
      expect(parsePlaceDraft(draft, DEMO_ORG)?.id).toBe(id);
      for (const zone of draft.zones) {
        if (zone.photo) expect(demoSampleSource(zone.photo.id)).toMatch(/^\/illustrations\/.+\.svg$/);
      }
    }
  });

  it('has a complete published museum and an unfinished pavilion', () => {
    const cards = listDemoPlaces('en', memory());
    const [willow, pavilion] = cards;
    expect(willow).toMatchObject({ id: demoPlaceIds.willow, status: 'published', attention: [] });
    expect(willow.photoKey).toBeTruthy();
    expect(pavilion).toMatchObject({ id: demoPlaceIds.pavilion, status: 'draft', attention: ['fewSteps'] });
  });

  it('knows only its own locations', () => {
    expect(loadDemoPlace(crypto.randomUUID(), 'en', memory())).toBeNull();
    expect(saveDemoPlace({ ...loadDemoPlace(demoPlaceIds.willow, 'en', memory())!.draft, id: crypto.randomUUID() }, 'en', memory())).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('saving in the browser', () => {
  it('keeps a change after a reload and counts revisions', () => {
    const kv = memory();
    const draft = loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft;
    draft.zones[0].title = 'The front door';
    expect(saveDemoPlace(draft, 'en', kv)).toEqual({ ok: true, revision: 2 });
    const again = loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft;
    expect(again.zones[0].title).toBe('The front door');
    expect(again.revision).toBe(2);
  });

  it('keeps words per language and the rest for all languages', () => {
    const kv = memory();
    const draft = loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft;
    const original = loadDemoPlace(demoPlaceIds.willow, 'de', kv)!.draft;
    draft.zones[0].title = 'The front door';
    draft.zones[0].sensory = { ...draft.zones[0].sensory, sound: 'high' };
    draft.zones = [draft.zones[1], draft.zones[0], ...draft.zones.slice(2)];
    saveDemoPlace(draft, 'en', kv);
    const german = loadDemoPlace(demoPlaceIds.willow, 'de', kv)!.draft;
    // Words: German still has its own. Shared: the level and the order follow the change.
    expect(german.zones.map((zone) => zone.title)).toEqual([original.zones[1].title, original.zones[0].title, ...original.zones.slice(2).map((zone) => zone.title)]);
    expect(german.zones[1].sensory.sound).toBe('high');
  });

  it('shows a step the visitor added as missing in the languages they did not write', () => {
    const kv = memory();
    const draft = loadDemoPlace(demoPlaceIds.pavilion, 'en', kv)!.draft;
    draft.zones.push({ ...draft.zones[0], id: crypto.randomUUID(), title: 'The kiosk', description: 'Tea and coffee.', photo: undefined });
    saveDemoPlace(draft, 'en', kv);
    expect(listDemoPlaces('en', kv)[1].attention).toEqual([]);
    const romanian = loadDemoPlace(demoPlaceIds.pavilion, 'ro', kv)!;
    expect(romanian.missingTranslation).toBe(true);
    expect(romanian.draft.zones[2].title).toBe('');
    expect(listDemoPlaces('ro', kv)[1].attention).toEqual(['missingText']);
  });

  it('keeps own fields: the answer for everyone, the words per language', () => {
    const kv = memory();
    const draft = loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft;
    const field = { ...newOwnField('yes_no'), label: 'Lift available', answer: 'yes' as const };
    draft.zones[0].fields = [field];
    saveDemoPlace(draft, 'en', kv);
    expect(loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft.zones[0].fields[0]).toMatchObject({ label: 'Lift available', answer: 'yes' });
    const german = loadDemoPlace(demoPlaceIds.willow, 'de', kv)!;
    expect(german.draft.zones[0].fields[0]).toMatchObject({ label: '', answer: 'yes' });
    expect(german.missingTranslation).toBe(true);
  });

  it('reports a storage that refuses to write', () => {
    const kv = { ...memory(), setItem: () => { throw new Error('quota'); } };
    expect(saveDemoPlace(loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft, 'en', kv)).toEqual({ ok: false, error: 'other' });
  });
});

describe('damaged or old stored values', () => {
  it.each([
    ['not JSON', '{nope'],
    ['an old version', JSON.stringify({ v: 0 })],
    ['no steps', JSON.stringify({ v: 1, shared: { revision: 1, placeType: 'museum', zones: [] }, texts: {} })],
    ['a bad level', JSON.stringify({ v: 1, shared: { revision: 1, placeType: 'museum', city: 'x', address: '', zones: [{ id: demoPlaceIds.willow, optional: false, sensory: { sound: 'loud' } }] }, texts: {} })],
  ])('fall back to the sample: %s', (_name, raw) => {
    const kv = memory();
    kv.setItem(`neruma:demo:v1:${demoPlaceIds.willow}`, raw);
    expect(loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft.revision).toBe(1);
    expect(loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft.zones).toHaveLength(5);
  });
});

describe('reset', () => {
  it('brings the originals back', () => {
    const kv = memory();
    const draft = loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft;
    draft.name = 'Changed';
    saveDemoPlace(draft, 'en', kv);
    resetDemo(kv);
    expect(kv.map.size).toBe(0);
    expect(loadDemoPlace(demoPlaceIds.willow, 'en', kv)!.draft.name).toBe('The Willow Museum');
  });
});
