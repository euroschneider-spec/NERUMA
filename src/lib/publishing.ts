import type { Guide, SensoryLevel, SensoryProfile, Zone } from './demo';
import { isLocale, locales, type Locale } from './i18n';
import { sensoryChannels, sensoryLevels } from './workspace';

/**
 * Publishing (brief docs/briefs/2026-10-13-publishing.md): what the database answers about a published guide, read
 * carefully (anything unexpected is dropped), and turned into the guide component's shape. Shared by server and client.
 */

/** Where a language stands before publishing, from `publication_check`. */
export type LanguageCheck = {
  locale: Locale; started: boolean; ready: boolean; published: boolean;
  steps: number; includedSteps: number; missingText: number; missingAlt: number; hasName: boolean;
};
export type PublishResult = { ok: true; live: Locale[]; slug: string; code: string } | { ok: false; error: 'invalid' | 'conflict' | 'auth' | 'nothing' | 'plan' | 'error' };
export type UnpublishResult = { ok: boolean };
/** What the editor needs to know about a location's publication; absent before the publishing migration exists. */
export type Publication = { published: boolean; slug?: string };

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : '');
const count = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0);
export const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const qrCodePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseLanguageChecks(value: unknown): LanguageCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).filter((item) => isLocale(String(item.locale))).map((item) => ({
    locale: item.locale as Locale, started: item.started === true, ready: item.ready === true, published: item.published === true,
    steps: count(item.steps), missingText: count(item.missingText), missingAlt: count(item.missingAlt), hasName: item.hasName === true,
    // Before the one-step migration the database doesn't say; every step with its words counted.
    includedSteps: 'includedSteps' in item ? count(item.includedSteps) : Math.max(0, count(item.steps) - count(item.missingText)),
  }));
}

const localeList = (value: unknown): Locale[] => (Array.isArray(value) ? value.filter((item): item is Locale => typeof item === 'string' && isLocale(item)) : []);

/** A published step as stored in the snapshot. */
export type PublishedZone = {
  id: string; title: string; description: string; note: string; next: string; optional: boolean; sensory: SensoryProfile;
  photo?: { key: string; alt: string; rights: string; photographedOn: string };
  fields: { label: string; kind: 'text' | 'yes_no'; value: string; answer: 'yes' | 'no' | 'unanswered' }[];
};
export type PublishedContent = {
  locale: Locale; slug: string; name: string; description: string; arrival: string; city: string; address: string; placeType: string; zones: PublishedZone[];
};
export type PublishedGuide =
  | { status: 'published'; locale: Locale; locales: Locale[]; content: PublishedContent; publishedAt: string }
  | { status: 'unavailable' };

function parseSensory(value: unknown): SensoryProfile {
  const source = record(value) ? value : {};
  return Object.fromEntries(sensoryChannels.map((channel) => {
    const level = source[channel];
    return [channel, sensoryLevels.includes(level as SensoryLevel) ? level : 'unknown'];
  })) as SensoryProfile;
}

export function parsePublishedContent(value: unknown): PublishedContent | null {
  if (!record(value) || !isLocale(String(value.locale)) || !Array.isArray(value.zones) || !slugPattern.test(String(value.slug))) return null;
  const zones: PublishedZone[] = value.zones.filter(record).map((zone) => {
    const photo = record(zone.photo) && typeof zone.photo.key === 'string' && zone.photo.key ? {
      key: zone.photo.key.slice(0, 180), alt: text(zone.photo.alt, 500), rights: text(zone.photo.rights, 500), photographedOn: text(zone.photo.photographedOn, 10),
    } : undefined;
    const fields = (Array.isArray(zone.fields) ? zone.fields : []).filter(record).map((field) => ({
      label: text(field.label, 80), kind: field.kind === 'yes_no' ? 'yes_no' as const : 'text' as const, value: text(field.value, 500),
      answer: (field.answer === 'yes' || field.answer === 'no' ? field.answer : 'unanswered') as PublishedZone['fields'][number]['answer'],
    })).filter((field) => field.label);
    return {
      id: text(zone.id, 36), title: text(zone.title, 160), description: text(zone.description), note: text(zone.note), next: text(zone.next),
      optional: zone.optional === true, sensory: parseSensory(zone.sensory), photo, fields,
    };
  });
  if (!zones.length) return null;
  return {
    locale: value.locale as Locale, slug: String(value.slug), name: text(value.name, 160), description: text(value.description), arrival: text(value.arrival),
    city: text(value.city, 160), address: text(value.address, 500), placeType: text(value.place_type, 30), zones,
  };
}

export function parsePublishedGuide(value: unknown): PublishedGuide | null {
  if (!record(value)) return null;
  if (value.status === 'unavailable') return { status: 'unavailable' };
  if (value.status !== 'published' || !isLocale(String(value.locale))) return null;
  const content = parsePublishedContent(value.content);
  const published = localeList(value.locales);
  if (!content || !published.length) return null;
  return { status: 'published', locale: value.locale as Locale, locales: published, content, publishedAt: text(value.publishedAt, 40) };
}

/** One entry in Explore. */
export type PublishedPlace = { slug: string; name: string; city: string; countryCode: string; placeType: string; locale: Locale; locales: Locale[]; steps: number };
export function parsePublishedPlaces(value: unknown): PublishedPlace[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).filter((item) => slugPattern.test(String(item.slug)) && isLocale(String(item.locale))).map((item) => ({
    slug: String(item.slug), name: text(item.name, 160), city: text(item.city, 160),
    countryCode: /^[A-Z]{2}$/.test(String(item.countryCode)) ? String(item.countryCode) : '', placeType: text(item.placeType, 30),
    locale: item.locale as Locale, locales: localeList(item.locales), steps: count(item.steps),
  }));
}

export type QrTarget = { status: 'published'; slug: string; locales: Locale[] } | { status: 'unavailable' };
export function parseQrTarget(value: unknown): QrTarget | null {
  if (!record(value)) return null;
  if (value.status === 'unavailable') return { status: 'unavailable' };
  const published = localeList(value.locales);
  if (value.status !== 'published' || !slugPattern.test(String(value.slug)) || !published.length) return null;
  return { status: 'published', slug: String(value.slug), locales: published };
}

/** The language a QR scan opens: the one asked for if it is published, then the phone's languages in order, then the first published. */
export function chooseLocale(published: Locale[], asked: string | null, acceptLanguage: string | null): Locale {
  if (asked && isLocale(asked) && published.includes(asked)) return asked;
  const preferred = (acceptLanguage || '').split(',')
    .map((part) => { const [tag, q] = part.trim().split(';q='); return { lang: tag.toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) || 0 }; })
    .filter((entry) => entry.q > 0).sort((a, b) => b.q - a.q).map((entry) => entry.lang);
  return (preferred.find((lang): lang is Locale => isLocale(lang) && published.includes(lang)) ?? published[0] ?? locales[0]);
}

/** The address of a published photo for visitors. */
export const guidePhotoUrl = (key: string) => `/api/guide-photos?key=${encodeURIComponent(key)}`;

/** A published guide in the shape the visitor's guide component reads. Nothing in it says "demo". */
export function guideFromPublished(content: PublishedContent): Guide {
  return {
    schemaVersion: 1, title: content.name, locale: content.locale, sourceLevel: 'venue_provided', isDemo: false,
    description: content.description, arrival: content.arrival,
    zones: content.zones.map((zone): Zone => ({
      id: zone.id, title: zone.title, description: zone.description, note: zone.note, next: zone.next, illustration: '', sensory: zone.sensory,
      optional: zone.optional,
      photo: zone.photo ? { id: zone.photo.key, alt: zone.photo.alt, rights: zone.photo.rights, photographedOn: zone.photo.photographedOn, src: guidePhotoUrl(zone.photo.key) } : undefined,
      fields: zone.fields.map((field) => ({ label: field.label, kind: field.kind, value: field.value, answer: field.answer })),
    })),
  };
}

const en = {
  // Visitors
  unavailableTitle: "This guide isn't available right now",
  unavailableBody: 'The organisation has taken it down for the moment. Try again later, or ask the staff on site.',
  backHome: 'Go to NERUMA',
  guideEyebrow: 'Pre-visit guide',
  provenanceBody: 'Provided by the venue · published {date}. NERUMA has not checked it on site. Conditions may change.',
  otherLanguage: 'This guide is not published in your language yet. You are reading it in {language}.',
  alsoIn: 'Also in:',
  maySkip: 'You may skip this step.',
  answerYes: 'Yes', answerNo: 'No',
  // Organisations
  publishTitle: 'Publish this guide?',
  publishIntro: 'Visitors see the saved version straight away, at its address and through its QR code.',
  publishLive: 'Goes live',
  publishWaits: 'Waits',
  waitNotStarted: 'not started',
  waitNoStep: 'no step with a name and a description',
  waitTooManySteps: 'more than 8 steps',
  publishLeftOut: '{n} step(s) left out: no name or description in this language',
  waitNoName: 'no location name',
  waitMissingText: '{n} step(s) without a name or description',
  waitMissingAlt: '{n} photo(s) without a description',
  waitKeepsPrevious: 'visitors keep the previous version',
  publishAgree: 'We have checked this guide and take responsibility for it.',
  publishConfirm: 'Publish now',
  publishNothing: 'No language is ready yet. A language needs the location name and at least one step with a name and a description, and every photo a description.',
  publishSaveFirst: 'Save your changes first, then publish.',
  publishing: 'Publishing…',
  publishDone: 'Published. Visitors see this version now.',
  publishError: 'The guide was not published. Nothing changed for visitors. Try again.',
  publishConflict: 'Someone saved a newer version. Open the latest saved version, check it, then publish.',
  publishAuth: 'Only an owner or admin can publish.',
  unpublish: 'Unpublish',
  unpublishTitle: 'Take this guide down?',
  unpublishBody: "Visitors and the QR code will see “This guide isn't available right now” until you publish again. Your draft, the address and the QR code stay.",
  unpublishDone: 'Taken down. Publish again whenever you are ready.',
  unpublishError: 'The guide is still published. Try again.',
  viewPublic: 'Open the public guide',
  attentionUnpublished: 'Changes not yet published: publish to update',
  publishedLanguages: 'Published in',
};
type PublishingCopy = { [K in keyof typeof en]: string };
const ro: PublishingCopy = {
  unavailableTitle: 'Acest ghid nu este disponibil acum',
  unavailableBody: 'Organizația l-a retras deocamdată. Încearcă mai târziu sau întreabă personalul de la fața locului.',
  backHome: 'Mergi la NERUMA',
  guideEyebrow: 'Ghid de pre-vizită',
  provenanceBody: 'Oferit de instituție · publicat {date}. NERUMA nu l-a verificat la fața locului. Condițiile se pot schimba.',
  otherLanguage: 'Acest ghid nu este publicat încă în limba ta. Îl citești în {language}.',
  alsoIn: 'Și în:',
  maySkip: 'Poți sări acest pas.',
  answerYes: 'Da', answerNo: 'Nu',
  publishTitle: 'Publici acest ghid?',
  publishIntro: 'Vizitatorii văd imediat versiunea salvată, la adresa ei și prin codul QR.',
  publishLive: 'Se publică',
  publishWaits: 'Așteaptă',
  waitNotStarted: 'neînceput',
  waitNoStep: 'niciun pas cu nume și descriere',
  waitTooManySteps: 'mai mult de 8 pași',
  publishLeftOut: '{n} pas(i) lăsat(i) deoparte: fără nume sau descriere în această limbă',
  waitNoName: 'fără numele locației',
  waitMissingText: '{n} pas(i) fără nume sau descriere',
  waitMissingAlt: '{n} fotografie(i) fără descriere',
  waitKeepsPrevious: 'vizitatorii păstrează versiunea anterioară',
  publishAgree: 'Am verificat acest ghid și ne asumăm responsabilitatea pentru el.',
  publishConfirm: 'Publică acum',
  publishNothing: 'Nicio limbă nu este gata. O limbă are nevoie de numele locației și de cel puțin un pas cu nume și descriere, iar fiecare fotografie de o descriere.',
  publishSaveFirst: 'Salvează mai întâi modificările, apoi publică.',
  publishing: 'Se publică…',
  publishDone: 'Publicat. Vizitatorii văd acum această versiune.',
  publishError: 'Ghidul nu a fost publicat. Nimic nu s-a schimbat pentru vizitatori. Încearcă din nou.',
  publishConflict: 'Cineva a salvat o versiune mai nouă. Deschide ultima versiune salvată, verific-o, apoi publică.',
  publishAuth: 'Doar un proprietar sau un administrator poate publica.',
  unpublish: 'Retrage publicarea',
  unpublishTitle: 'Retragi acest ghid?',
  unpublishBody: 'Vizitatorii și codul QR vor vedea „Acest ghid nu este disponibil acum” până când îl publici din nou. Draftul, adresa și codul QR rămân.',
  unpublishDone: 'Retras. Publică din nou oricând ești gata.',
  unpublishError: 'Ghidul este încă publicat. Încearcă din nou.',
  viewPublic: 'Deschide ghidul public',
  attentionUnpublished: 'Modificări nepublicate: publică pentru a actualiza',
  publishedLanguages: 'Publicat în',
};
const de: PublishingCopy = {
  unavailableTitle: 'Dieser Guide ist gerade nicht verfügbar',
  unavailableBody: 'Die Organisation hat ihn vorübergehend zurückgezogen. Versuchen Sie es später noch einmal oder fragen Sie das Personal vor Ort.',
  backHome: 'Zu NERUMA',
  guideEyebrow: 'Besuchsvorbereitung',
  provenanceBody: 'Angaben der Einrichtung · veröffentlicht am {date}. NERUMA hat sie nicht vor Ort geprüft. Bedingungen können sich ändern.',
  otherLanguage: 'Dieser Guide ist in Ihrer Sprache noch nicht veröffentlicht. Sie lesen ihn auf {language}.',
  alsoIn: 'Auch auf:',
  maySkip: 'Sie können diesen Schritt überspringen.',
  answerYes: 'Ja', answerNo: 'Nein',
  publishTitle: 'Diesen Guide veröffentlichen?',
  publishIntro: 'Besucherinnen und Besucher sehen die gespeicherte Version sofort, unter ihrer Adresse und über ihren QR-Code.',
  publishLive: 'Wird veröffentlicht',
  publishWaits: 'Wartet',
  waitNotStarted: 'nicht begonnen',
  waitNoStep: 'kein Schritt mit Name und Beschreibung',
  waitTooManySteps: 'mehr als 8 Schritte',
  publishLeftOut: '{n} Schritt(e) ausgelassen: kein Name oder keine Beschreibung in dieser Sprache',
  waitNoName: 'kein Name des Ortes',
  waitMissingText: '{n} Schritt(e) ohne Name oder Beschreibung',
  waitMissingAlt: '{n} Foto(s) ohne Beschreibung',
  waitKeepsPrevious: 'Besucher sehen weiter die vorherige Version',
  publishAgree: 'Wir haben diesen Guide geprüft und übernehmen die Verantwortung dafür.',
  publishConfirm: 'Jetzt veröffentlichen',
  publishNothing: 'Noch keine Sprache ist bereit. Eine Sprache braucht den Namen des Ortes und mindestens einen Schritt mit Name und Beschreibung, und jedes Foto eine Beschreibung.',
  publishSaveFirst: 'Speichern Sie zuerst Ihre Änderungen, dann veröffentlichen Sie.',
  publishing: 'Wird veröffentlicht…',
  publishDone: 'Veröffentlicht. Besucher sehen jetzt diese Version.',
  publishError: 'Der Guide wurde nicht veröffentlicht. Für Besucher hat sich nichts geändert. Versuchen Sie es erneut.',
  publishConflict: 'Jemand hat eine neuere Version gespeichert. Öffnen Sie die zuletzt gespeicherte Version, prüfen Sie sie und veröffentlichen Sie dann.',
  publishAuth: 'Nur Eigentümer oder Admins können veröffentlichen.',
  unpublish: 'Veröffentlichung zurückziehen',
  unpublishTitle: 'Diesen Guide zurückziehen?',
  unpublishBody: 'Besucher und der QR-Code sehen „Dieser Guide ist gerade nicht verfügbar“, bis Sie erneut veröffentlichen. Entwurf, Adresse und QR-Code bleiben.',
  unpublishDone: 'Zurückgezogen. Veröffentlichen Sie wieder, wann immer Sie bereit sind.',
  unpublishError: 'Der Guide ist noch veröffentlicht. Versuchen Sie es erneut.',
  viewPublic: 'Öffentlichen Guide öffnen',
  attentionUnpublished: 'Änderungen noch nicht veröffentlicht: zum Aktualisieren veröffentlichen',
  publishedLanguages: 'Veröffentlicht auf',
};
export const getPublishingCopy = (locale: Locale): PublishingCopy => ({ en, ro, de })[locale];
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** For a language that goes live: how many steps are left out of it because they have no words in it, or null when none. */
export function leftOutNote(check: LanguageCheck, locale: Locale): string | null {
  return check.ready && check.missingText > 0 ? fill(getPublishingCopy(locale).publishLeftOut, { n: check.missingText }) : null;
}

/** Why a language isn't ready yet, in the owner's words. */
export function waitingReasons(check: LanguageCheck, locale: Locale): string[] {
  const t = getPublishingCopy(locale);
  const reasons: string[] = [];
  if (!check.started) return [t.waitNotStarted];
  if (!check.hasName) reasons.push(t.waitNoName);
  if (check.includedSteps < 1) reasons.push(t.waitNoStep);
  if (check.steps > 8) reasons.push(t.waitTooManySteps);
  if (check.missingText) reasons.push(fill(t.waitMissingText, { n: check.missingText }));
  if (check.missingAlt) reasons.push(fill(t.waitMissingAlt, { n: check.missingAlt }));
  if (check.published) reasons.push(t.waitKeepsPrevious);
  return reasons;
}
