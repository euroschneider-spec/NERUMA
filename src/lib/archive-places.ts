import type { Locale } from './i18n';

// An organisation archives a location it no longer wants on its dashboard, and can bring it back (brief docs/briefs/2026-10-27-archive-locations.md).
// RO and DE are drafts that need a native speaker.
const en = {
  archive: 'Archive',
  archiveAria: 'Archive {name}',
  title: 'Archive {name}?',
  bodyDraft: 'It leaves your dashboard. You can restore it from the archive and keep working on it. Nothing is deleted.',
  bodyPublished: 'Its guide goes offline in every language, and its web address and QR code say the guide isn’t available. You can restore it from the archive as a draft and publish it again. Nothing is deleted.',
  confirm: 'Archive location',
  cancel: 'Keep it',
  heading: 'Archived locations',
  hint: 'Archived locations are offline and can’t be edited. Restore one to work on it again as a draft.',
  restore: 'Restore',
  restoreAria: 'Restore {name}',
  restored: '{name} is back on your dashboard as a draft.',
  error: 'This could not be done. Try again.',
};
type ArchiveCopy = typeof en;

const ro: ArchiveCopy = {
  archive: 'Arhivează',
  archiveAria: 'Arhivează {name}',
  title: 'Arhivezi {name}?',
  bodyDraft: 'Locația dispare din panoul tău. O poți restaura din arhivă și poți continua să lucrezi la ea. Nu se șterge nimic.',
  bodyPublished: 'Ghidul ei se oprește în toate limbile, iar adresa web și codul QR spun că ghidul nu este disponibil. O poți restaura din arhivă ca ciornă și o poți publica din nou. Nu se șterge nimic.',
  confirm: 'Arhivează locația',
  cancel: 'Păstreaz-o',
  heading: 'Locații arhivate',
  hint: 'Locațiile arhivate sunt offline și nu pot fi editate. Restaurează una pentru a lucra din nou la ea, ca ciornă.',
  restore: 'Restaurează',
  restoreAria: 'Restaurează {name}',
  restored: '{name} este înapoi în panoul tău, ca ciornă.',
  error: 'Nu s-a putut face. Încearcă din nou.',
};

const de: ArchiveCopy = {
  archive: 'Archivieren',
  archiveAria: '{name} archivieren',
  title: '{name} archivieren?',
  bodyDraft: 'Der Ort verschwindet aus Ihrer Übersicht. Sie können ihn aus dem Archiv wiederherstellen und weiterbearbeiten. Es wird nichts gelöscht.',
  bodyPublished: 'Der Guide geht in allen Sprachen offline, und Webadresse und QR-Code melden, dass der Guide nicht verfügbar ist. Sie können den Ort aus dem Archiv als Entwurf wiederherstellen und erneut veröffentlichen. Es wird nichts gelöscht.',
  confirm: 'Ort archivieren',
  cancel: 'Behalten',
  heading: 'Archivierte Orte',
  hint: 'Archivierte Orte sind offline und können nicht bearbeitet werden. Stellen Sie einen wieder her, um als Entwurf weiterzuarbeiten.',
  restore: 'Wiederherstellen',
  restoreAria: '{name} wiederherstellen',
  restored: '{name} ist als Entwurf zurück in Ihrer Übersicht.',
  error: 'Das ließ sich nicht ausführen. Versuchen Sie es erneut.',
};

export const getArchiveCopy = (locale: Locale): ArchiveCopy => ({ en, ro, de })[locale];
