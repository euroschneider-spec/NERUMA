import type { Locale } from './i18n';
import type { SensoryLevel, SensoryProfile } from './demo';

export const PHOTO_BUCKET = 'vianorae-private-photos';
export const MAX_ONLINE_PHOTO = 3 * 1024 * 1024;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sensoryChannels = ['sound', 'light', 'crowding', 'smell', 'temperature', 'visual'] as const;
export const sensoryLevels: SensoryLevel[] = ['unknown', 'low', 'moderate', 'high', 'variable'];
export const placeTypes = ['institution', 'museum', 'hotel', 'cultural', 'public_service', 'other'] as const;
export type OnlinePhoto = { id: string; storageKey: string; alt: string; rights: string; photographedOn: string };
export type OnlineZone = { id: string; title: string; description: string; note: string; next: string; type: string; optional: boolean; sensory: SensoryProfile; photo?: OnlinePhoto };
export type PlaceDraft = {
  id: string; revision: number; name: string; city: string; address: string; countryCode: string;
  placeType: typeof placeTypes[number]; description: string; arrivalInfo: string; zones: OnlineZone[];
};
export type PlaceSummary = { id: string; name: string; city: string; address: string; status: string; updatedAt: string; revision: number };
export function newZone(): OnlineZone {
  return { id: crypto.randomUUID(), title: '', description: '', note: '', next: '', type: 'visit-space', optional: false,
    sensory: { sound: 'unknown', light: 'unknown', crowding: 'unknown', smell: 'unknown', temperature: 'unknown', visual: 'unknown' } };
}
export function newPlace(): PlaceDraft {
  return { id: crypto.randomUUID(), revision: 0, name: '', city: '', address: '', countryCode: '', placeType: 'museum', description: '', arrivalInfo: '', zones: [newZone()] };
}
export const photoUrl = (key: string) => `/api/workspace/photos?key=${encodeURIComponent(key)}`;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max;
export function parsePlaceDraft(value: unknown, org: string): PlaceDraft | null {
  if (!record(value) || !text(value.id,36,36) || !uuidPattern.test(value.id) || !Number.isSafeInteger(value.revision)
    || Number(value.revision) < 0 || !text(value.name,1,160) || !text(value.city,1,160) || !text(value.address,0,500)
    || !text(value.countryCode,0,2) || (value.countryCode !== '' && !/^[A-Z]{2}$/.test(value.countryCode))
    || !placeTypes.includes(value.placeType as typeof placeTypes[number]) || !text(value.description,0,2000) || !text(value.arrivalInfo,0,2000)
    || !Array.isArray(value.zones) || value.zones.length < 1 || value.zones.length > 8) return null;
  const zones: OnlineZone[] = [];
  const seen = new Set<string>();
  for (const zone of value.zones) {
    if (!record(zone) || !text(zone.id,36,36) || !uuidPattern.test(zone.id) || seen.has(zone.id.toLowerCase())
      || !text(zone.title,1,160) || !text(zone.description,1,2000) || !text(zone.note,0,2000) || !text(zone.next,0,2000)
      || !text(zone.type,1,60) || typeof zone.optional !== 'boolean' || !record(zone.sensory)
      || sensoryChannels.some(channel => !sensoryLevels.includes((zone.sensory as Record<string, unknown>)[channel] as SensoryLevel))) return null;
    seen.add(zone.id.toLowerCase());
    let photo: OnlinePhoto | undefined;
    if (zone.photo != null) {
      const p = zone.photo;
      if (!record(p) || !text(p.id,36,36) || !uuidPattern.test(p.id) || !text(p.storageKey,1,180)
        || p.storageKey !== `${org.toLowerCase()}/${value.id.toLowerCase()}/${zone.id.toLowerCase()}/${p.id.toLowerCase()}.webp`
        || !text(p.alt,1,500) || !text(p.rights,1,500) || !text(p.photographedOn,10,10)
        || !/^\d{4}-\d{2}-\d{2}$/.test(p.photographedOn) || !Number.isFinite(Date.parse(p.photographedOn))
        || new Date(p.photographedOn).toISOString().slice(0,10) !== p.photographedOn
        || p.photographedOn > new Date().toISOString().slice(0,10)) return null;
      photo = { id:p.id.toLowerCase(), storageKey:p.storageKey, alt:p.alt.trim(), rights:p.rights.trim(), photographedOn:p.photographedOn };
    }
    zones.push({ id:zone.id.toLowerCase(), title:zone.title.trim(), description:zone.description.trim(), note:zone.note.trim(), next:zone.next.trim(),
      type:zone.type.trim(), optional:zone.optional, sensory:zone.sensory as SensoryProfile, photo });
  }
  return { id:value.id.toLowerCase(), revision:Number(value.revision), name:value.name.trim(), city:value.city.trim(), address:value.address.trim(), countryCode:value.countryCode,
    placeType:value.placeType as PlaceDraft['placeType'], description:value.description.trim(), arrivalInfo:value.arrivalInfo.trim(), zones };
}

const en = {
  dashboard: 'Dashboard', locationsHeading: 'Locations', roleOwner: 'Owner', roleAdmin: 'Admin',
  statusDraft: 'Draft', statusPublished: 'Published', addressMissing: 'No address yet', sidebarLabel: 'Organisation',
  workspace: 'Organisation workspace', newPlace: 'Create a location', edit: 'Edit draft', empty: 'No locations yet. Create your first location.',
  location: 'Location name', city: 'City', address: 'Address', country: 'Country code (optional)', countryHint: 'Two letters, for example RO or DE.',
  kind: 'Location type', summary: 'Short description', arrival: 'Arrival information', addZone: 'Add a zone', removeZone: 'Remove this step',
  up: 'Move earlier', down: 'Move later', optional: 'Visitors may skip this step',
  save: 'Save online', saved: 'Draft saved online. You can continue from another device.', saving: 'Saving…',
  unsaved: 'You have unsaved changes.', error: 'Your draft was not saved. Your changes are still on this page, so nothing is lost. Try saving again.',
  invalid: 'Complete the required fields and photograph details.', conflict: 'Someone saved a newer version. Your changes have not been overwritten. Open the latest saved version before continuing.',
  reload: 'Open latest saved version', preview: 'Preview',
  boundary: 'This is a private organisation draft. Saving does not publish it.',
  editingIn: 'Editing in', moreInfo: 'More information', kindOther: 'Other',
  publish: 'Publish', publishSoon: 'Publishing is not available yet. When it is, this turns your saved draft into the public guide.',
  shared: 'Photos and sensory levels are shared by all languages. Names, descriptions and visit steps are saved separately for each language.',
  language: 'Content language', missing: 'A translation is missing. Complete the text in this language before saving.',
  readyLater: 'The online workspace is being prepared. Your organisation account is available.',
  forbidden: 'You need an owner or admin role to edit locations.',
  photoHint: `JPEG, PNG or WebP · up to ${MAX_ONLINE_PHOTO / 1024 / 1024} MB. Images are resized.`,
  photoPrivacy: 'Images are saved privately for your organisation. Original location metadata is removed.',
  saveFirst: 'Save this location and zone before uploading a photograph.',
  photoAdded: 'Photograph uploaded privately. Complete its details and save the draft to attach it.',
  photoError: 'The photograph could not be uploaded. The previous saved photograph is unchanged.',
  photoPreview: 'Zone photograph', removePhoto: 'Detach photograph from draft',
  noPhoto: 'No photograph attached.', choosePhoto: 'Upload image', photoAttached: 'Photograph attached.', login: 'Sign in again', draft: 'Saved organisation draft',
  retained: 'Detaching or replacing a photograph removes it from the draft; the private file is retained.',
  discard: 'You have unsaved changes. Leave this page and discard them?',
};
type WorkspaceCopy = { [K in keyof typeof en]: string };
const ro: WorkspaceCopy = {
  dashboard:'Panou', locationsHeading:'Locații', roleOwner:'Proprietar', roleAdmin:'Administrator',
  statusDraft:'Ciornă', statusPublished:'Publicat', addressMissing:'Fără adresă încă', sidebarLabel:'Organizație',
  workspace:'Spațiul organizației', newPlace:'Creează o locație', edit:'Editează draftul', empty:'Nu ai încă locații. Creează prima locație.',
  location:'Numele locației', city:'Oraș', address:'Adresă', country:'Codul țării (opțional)', countryHint:'Două litere, de exemplu RO sau DE.',
  kind:'Tipul locației', summary:'Descriere scurtă', arrival:'Informații despre sosire', addZone:'Adaugă o zonă', removeZone:'Scoate acest pas',
  up:'Mută mai devreme', down:'Mută mai târziu', optional:'Vizitatorii pot sări acest pas',
  save:'Salvează online', saved:'Draft salvat online. Poți continua de pe alt dispozitiv.', saving:'Se salvează…', unsaved:'Ai modificări nesalvate.',
  error:'Draftul nu a fost salvat. Modificările tale sunt încă pe această pagină, deci nu s-a pierdut nimic. Încearcă să salvezi din nou.', invalid:'Completează câmpurile obligatorii și detaliile fotografiilor.',
  conflict:'A fost salvată o versiune mai nouă. Modificările tale nu au fost suprascrise. Deschide ultima versiune salvată înainte să continui.',
  reload:'Deschide ultima versiune salvată', preview:'Previzualizează', boundary:'Acesta este un draft privat al organizației. Salvarea nu înseamnă publicare.',
  editingIn:'Editezi în', moreInfo:'Mai multe informații', kindOther:'Altceva',
  publish:'Publică', publishSoon:'Publicarea nu este disponibilă încă. Când va fi, transformă draftul salvat în ghidul public.',
  shared:'Fotografiile și nivelurile senzoriale sunt comune tuturor limbilor. Numele, descrierile și pașii vizitei se salvează separat pentru fiecare limbă.',
  language:'Limba conținutului', missing:'Lipsește o traducere. Completează textul în această limbă înainte de salvare.',
  readyLater:'Spațiul online este în pregătire. Contul organizației este disponibil.', forbidden:'Ai nevoie de rolul de proprietar sau administrator pentru a edita locații.',
  photoHint: `JPEG, PNG sau WebP · maximum ${MAX_ONLINE_PHOTO / 1024 / 1024} MB. Imaginile sunt redimensionate.`,
  photoPrivacy:'Imaginile sunt salvate privat pentru organizație. Metadatele originale de localizare sunt eliminate.',
  saveFirst:'Salvează locația și zona înainte să încarci fotografia.', photoAdded:'Fotografie încărcată privat. Completează detaliile și salvează draftul pentru a o asocia.',
  photoError:'Fotografia nu a putut fi încărcată. Fotografia salvată anterior nu a fost modificată.', photoPreview:'Fotografia zonei', removePhoto:'Detașează fotografia din draft',
  noPhoto:'Nu este asociată nicio fotografie.', choosePhoto:'Încarcă imaginea', photoAttached:'Fotografie asociată.', login:'Autentifică-te din nou', draft:'Draft salvat al organizației',
  retained:'Detașarea sau înlocuirea unei fotografii o scoate din draft; fișierul privat este păstrat.',
  discard:'Ai modificări nesalvate. Părăsești pagina și renunți la ele?',
};
const de: WorkspaceCopy = {
  dashboard:'Übersicht', locationsHeading:'Standorte', roleOwner:'Eigentümer', roleAdmin:'Admin',
  statusDraft:'Entwurf', statusPublished:'Veröffentlicht', addressMissing:'Noch keine Adresse', sidebarLabel:'Organisation',
  workspace:'Arbeitsbereich der Organisation', newPlace:'Ort erstellen', edit:'Entwurf bearbeiten', empty:'Noch keine Orte. Erstellen Sie Ihren ersten Ort.',
  location:'Name des Ortes', city:'Stadt', address:'Adresse', country:'Ländercode (optional)', countryHint:'Zwei Buchstaben, zum Beispiel RO oder DE.',
  kind:'Art des Ortes', summary:'Kurzbeschreibung', arrival:'Informationen zur Ankunft', addZone:'Bereich hinzufügen', removeZone:'Diesen Schritt entfernen',
  up:'Nach vorne', down:'Nach hinten', optional:'Besucher können diesen Schritt überspringen', save:'Online speichern', saved:'Entwurf online gespeichert. Sie können auf einem anderen Gerät fortfahren.',
  saving:'Wird gespeichert…', unsaved:'Es gibt ungespeicherte Änderungen.', error:'Der Entwurf wurde nicht gespeichert. Ihre Änderungen sind noch auf dieser Seite, es geht also nichts verloren. Versuchen Sie erneut zu speichern.',
  invalid:'Ergänzen Sie die Pflichtfelder und Fotoangaben.', conflict:'Eine neuere Version wurde gespeichert. Ihre Änderungen wurden nicht überschrieben. Öffnen Sie zuerst die zuletzt gespeicherte Version.',
  reload:'Zuletzt gespeicherte Version öffnen', preview:'Vorschau', boundary:'Dies ist ein privater Organisationsentwurf. Speichern veröffentlicht ihn nicht.',
  editingIn:'Bearbeitung in', moreInfo:'Weitere Informationen', kindOther:'Sonstiges',
  publish:'Veröffentlichen', publishSoon:'Veröffentlichen ist noch nicht verfügbar. Dann wird Ihr gespeicherter Entwurf zum öffentlichen Guide.',
  shared:'Fotos und sensorische Stufen gelten für alle Sprachen. Namen, Beschreibungen und Besuchsschritte werden je Sprache gespeichert.',
  language:'Sprache des Inhalts', missing:'Eine Übersetzung fehlt. Ergänzen Sie den Text in dieser Sprache.', readyLater:'Der Online-Arbeitsbereich wird vorbereitet. Ihr Organisationskonto ist verfügbar.',
  forbidden:'Zum Bearbeiten benötigen Sie die Rolle Eigentümer oder Administrator.',
  photoHint: `JPEG, PNG oder WebP · bis ${MAX_ONLINE_PHOTO / 1024 / 1024} MB. Bilder werden verkleinert.`,
  photoPrivacy:'Bilder werden privat für Ihre Organisation gespeichert. Ursprüngliche Standort-Metadaten werden entfernt.',
  saveFirst:'Speichern Sie Ort und Bereich, bevor Sie ein Foto hochladen.', photoAdded:'Foto privat hochgeladen. Ergänzen Sie die Angaben und speichern Sie den Entwurf, um es zuzuordnen.',
  photoError:'Das Foto konnte nicht hochgeladen werden. Das zuvor gespeicherte Foto bleibt unverändert.', photoPreview:'Foto des Bereichs', removePhoto:'Foto vom Entwurf lösen',
  noPhoto:'Kein Foto zugeordnet.', choosePhoto:'Bild hochladen', photoAttached:'Foto zugeordnet.', login:'Erneut anmelden', draft:'Gespeicherter Organisationsentwurf', retained:'Lösen oder Ersetzen entfernt das Foto aus dem Entwurf; die private Datei bleibt gespeichert.',
  discard:'Es gibt ungespeicherte Änderungen. Möchten Sie diese Seite verlassen und die Änderungen verwerfen?',
};
export const getWorkspaceCopy = (locale: Locale): WorkspaceCopy => ({ en, ro, de })[locale];
