import type { Locale } from './i18n';

// A platform administrator visits an organisation (brief docs/briefs/2026-10-26-superadmin-visits-organisation.md): the words on the
// strip and the take-down dialog, and the change log the organisation reads. RO and DE are drafts that need a native speaker.

export type ChangeAction = 'edit' | 'add' | 'take_down' | 'enable' | 'disable';
export type ChangeLine = { field: string; from: unknown; to: unknown; hasFrom: boolean };
export type ChangeLogEntry = { id: number; at: string; entity: string; placeName: string; action: ChangeAction; by: string | null; changes: ChangeLine[] };

const actions: ChangeAction[] = ['edit', 'add', 'take_down', 'enable', 'disable'];
const shown = 400;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** The change log as the database returns it (`organisation_change_log`), or null when it isn't a list of entries. */
export function parseChangeLog(value: unknown): ChangeLogEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: ChangeLogEntry[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== 'number' || typeof row.at !== 'string' || typeof row.entity !== 'string'
      || !actions.includes(row.action as ChangeAction) || !isRecord(row.changes)) return null;
    entries.push({
      id: row.id,
      at: row.at,
      entity: row.entity,
      placeName: typeof row.place_name === 'string' ? row.place_name : '',
      action: row.action as ChangeAction,
      by: typeof row.by === 'string' ? row.by : null,
      changes: Object.entries(row.changes).flatMap(([field, change]) => (isRecord(change) ? [{ field, from: change.from, to: change.to, hasFrom: 'from' in change }] : [])),
    });
  }
  return entries;
}

/** One value of a change as a person reads it: text as it is, a language-by-language object as "en: …; ro: …", nothing as `empty`. */
export function formatChangeValue(value: unknown, empty: string): string {
  let text: string;
  if (value === null || value === undefined) text = '';
  else if (typeof value === 'string') text = value.trim();
  else if (Array.isArray(value)) text = value.map((item) => String(item)).join(', ');
  else if (isRecord(value)) text = Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join('; ');
  else text = String(value);
  if (!text) return empty;
  return text.length > shown ? `${text.slice(0, shown)}…` : text;
}

const en = {
  stripTitle: 'Platform administrator visit',
  stripBody: 'You are viewing {name} as a platform administrator. You can correct what is there and take a guide down. You can’t publish or add anything. Every change is recorded and the organisation sees it.',
  leave: 'Leave visit',
  backToAdmin: 'Back to administration',
  roleLabel: 'Platform administrator (visiting)',
  takeDown: 'Take down',
  takeDownTitle: 'Take this guide down as a platform administrator?',
  takeDownBody: 'Visitors and the QR code will see “This guide isn’t available right now” at once. The organisation sees this in its change log and publishes again when it is ready.',
  takeDownConfirm: 'Take down as platform administrator',
  takeDownDone: 'Taken down. The organisation can publish again when it is ready.',
  logNav: 'Change log',
  logTitle: 'Change log',
  logIntro: 'What NERUMA support changed in your guides, and when. Nothing listed here was changed by your own team.',
  logEmpty: 'NERUMA support has not changed anything.',
  logUnavailable: 'The change log could not be loaded. Reload the page.',
  logBy: 'NERUMA support',
  logLocation: 'Location: {name}',
  empty: '(empty)',
  before: 'Before',
  after: 'After',
  actions: { edit: 'Changed', add: 'Added', take_down: 'Took the guide down', enable: 'Switched on', disable: 'Switched off' } as Record<ChangeAction, string>,
  entities: {
    places: 'Location', place_translations: 'Location text', zones: 'Step', zone_translations: 'Step text', zone_fields: 'Own field',
    zone_field_translations: 'Own field text', sensory_profiles: 'Sensory profile', media_assets: 'Photo', explore: 'Explore listing',
  } as Record<string, string>,
  fields: {
    name: 'Name', short_description: 'Short description', arrival_info: 'Arrival information', title: 'Title', description: 'Description',
    useful_note: 'Note', next_step: 'What comes next', label: 'Label', value: 'Value', answer: 'Answer', alt_text: 'Photo description',
    rights: 'Photo rights', photographed_on: 'Date photographed', active: 'Shown', status: 'Status', city: 'City', address: 'Address',
    country_code: 'Country', place_type: 'Type', type: 'Type', sort_order: 'Order', hidden_fields: 'Removed fields', sound_level: 'Sound',
    light_level: 'Light', crowding_level: 'Crowding', smell_level: 'Smell', temperature_level: 'Temperature',
    visual_complexity_level: 'Visual complexity', slug: 'Address', storage_key: 'File', kind: 'Kind',
  } as Record<string, string>,
};
type VisitCopy = typeof en;

const ro: VisitCopy = {
  stripTitle: 'Vizită de administrator al platformei',
  stripBody: 'Vizualizezi {name} ca administrator al platformei. Poți corecta ce există și retrage un ghid. Nu poți publica sau adăuga nimic. Fiecare modificare este înregistrată, iar organizația o vede.',
  leave: 'Părăsește vizita',
  backToAdmin: 'Înapoi la administrare',
  roleLabel: 'Administrator al platformei (în vizită)',
  takeDown: 'Retrage',
  takeDownTitle: 'Retragi acest ghid ca administrator al platformei?',
  takeDownBody: 'Vizitatorii și codul QR vor vedea imediat „Acest ghid nu este disponibil acum”. Organizația vede acest lucru în jurnalul de modificări și publică din nou când este gata.',
  takeDownConfirm: 'Retrage ca administrator al platformei',
  takeDownDone: 'Retras. Organizația poate publica din nou când este gata.',
  logNav: 'Jurnal de modificări',
  logTitle: 'Jurnal de modificări',
  logIntro: 'Ce a modificat suportul NERUMA în ghidurile dumneavoastră și când. Nimic din ce este listat aici nu a fost modificat de echipa dumneavoastră.',
  logEmpty: 'Suportul NERUMA nu a modificat nimic.',
  logUnavailable: 'Jurnalul de modificări nu a putut fi încărcat. Reîncărcați pagina.',
  logBy: 'Suport NERUMA',
  logLocation: 'Locație: {name}',
  empty: '(gol)',
  before: 'Înainte',
  after: 'După',
  actions: { edit: 'Modificat', add: 'Adăugat', take_down: 'A retras ghidul', enable: 'Activat', disable: 'Dezactivat' },
  entities: {
    places: 'Locație', place_translations: 'Text locație', zones: 'Pas', zone_translations: 'Text pas', zone_fields: 'Câmp propriu',
    zone_field_translations: 'Text câmp propriu', sensory_profiles: 'Profil senzorial', media_assets: 'Fotografie', explore: 'Listare în Explorează',
  },
  fields: {
    name: 'Nume', short_description: 'Descriere scurtă', arrival_info: 'Informații despre sosire', title: 'Titlu', description: 'Descriere',
    useful_note: 'Notă', next_step: 'Ce urmează', label: 'Etichetă', value: 'Valoare', answer: 'Răspuns', alt_text: 'Descrierea fotografiei',
    rights: 'Drepturile fotografiei', photographed_on: 'Data fotografiei', active: 'Afișat', status: 'Stare', city: 'Oraș', address: 'Adresă',
    country_code: 'Țară', place_type: 'Tip', type: 'Tip', sort_order: 'Ordine', hidden_fields: 'Câmpuri eliminate', sound_level: 'Sunet',
    light_level: 'Lumină', crowding_level: 'Aglomerație', smell_level: 'Miros', temperature_level: 'Temperatură',
    visual_complexity_level: 'Complexitate vizuală', slug: 'Adresă', storage_key: 'Fișier', kind: 'Fel',
  },
};

const de: VisitCopy = {
  stripTitle: 'Besuch als Plattform-Verwalter',
  stripBody: 'Sie sehen {name} als Plattform-Verwalter. Sie können Vorhandenes korrigieren und einen Guide zurückziehen. Veröffentlichen oder Hinzufügen ist nicht möglich. Jede Änderung wird festgehalten und die Organisation sieht sie.',
  leave: 'Besuch beenden',
  backToAdmin: 'Zurück zur Verwaltung',
  roleLabel: 'Plattform-Verwalter (zu Besuch)',
  takeDown: 'Zurückziehen',
  takeDownTitle: 'Diesen Guide als Plattform-Verwalter zurückziehen?',
  takeDownBody: 'Besucher und der QR-Code sehen sofort „Dieser Guide ist gerade nicht verfügbar“. Die Organisation sieht das in ihrem Änderungsprotokoll und veröffentlicht erneut, wenn sie bereit ist.',
  takeDownConfirm: 'Als Plattform-Verwalter zurückziehen',
  takeDownDone: 'Zurückgezogen. Die Organisation kann wieder veröffentlichen, wenn sie bereit ist.',
  logNav: 'Änderungsprotokoll',
  logTitle: 'Änderungsprotokoll',
  logIntro: 'Was das NERUMA-Support-Team in Ihren Guides geändert hat, und wann. Nichts hier Aufgeführtes wurde von Ihrem eigenen Team geändert.',
  logEmpty: 'Das NERUMA-Support-Team hat nichts geändert.',
  logUnavailable: 'Das Änderungsprotokoll konnte nicht geladen werden. Laden Sie die Seite neu.',
  logBy: 'NERUMA-Support',
  logLocation: 'Standort: {name}',
  empty: '(leer)',
  before: 'Vorher',
  after: 'Nachher',
  actions: { edit: 'Geändert', add: 'Hinzugefügt', take_down: 'Guide zurückgezogen', enable: 'Eingeschaltet', disable: 'Ausgeschaltet' },
  entities: {
    places: 'Standort', place_translations: 'Standorttext', zones: 'Schritt', zone_translations: 'Schritttext', zone_fields: 'Eigenes Feld',
    zone_field_translations: 'Text des eigenen Felds', sensory_profiles: 'Sensorisches Profil', media_assets: 'Foto', explore: 'Auflistung in Entdecken',
  },
  fields: {
    name: 'Name', short_description: 'Kurzbeschreibung', arrival_info: 'Hinweise zur Ankunft', title: 'Titel', description: 'Beschreibung',
    useful_note: 'Hinweis', next_step: 'Wie es weitergeht', label: 'Bezeichnung', value: 'Wert', answer: 'Antwort', alt_text: 'Fotobeschreibung',
    rights: 'Rechte am Foto', photographed_on: 'Aufnahmedatum', active: 'Angezeigt', status: 'Status', city: 'Stadt', address: 'Adresse',
    country_code: 'Land', place_type: 'Art', type: 'Art', sort_order: 'Reihenfolge', hidden_fields: 'Entfernte Felder', sound_level: 'Geräusche',
    light_level: 'Licht', crowding_level: 'Andrang', smell_level: 'Geruch', temperature_level: 'Temperatur',
    visual_complexity_level: 'Visuelle Komplexität', slug: 'Adresse', storage_key: 'Datei', kind: 'Art',
  },
};

export const getVisitCopy = (locale: Locale): VisitCopy => ({ en, ro, de })[locale];
