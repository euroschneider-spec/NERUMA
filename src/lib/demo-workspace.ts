import { demoEntrancePhoto, demoWingPhoto, demoWingPhotoSrc, demoPavilionPhoto, demoPavilionPhotoSrc, demoEntrancePhotoDate, demoEntrancePhotoSrc, getDemoGuide, type SensoryLevel, type SensoryProfile } from './demo';
import type { Locale } from './i18n';
import {
  placeAttention,
  placeTypes,
  removableFields,
  sensoryChannels,
  sensoryLevels,
  uuidPattern,
  yesNoAnswers,
  ownFieldKinds,
  type OnlinePhoto,
  type OnlineZone,
  type OwnField,
  type PlaceDraft,
  type PlaceSummary,
  type RemovableField,
} from './workspace';

/**
 * The demo workspace: two fictional locations that every visitor can edit, kept only in their own browser.
 * Nothing here talks to a server. The shape is documented in docs/briefs/2026-10-12-demo-workspace.md.
 */

export const DEMO_ORG = 'd0000000-0000-4000-8000-000000000001';
export const demoPlaceIds = {
  willow: 'd0000000-0000-4000-8000-0000000000a1',
  pavilion: 'd0000000-0000-4000-8000-0000000000a2',
} as const;
export const demoPlaceList = [demoPlaceIds.willow, demoPlaceIds.pavilion] as string[];
/** The one published location has the QR code that already exists for the example guide. */
export const DEMO_QR_CODE = 'willow-museum';
export const DEMO_VISITS = 128;
const storagePrefix = 'neruma:demo:v1:';
const storageKey = (placeId: string) => `${storagePrefix}${placeId}`;

/** The storage the demo writes to. localStorage in the browser; tests pass a plain map. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserStore = (): KeyValueStore => window.localStorage;

type StoredZone = {
  id: string;
  type: string;
  optional: boolean;
  hidden: RemovableField[];
  sensory: SensoryProfile;
  photo?: { id: string; storageKey: string; rights: string; photographedOn: string };
  fields: { id: string; kind: OwnField['kind']; answer: OwnField['answer'] }[];
};
type StoredTexts = {
  name: string;
  description: string;
  arrivalInfo: string;
  zones: Record<string, { title: string; description: string; note: string; next: string; alt: string }>;
  fields: Record<string, { label: string; value: string }>;
};
/** What a location keeps: the fields every language shares once, and the words once per language. */
type Stored = {
  v: 1;
  shared: { revision: number; city: string; address: string; countryCode: string; placeType: PlaceDraft['placeType']; zones: StoredZone[] };
  texts: Partial<Record<Locale, StoredTexts>>;
};

const locales: Locale[] = ['en', 'ro', 'de'];
const photoDate = '2026-09-01';
const id = (group: number, n: number) => `d0000000-0000-4000-8000-${String(group).padStart(4, '0')}${String(n).padStart(8, '0')}`;
const willowZones = [1, 2, 3, 4, 5].map((n) => id(1, n));
const willowPhotos = [1, 2, 3, 4, 5].map((n) => id(2, n));
const pavilionZones = [id(1, 11), id(1, 12)];
const pavilionPhoto = id(2, 12);
const willowArt = ['entrance', 'reception', 'collection', 'interactive', 'quiet-room'];

/** The sample photos are the site's own illustrations; a photo the visitor adds is kept in their browser instead. */
const sampleSources: Record<string, string> = {
  ...Object.fromEntries(willowPhotos.map((photo, i) => [photo, i === 0 ? demoEntrancePhotoSrc : i === 3 ? demoWingPhotoSrc : `/illustrations/${willowArt[i]}.svg`])),
  [pavilionPhoto]: demoPavilionPhotoSrc,
};
export const demoSampleSource = (photoId: string): string | undefined => sampleSources[photoId];
export const demoPhotoKey = (placeId: string, zoneId: string, photoId: string) =>
  `${DEMO_ORG}/${placeId}/${zoneId}/${photoId}.webp`.toLowerCase();

const pavilion: Record<Locale, { name: string; description: string; arrivalInfo: string; steps: [string, string, string, string][] }> = {
  en: {
    name: 'Garden Pavilion',
    description: 'A small glass pavilion in the museum garden, used for quiet talks and workshops.',
    arrivalInfo: 'Enter from the garden path behind the museum. The path and the pavilion are step-free.',
    steps: [
      ['Arriving at the pavilion', 'From the museum café a level gravel path leads to the pavilion, a curved glass building with a white wavy band of fins around it. Birdsong and wind in the willows are usually the loudest sounds.', 'Benches stand along the path if you want to pause.', 'The pavilion door is at the end of the path.'],
      ['Inside the pavilion', 'One bright room with folding chairs and large windows. Talks are small and usually end by early evening.', 'The light changes with the weather.', 'Staff at the door can show you a quieter seat.'],
    ],
  },
  ro: {
    name: 'Pavilionul din grădină',
    description: 'Un pavilion mic de sticlă în grădina muzeului, folosit pentru discuții și ateliere liniștite.',
    arrivalInfo: 'Intrați pe aleea din grădină, din spatele muzeului. Aleea și pavilionul sunt fără trepte.',
    steps: [
      ['Ajungerea la pavilion', 'De la cafeneaua muzeului, o alee plană de pietriș duce la pavilion, o clădire curbată din sticlă, înconjurată de o bandă albă ondulată de lamele. Cele mai puternice sunete sunt de obicei cântecul păsărilor și vântul prin sălcii.', 'Pe alee sunt bănci, dacă vrei să faci o pauză.', 'Ușa pavilionului este la capătul aleii.'],
      ['În pavilion', 'O singură încăpere luminoasă, cu scaune pliante și ferestre mari. Discuțiile sunt mici și se termină de obicei la începutul serii.', 'Lumina se schimbă odată cu vremea.', 'Personalul de la ușă îți poate arăta un loc mai liniștit.'],
    ],
  },
  de: {
    name: 'Gartenpavillon',
    description: 'Ein kleiner Glaspavillon im Museumsgarten für ruhige Vorträge und Workshops.',
    arrivalInfo: 'Der Zugang führt über den Gartenweg hinter dem Museum. Weg und Pavillon sind stufenlos.',
    steps: [
      ['Ankunft am Pavillon', 'Vom Museumscafé führt ein ebener Kiesweg zum Pavillon, einem geschwungenen Glasgebäude mit einem weißen, wellenförmigen Lamellenband. Vogelgesang und Wind in den Weiden sind meist die lautesten Geräusche.', 'Entlang des Wegs stehen Bänke, falls Sie pausieren möchten.', 'Die Tür des Pavillons liegt am Ende des Wegs.'],
      ['Im Pavillon', 'Ein heller Raum mit Klappstühlen und großen Fenstern. Die Vorträge sind klein und enden meist am frühen Abend.', 'Das Licht ändert sich mit dem Wetter.', 'Das Personal an der Tür zeigt Ihnen einen ruhigeren Platz.'],
    ],
  },
};
const pavilionSensory: SensoryProfile[] = [
  { sound: 'low', light: 'variable', crowding: 'low', smell: 'moderate', temperature: 'variable', visual: 'low' },
  { sound: 'moderate', light: 'variable', crowding: 'moderate', smell: 'low', temperature: 'moderate', visual: 'low' },
];
const willowText: Record<Locale, { description: string; arrivalInfo: string; alt: string[] }> = {
  en: {
    description: 'A fictional museum used as an example. Everything here is invented.',
    arrivalInfo: 'The entrance on Willow Square is step-free. Reception is straight ahead.',
    alt: ['The glass entrance doors with a bench beside them', 'The reception desk in the foyer', 'A gallery with paintings and benches', 'A room with screens and hands-on displays', 'A small quiet room with a window onto a garden'].map((text, i) => (i === 0 ? demoEntrancePhoto.en.alt : i === 3 ? demoWingPhoto.en.alt : `${text} (illustration)`)),
  },
  ro: {
    description: 'Un muzeu fictiv, folosit ca exemplu. Tot ce se vede aici este inventat.',
    arrivalInfo: 'Intrarea din Piața Willow este fără trepte. Recepția este chiar în față.',
    alt: ['Ușile de sticlă ale intrării, cu o bancă alături', 'Biroul de recepție din hol', 'O galerie cu tablouri și bănci', 'O sală cu ecrane și exponate interactive', 'O cameră mică și liniștită, cu fereastră spre grădină'].map((text, i) => (i === 0 ? demoEntrancePhoto.ro.alt : i === 3 ? demoWingPhoto.ro.alt : `${text} (ilustrație)`)),
  },
  de: {
    description: 'Ein fiktives Museum als Beispiel. Alles hier ist erfunden.',
    arrivalInfo: 'Der Eingang am Willow-Platz ist stufenlos. Der Empfang liegt direkt gegenüber.',
    alt: ['Die gläsernen Eingangstüren mit einer Bank daneben', 'Der Empfang im Foyer', 'Eine Galerie mit Gemälden und Bänken', 'Ein Raum mit Bildschirmen und interaktiven Stationen', 'Ein kleiner ruhiger Raum mit Fenster zum Garten'].map((text, i) => (i === 0 ? demoEntrancePhoto.de.alt : i === 3 ? demoWingPhoto.de.alt : `${text} (Illustration)`)),
  },
};

/** The original content of a demo location, in every language. */
function sampleStored(placeId: string): Stored | null {
  if (placeId === demoPlaceIds.willow) {
    const texts: Stored['texts'] = {};
    for (const locale of locales) {
      const guide = getDemoGuide(locale);
      const text = willowText[locale];
      texts[locale] = {
        name: guide.title,
        description: text.description,
        arrivalInfo: text.arrivalInfo,
        zones: Object.fromEntries(guide.zones.map((zone, i) => [willowZones[i], { title: zone.title, description: zone.description, note: zone.note, next: zone.next, alt: text.alt[i] }])),
        fields: {},
      };
    }
    return {
      v: 1,
      shared: {
        revision: 1, city: 'Willow Bay', address: 'Willow Square 1 — fictional address', countryCode: '', placeType: 'museum',
        zones: getDemoGuide('en').zones.map((zone, i) => ({
          id: willowZones[i], type: 'visit-space', optional: i === 3, hidden: [], sensory: zone.sensory, fields: [],
          photo: { id: willowPhotos[i], storageKey: demoPhotoKey(placeId, willowZones[i], willowPhotos[i]), rights: i === 0 ? demoEntrancePhoto.en.rights : i === 3 ? demoWingPhoto.en.rights : 'NERUMA illustration — fictional example', photographedOn: i === 0 ? demoEntrancePhotoDate : photoDate },
        })),
      },
      texts,
    };
  }
  if (placeId === demoPlaceIds.pavilion) {
    const texts: Stored['texts'] = {};
    for (const locale of locales) {
      const text = pavilion[locale];
      texts[locale] = {
        name: text.name, description: text.description, arrivalInfo: text.arrivalInfo,
        zones: Object.fromEntries(text.steps.map(([title, description, note, next], i) => [pavilionZones[i], { title, description, note, next, alt: i === 0 ? demoPavilionPhoto[locale].alt : '' }])),
        fields: {},
      };
    }
    return {
      v: 1,
      shared: {
        revision: 1, city: 'Willow Bay', address: 'Willow Square 4 — fictional address', countryCode: '', placeType: 'cultural',
        zones: pavilionZones.map((zoneId, i) => ({
          id: zoneId, type: 'visit-space', optional: false, hidden: [], sensory: pavilionSensory[i], fields: [],
          photo: i === 0 ? { id: pavilionPhoto, storageKey: demoPhotoKey(placeId, zoneId, pavilionPhoto), rights: demoPavilionPhoto.en.rights, photographedOn: demoEntrancePhotoDate } : undefined,
        })),
      },
      texts,
    };
  }
  return null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : '');
const isId = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);

/** Reads what was stored. Anything that isn't the expected shape is dropped, so a damaged value falls back to the sample. */
function parseStored(raw: unknown): Stored | null {
  if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.shared) || !isRecord(raw.texts)) return null;
  const { shared } = raw;
  if (!Array.isArray(shared.zones) || shared.zones.length < 1 || shared.zones.length > 8) return null;
  if (!Number.isSafeInteger(shared.revision) || !placeTypes.includes(shared.placeType as PlaceDraft['placeType'])) return null;
  const zones: StoredZone[] = [];
  for (const zone of shared.zones) {
    if (!isRecord(zone) || !isId(zone.id) || typeof zone.optional !== 'boolean' || !isRecord(zone.sensory)) return null;
    const sensory = zone.sensory as Record<string, unknown>;
    if (sensoryChannels.some((channel) => !sensoryLevels.includes(sensory[channel] as SensoryLevel))) return null;
    const hidden = Array.isArray(zone.hidden) ? zone.hidden.filter((name): name is RemovableField => removableFields.includes(name as RemovableField)) : [];
    const fields = (Array.isArray(zone.fields) ? zone.fields : []).filter(isRecord)
      .filter((field) => isId(field.id) && ownFieldKinds.includes(field.kind as OwnField['kind']))
      .map((field) => ({ id: field.id as string, kind: field.kind as OwnField['kind'], answer: yesNoAnswers.includes(field.answer as OwnField['answer']) ? field.answer as OwnField['answer'] : 'unanswered' }));
    const photo = isRecord(zone.photo) && isId(zone.photo.id) && typeof zone.photo.storageKey === 'string'
      ? { id: zone.photo.id, storageKey: zone.photo.storageKey.slice(0, 180), rights: str(zone.photo.rights, 500), photographedOn: str(zone.photo.photographedOn, 10) }
      : undefined;
    zones.push({ id: zone.id, type: str(zone.type, 60) || 'visit-space', optional: zone.optional, hidden, sensory: zone.sensory as SensoryProfile, photo, fields });
  }
  const texts: Stored['texts'] = {};
  for (const locale of locales) {
    const entry = (raw.texts as Record<string, unknown>)[locale];
    if (!isRecord(entry)) continue;
    const zoneTexts: StoredTexts['zones'] = {};
    for (const [zoneId, value] of Object.entries(isRecord(entry.zones) ? entry.zones : {})) {
      if (isRecord(value)) zoneTexts[zoneId] = { title: str(value.title, 160), description: str(value.description), note: str(value.note), next: str(value.next), alt: str(value.alt, 500) };
    }
    const fieldTexts: StoredTexts['fields'] = {};
    for (const [fieldId, value] of Object.entries(isRecord(entry.fields) ? entry.fields : {})) {
      if (isRecord(value)) fieldTexts[fieldId] = { label: str(value.label, 80), value: str(value.value, 500) };
    }
    texts[locale] = { name: str(entry.name, 160), description: str(entry.description), arrivalInfo: str(entry.arrivalInfo), zones: zoneTexts, fields: fieldTexts };
  }
  return {
    v: 1,
    shared: { revision: Number(shared.revision), city: str(shared.city, 160), address: str(shared.address, 500), countryCode: '', placeType: shared.placeType as PlaceDraft['placeType'], zones },
    texts,
  };
}

function readStored(placeId: string, kv: KeyValueStore): Stored | null {
  const sample = sampleStored(placeId);
  if (!sample) return null;
  try {
    const raw = kv.getItem(storageKey(placeId));
    return (raw ? parseStored(JSON.parse(raw)) : null) ?? sample;
  } catch {
    return sample;
  }
}

/** A location as the editor and the preview show it in one language. A step with no words in this language opens empty. */
function draftFrom(placeId: string, stored: Stored, locale: Locale): { draft: PlaceDraft; missingTranslation: boolean } {
  const sample = sampleStored(placeId)!;
  const text = stored.texts[locale] ?? sample.texts[locale]!;
  const sampleSteps = new Set(sample.shared.zones.map((zone) => zone.id));
  const sampleText = sample.texts[locale]!;
  let missingTranslation = false;
  const zones: OnlineZone[] = stored.shared.zones.map((zone) => {
    // Words kept for this language, else the original words of a sample step; a step the visitor added has none yet.
    const words = text.zones[zone.id] ?? (sampleSteps.has(zone.id) ? sampleText.zones[zone.id] : undefined);
    if (!words) missingTranslation = true;
    const photo: OnlinePhoto | undefined = zone.photo && { ...zone.photo, alt: words?.alt ?? '' };
    return {
      id: zone.id, type: zone.type, optional: zone.optional, hidden: zone.hidden, sensory: zone.sensory, photo,
      title: words?.title ?? '', description: words?.description ?? '', note: words?.note ?? '', next: words?.next ?? '',
      fields: zone.fields.map((field) => ({ ...field, label: text.fields[field.id]?.label ?? '', value: text.fields[field.id]?.value ?? '' })),
    };
  });
  if (zones.some((zone) => zone.fields.some((field) => !field.label))) missingTranslation = true;
  return {
    draft: {
      id: placeId, revision: stored.shared.revision, name: text.name, city: stored.shared.city, address: stored.shared.address, countryCode: '',
      placeType: stored.shared.placeType, description: text.description, arrivalInfo: text.arrivalInfo, zones,
    },
    missingTranslation: missingTranslation || !text.name,
  };
}

/** One location for the editor or preview, or null for an address that isn't a demo location. */
export function loadDemoPlace(placeId: string, locale: Locale, kv: KeyValueStore = browserStore()) {
  const stored = readStored(placeId, kv);
  return stored ? draftFrom(placeId, stored, locale) : null;
}

export type DemoSaveResult = { ok: true; revision: number } | { ok: false; error: 'invalid' | 'other' };

/** Keeps a draft in this browser: the shared fields once, the words only for the language it was edited in. */
export function saveDemoPlace(draft: PlaceDraft, locale: Locale, kv: KeyValueStore = browserStore()): DemoSaveResult {
  const current = readStored(draft.id, kv);
  if (!current) return { ok: false, error: 'invalid' };
  const revision = current.shared.revision + 1;
  const stillThere = new Set(draft.zones.map((zone) => zone.id));
  const texts: Stored['texts'] = {};
  for (const other of locales) {
    const kept = current.texts[other];
    if (!kept || other === locale) continue;
    // Steps removed here are removed everywhere; the words of the others stay.
    texts[other] = { ...kept, zones: Object.fromEntries(Object.entries(kept.zones).filter(([zoneId]) => stillThere.has(zoneId))) };
  }
  texts[locale] = {
    name: draft.name, description: draft.description, arrivalInfo: draft.arrivalInfo,
    zones: Object.fromEntries(draft.zones.map((zone) => [zone.id, { title: zone.title, description: zone.description, note: zone.note, next: zone.next, alt: zone.photo?.alt ?? '' }])),
    fields: Object.fromEntries(draft.zones.flatMap((zone) => zone.fields.map((field) => [field.id, { label: field.label, value: field.value }]))),
  };
  const stored: Stored = {
    v: 1,
    shared: {
      revision, city: draft.city, address: draft.address, countryCode: '', placeType: draft.placeType,
      zones: draft.zones.map((zone) => ({
        id: zone.id, type: zone.type, optional: zone.optional, hidden: zone.hidden, sensory: zone.sensory,
        photo: zone.photo && { id: zone.photo.id, storageKey: zone.photo.storageKey, rights: zone.photo.rights, photographedOn: zone.photo.photographedOn },
        fields: zone.fields.map((field) => ({ id: field.id, kind: field.kind, answer: field.answer })),
      })),
    },
    texts,
  };
  try {
    kv.setItem(storageKey(draft.id), JSON.stringify(stored));
    return { ok: true, revision };
  } catch {
    return { ok: false, error: 'other' };
  }
}

/** The dashboard's cards, built the same way the real list is: status, first photo, and what needs attention. */
export function listDemoPlaces(locale: Locale, kv: KeyValueStore = browserStore()): PlaceSummary[] {
  return demoPlaceList.map((placeId) => {
    const { draft } = loadDemoPlace(placeId, locale, kv)!;
    const firstPhoto = draft.zones.find((zone) => zone.photo)?.photo;
    return {
      id: placeId, name: draft.name || draft.city, city: draft.city, address: draft.address, revision: draft.revision, updatedAt: '',
      status: placeId === demoPlaceIds.willow ? 'published' : 'draft',
      photoKey: firstPhoto?.storageKey,
      attention: placeAttention(
        draft.zones.map((zone) => ({ id: zone.id, hasText: Boolean(zone.title.trim() && zone.description.trim()) })),
        draft.zones.filter((zone) => zone.photo).map((zone) => ({ zoneId: zone.id, alt: zone.photo!.alt })),
      ),
    };
  });
}

/** Puts the originals back by forgetting what this browser kept. Photos the visitor added are cleared separately (local-photos). */
export function resetDemo(kv: KeyValueStore = browserStore()): void {
  for (const placeId of demoPlaceList) {
    try {
      kv.removeItem(storageKey(placeId));
    } catch {
      // Nothing was kept, or storage is blocked: the originals show either way.
    }
  }
}
