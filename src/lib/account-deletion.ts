import { longDate, type Locale } from './i18n';

export { longDate };

// Deleting an account (brief docs/briefs/2026-10-13-delete-account.md): what the person and the administrator read.

export const GRACE_DAYS = 30;
export const EXPORT_LINK_DAYS = 7;


export const deletionDay = (from = new Date()) => new Date(from.getTime() + GRACE_DAYS * 86400000);

export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));

export type PendingDeletion = { userId: string; email: string; requestedAt: string; deleteAfter: string; due: boolean; byAdministrator: boolean; organisations: { id: string; name: string }[] };
export type OrganisationHold = { id: string; name: string; heldSince: string; deleteAfter: string; due: boolean; erasedAt: string | null; formerOwnerEmail: string | null };

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function parsePendingDeletions(value: unknown): PendingDeletion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (!text(r.user_id) || !text(r.delete_after)) return [];
    const organisations = Array.isArray(r.organisations) ? r.organisations.flatMap((org) => (org && typeof org === 'object' && text((org as Record<string, unknown>).id) ? [{ id: text((org as Record<string, unknown>).id), name: text((org as Record<string, unknown>).name) }] : [])) : [];
    return [{ userId: text(r.user_id), email: text(r.email), requestedAt: text(r.requested_at), deleteAfter: text(r.delete_after), due: r.due === true, byAdministrator: r.by_administrator === true, organisations }];
  });
}

export function parseOrganisationHolds(value: unknown): OrganisationHold[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (!text(r.id) || !text(r.delete_after)) return [];
    return [{ id: text(r.id), name: text(r.name), heldSince: text(r.held_since), deleteAfter: text(r.delete_after), due: r.due === true, erasedAt: text(r.erased_at) || null, formerOwnerEmail: text(r.former_owner_email) || null }];
  });
}

const copy = {
  en: {
    sectionTitle: 'Delete my account',
    sectionIntro: 'Your account is locked at once and deleted completely 30 days later. You get a copy of your data first.',
    sectionLink: 'Delete my account…',
    title: 'Delete my account',
    intro: 'Before anything is deleted, you get a copy of everything NERUMA holds about you.',
    whatHappens: 'What happens',
    now: 'Now: your account is locked. You can’t sign in any more, and the guides you published go down.',
    held: 'Your organisation “{name}” has no other owner. It is hidden now, and deleted with its guides and photos on {date}, unless NERUMA hands it to a colleague before then. Its QR codes keep saying the guide isn’t available.',
    onDate: 'On {date}: everything about you is deleted completely: your account, your request and its documents, its review history, the guides you published and your name in the change history.',
    reports: 'Problem reports you sent stay, without your name or email.',
    restore: 'Changed your mind? Write to NERUMA before {date}, and we can restore your account.',
    password: 'Your password',
    code: '6-digit code from your authenticator app',
    understand: 'I understand that my account will be deleted completely on {date}.',
    submit: 'Delete my account',
    working: 'Preparing your data…',
    wrongPassword: 'That password is not right. Nothing was deleted.',
    wrongCode: 'That code didn’t work. Check the time on your phone and try the new code. Nothing was deleted.',
    codeNeeded: 'Enter the 6-digit code from your authenticator app.',
    mustConfirm: 'Tick the box to confirm.',
    error: 'Nothing was deleted: your data could not be prepared. Try again in a few minutes.',
    doneTitle: 'Your account is locked',
    doneDate: 'It will be deleted completely on {date}.',
    download: 'Download your data',
    downloadNote: 'The link works for 7 days and needs no sign-in. Keep it private: anyone who has it can download your data.',
    doneRestore: 'Changed your mind? Write to NERUMA before {date}.',
    lostLink: 'If you didn’t download your data, write to NERUMA before {date}: an administrator can send it to you.',
    unavailable: 'Deleting an account from here is being set up. Write to NERUMA if you want your account deleted now.',
    banned: 'This account is being deleted. To restore it, write to NERUMA before the date in your confirmation.',
    adminTitle: 'Account deletions',
    adminIntro: 'An account is locked when its deletion starts and erased after 30 days. Restore it within the 30 days if the person changes their mind. Before acting on a request by email, check that it came from the account’s own address.',
    pending: 'In progress',
    none: 'No deletion in progress.',
    requested: 'Asked on {date}',
    dueOn: 'Can be erased from {date}',
    dueNow: 'Due: can be erased now',
    byAdmin: 'Started by an administrator',
    bySelf: 'Started by the person',
    alsoHeld: 'Organisation hidden with it: {names}',
    restoreButton: 'Restore',
    restoreTitle: 'Restore this account?',
    restoreBody: 'The account is unlocked, its guides come back, and its organisation is shown again.',
    erase: 'Erase now',
    eraseTitle: 'Erase this account for good?',
    eraseBody: 'Everything about this person is deleted, including their documents. This cannot be undone.',
    holds: 'Hidden organisations',
    holdsNone: 'No organisation is hidden.',
    eraseOrganisation: 'Erase organisation',
    eraseOrganisationTitle: 'Erase this organisation for good?',
    eraseOrganisationBody: 'Its guides, steps and photos are deleted. Its QR codes keep saying the guide isn’t available. This cannot be undone.',
    erasedOn: 'Erased on {date}',
    formerOwner: 'Former owner: {email}',
    start: 'Start a deletion for someone who wrote in',
    startHint: 'First check that the request came from the account’s own email address, and download their data to send it to them.',
    email: 'Email of the account',
    downloadTheirs: 'Download their data',
    startButton: 'Start deletion',
    startTitle: 'Start deleting this account?',
    startBody: 'The account is locked at once, and erased in 30 days.',
    started: 'Deletion started. The account can be erased from {date}.',
    noAccount: 'There is no account with that email.',
    cancel: 'Cancel',
    adminError: 'That didn’t work. Reload the page and try again.',
    senderDeleted: 'Sender’s account deleted',
    senderPending: 'Sender’s account is being deleted',
    deleteReport: 'Delete report',
    deleteReportTitle: 'Delete this report?',
    deleteReportBody: 'The report and its history are deleted. This cannot be undone.',
    readmeTitle: 'NERUMA: your data',
    readmeExported: 'Exported on {date}.',
    readmeContents: 'This archive holds everything NERUMA held about your account: data.json (all of it, readable in any text editor), documents/ (the files you uploaded to prove your mandate) and photos/ (the photos of an organisation you owned alone).',
    readmeDeletion: 'You asked to delete your account on {requested}. It is locked now and will be deleted completely on {date}. Problem reports you sent stay, without your name or email.',
    readmeRestore: 'Changed your mind? Write to NERUMA before {date}.',
  },
  ro: {
    sectionTitle: 'Ștergerea contului',
    sectionIntro: 'Contul este blocat imediat și șters complet după 30 de zile. Mai întâi primiți o copie a datelor dumneavoastră.',
    sectionLink: 'Ștergeți contul…',
    title: 'Ștergeți contul',
    intro: 'Înainte să se șteargă ceva, primiți o copie a tuturor datelor pe care NERUMA le are despre dumneavoastră.',
    whatHappens: 'Ce se întâmplă',
    now: 'Acum: contul este blocat. Nu vă mai puteți autentifica, iar ghidurile publicate de dumneavoastră nu mai sunt disponibile.',
    held: 'Organizația „{name}” nu are alt proprietar. Este ascunsă acum și ștearsă împreună cu ghidurile și fotografiile ei pe {date}, dacă NERUMA nu o predă unui coleg până atunci. Codurile QR vor arăta în continuare că ghidul nu este disponibil.',
    onDate: 'Pe {date}: totul despre dumneavoastră este șters complet: contul, cererea și documentele ei, istoricul verificării, ghidurile publicate de dumneavoastră și numele din istoricul modificărilor.',
    reports: 'Raportările de probleme trimise rămân, fără numele și adresa dumneavoastră de email.',
    restore: 'V-ați răzgândit? Scrieți-ne înainte de {date} și vă putem restabili contul.',
    password: 'Parola dumneavoastră',
    code: 'Codul de 6 cifre din aplicația de autentificare',
    understand: 'Înțeleg că acest cont va fi șters complet pe {date}.',
    submit: 'Ștergeți contul',
    working: 'Se pregătesc datele…',
    wrongPassword: 'Parola nu este corectă. Nu s-a șters nimic.',
    wrongCode: 'Codul nu este corect. Verificați ora de pe telefon și încercați codul nou. Nu s-a șters nimic.',
    codeNeeded: 'Introduceți codul de 6 cifre din aplicația de autentificare.',
    mustConfirm: 'Bifați caseta pentru a confirma.',
    error: 'Nu s-a șters nimic: datele nu au putut fi pregătite. Încercați din nou peste câteva minute.',
    doneTitle: 'Contul este blocat',
    doneDate: 'Va fi șters complet pe {date}.',
    download: 'Descărcați datele',
    downloadNote: 'Linkul funcționează 7 zile și nu cere autentificare. Păstrați-l privat: oricine îl are vă poate descărca datele.',
    doneRestore: 'V-ați răzgândit? Scrieți-ne înainte de {date}.',
    lostLink: 'Dacă nu ați descărcat datele, scrieți-ne înainte de {date}: un administrator vi le poate trimite.',
    unavailable: 'Ștergerea contului de aici este în curs de pregătire. Scrieți-ne dacă doriți să vă ștergem contul acum.',
    banned: 'Acest cont este în curs de ștergere. Pentru a-l restabili, scrieți-ne înainte de data din confirmare.',
    adminTitle: 'Ștergeri de conturi',
    adminIntro: 'Un cont este blocat când începe ștergerea și eliminat după 30 de zile. Restabiliți-l în cele 30 de zile dacă persoana se răzgândește. Înainte de a da curs unei cereri primite prin email, verificați că a venit de la adresa contului.',
    pending: 'În curs',
    none: 'Nicio ștergere în curs.',
    requested: 'Cerută pe {date}',
    dueOn: 'Poate fi eliminat de la {date}',
    dueNow: 'Scadent: poate fi eliminat acum',
    byAdmin: 'Pornită de un administrator',
    bySelf: 'Pornită de persoană',
    alsoHeld: 'Organizație ascunsă odată cu el: {names}',
    restoreButton: 'Restabiliți',
    restoreTitle: 'Restabiliți acest cont?',
    restoreBody: 'Contul este deblocat, ghidurile revin, iar organizația este afișată din nou.',
    erase: 'Eliminați acum',
    eraseTitle: 'Eliminați definitiv acest cont?',
    eraseBody: 'Tot ce privește această persoană este șters, inclusiv documentele. Nu se poate anula.',
    holds: 'Organizații ascunse',
    holdsNone: 'Nicio organizație nu este ascunsă.',
    eraseOrganisation: 'Eliminați organizația',
    eraseOrganisationTitle: 'Eliminați definitiv această organizație?',
    eraseOrganisationBody: 'Ghidurile, pașii și fotografiile ei sunt șterse. Codurile QR vor arăta în continuare că ghidul nu este disponibil. Nu se poate anula.',
    erasedOn: 'Eliminată pe {date}',
    formerOwner: 'Fost proprietar: {email}',
    start: 'Porniți o ștergere pentru cineva care v-a scris',
    startHint: 'Verificați mai întâi că cererea a venit de la adresa de email a contului și descărcați datele persoanei ca să i le trimiteți.',
    email: 'Emailul contului',
    downloadTheirs: 'Descărcați datele persoanei',
    startButton: 'Porniți ștergerea',
    startTitle: 'Porniți ștergerea acestui cont?',
    startBody: 'Contul este blocat imediat și eliminat peste 30 de zile.',
    started: 'Ștergerea a pornit. Contul poate fi eliminat de la {date}.',
    noAccount: 'Nu există niciun cont cu acest email.',
    cancel: 'Anulați',
    adminError: 'Nu a funcționat. Reîncărcați pagina și încercați din nou.',
    senderDeleted: 'Contul expeditorului a fost șters',
    senderPending: 'Contul expeditorului este în curs de ștergere',
    deleteReport: 'Ștergeți raportarea',
    deleteReportTitle: 'Ștergeți această raportare?',
    deleteReportBody: 'Raportarea și istoricul ei sunt șterse. Nu se poate anula.',
    readmeTitle: 'NERUMA: datele dumneavoastră',
    readmeExported: 'Exportate pe {date}.',
    readmeContents: 'Această arhivă conține tot ce NERUMA a păstrat despre contul dumneavoastră: data.json (toate datele, citibile în orice editor de text), documents/ (fișierele încărcate ca dovadă a mandatului) și photos/ (fotografiile unei organizații pe care o dețineați singur).',
    readmeDeletion: 'Ați cerut ștergerea contului pe {requested}. Este blocat acum și va fi șters complet pe {date}. Raportările de probleme trimise rămân, fără numele și emailul dumneavoastră.',
    readmeRestore: 'V-ați răzgândit? Scrieți-ne înainte de {date}.',
  },
  de: {
    sectionTitle: 'Konto löschen',
    sectionIntro: 'Ihr Konto wird sofort gesperrt und 30 Tage später vollständig gelöscht. Vorher erhalten Sie eine Kopie Ihrer Daten.',
    sectionLink: 'Konto löschen…',
    title: 'Konto löschen',
    intro: 'Bevor etwas gelöscht wird, erhalten Sie eine Kopie von allem, was NERUMA über Sie gespeichert hat.',
    whatHappens: 'Was passiert',
    now: 'Jetzt: Ihr Konto wird gesperrt. Sie können sich nicht mehr anmelden, und die von Ihnen veröffentlichten Guides gehen offline.',
    held: 'Ihre Organisation „{name}“ hat keinen anderen Inhaber. Sie wird jetzt ausgeblendet und am {date} mit ihren Guides und Fotos gelöscht, wenn NERUMA sie bis dahin nicht an eine Kollegin oder einen Kollegen übergibt. Ihre QR-Codes zeigen weiterhin, dass der Guide nicht verfügbar ist.',
    onDate: 'Am {date}: Alles über Sie wird vollständig gelöscht: Ihr Konto, Ihr Antrag und seine Nachweise, sein Prüfverlauf, die von Ihnen veröffentlichten Guides und Ihr Name im Änderungsverlauf.',
    reports: 'Gemeldete Probleme bleiben erhalten, ohne Ihren Namen und Ihre E-Mail-Adresse.',
    restore: 'Doch anders entschieden? Schreiben Sie uns vor dem {date}, dann können wir Ihr Konto wiederherstellen.',
    password: 'Ihr Passwort',
    code: '6-stelliger Code aus Ihrer Authenticator-App',
    understand: 'Ich verstehe, dass mein Konto am {date} vollständig gelöscht wird.',
    submit: 'Konto löschen',
    working: 'Ihre Daten werden vorbereitet…',
    wrongPassword: 'Das Passwort stimmt nicht. Es wurde nichts gelöscht.',
    wrongCode: 'Der Code stimmt nicht. Prüfen Sie die Uhrzeit Ihres Telefons und versuchen Sie den neuen Code. Es wurde nichts gelöscht.',
    codeNeeded: 'Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.',
    mustConfirm: 'Kreuzen Sie das Kästchen zur Bestätigung an.',
    error: 'Es wurde nichts gelöscht: Ihre Daten konnten nicht vorbereitet werden. Versuchen Sie es in ein paar Minuten erneut.',
    doneTitle: 'Ihr Konto ist gesperrt',
    doneDate: 'Es wird am {date} vollständig gelöscht.',
    download: 'Ihre Daten herunterladen',
    downloadNote: 'Der Link funktioniert 7 Tage lang und braucht keine Anmeldung. Behandeln Sie ihn vertraulich: Wer ihn hat, kann Ihre Daten herunterladen.',
    doneRestore: 'Doch anders entschieden? Schreiben Sie uns vor dem {date}.',
    lostLink: 'Falls Sie Ihre Daten nicht heruntergeladen haben, schreiben Sie uns vor dem {date}: Ein Administrator kann sie Ihnen schicken.',
    unavailable: 'Das Löschen des Kontos von hier aus wird gerade eingerichtet. Schreiben Sie uns, wenn Ihr Konto jetzt gelöscht werden soll.',
    banned: 'Dieses Konto wird gerade gelöscht. Um es wiederherzustellen, schreiben Sie uns vor dem Datum in Ihrer Bestätigung.',
    adminTitle: 'Kontolöschungen',
    adminIntro: 'Ein Konto wird gesperrt, sobald seine Löschung beginnt, und nach 30 Tagen endgültig entfernt. Stellen Sie es innerhalb der 30 Tage wieder her, wenn die Person es sich anders überlegt. Prüfen Sie bei einer Anfrage per E-Mail zuerst, dass sie von der Adresse des Kontos kam.',
    pending: 'Laufend',
    none: 'Keine Löschung läuft.',
    requested: 'Beantragt am {date}',
    dueOn: 'Kann ab dem {date} entfernt werden',
    dueNow: 'Fällig: kann jetzt entfernt werden',
    byAdmin: 'Von einem Administrator gestartet',
    bySelf: 'Von der Person selbst gestartet',
    alsoHeld: 'Mit ausgeblendete Organisation: {names}',
    restoreButton: 'Wiederherstellen',
    restoreTitle: 'Dieses Konto wiederherstellen?',
    restoreBody: 'Das Konto wird entsperrt, seine Guides kommen zurück, und seine Organisation wird wieder angezeigt.',
    erase: 'Jetzt entfernen',
    eraseTitle: 'Dieses Konto endgültig entfernen?',
    eraseBody: 'Alles über diese Person wird gelöscht, auch ihre Nachweise. Das lässt sich nicht rückgängig machen.',
    holds: 'Ausgeblendete Organisationen',
    holdsNone: 'Keine Organisation ist ausgeblendet.',
    eraseOrganisation: 'Organisation entfernen',
    eraseOrganisationTitle: 'Diese Organisation endgültig entfernen?',
    eraseOrganisationBody: 'Ihre Guides, Schritte und Fotos werden gelöscht. Ihre QR-Codes zeigen weiterhin, dass der Guide nicht verfügbar ist. Das lässt sich nicht rückgängig machen.',
    erasedOn: 'Entfernt am {date}',
    formerOwner: 'Früherer Inhaber: {email}',
    start: 'Löschung für jemanden starten, der uns geschrieben hat',
    startHint: 'Prüfen Sie zuerst, dass die Anfrage von der E-Mail-Adresse des Kontos kam, und laden Sie die Daten der Person herunter, um sie ihr zu schicken.',
    email: 'E-Mail-Adresse des Kontos',
    downloadTheirs: 'Daten der Person herunterladen',
    startButton: 'Löschung starten',
    startTitle: 'Löschung dieses Kontos starten?',
    startBody: 'Das Konto wird sofort gesperrt und in 30 Tagen entfernt.',
    started: 'Löschung gestartet. Das Konto kann ab dem {date} entfernt werden.',
    noAccount: 'Es gibt kein Konto mit dieser E-Mail-Adresse.',
    cancel: 'Abbrechen',
    adminError: 'Das hat nicht geklappt. Laden Sie die Seite neu und versuchen Sie es erneut.',
    senderDeleted: 'Konto der absendenden Person gelöscht',
    senderPending: 'Konto der absendenden Person wird gelöscht',
    deleteReport: 'Meldung löschen',
    deleteReportTitle: 'Diese Meldung löschen?',
    deleteReportBody: 'Die Meldung und ihr Verlauf werden gelöscht. Das lässt sich nicht rückgängig machen.',
    readmeTitle: 'NERUMA: Ihre Daten',
    readmeExported: 'Exportiert am {date}.',
    readmeContents: 'Dieses Archiv enthält alles, was NERUMA zu Ihrem Konto gespeichert hat: data.json (alle Daten, lesbar in jedem Texteditor), documents/ (die Dateien, mit denen Sie Ihre Vertretungsbefugnis nachgewiesen haben) und photos/ (die Fotos einer Organisation, deren alleiniger Inhaber Sie waren).',
    readmeDeletion: 'Sie haben am {requested} beantragt, Ihr Konto zu löschen. Es ist jetzt gesperrt und wird am {date} vollständig gelöscht. Gemeldete Probleme bleiben erhalten, ohne Ihren Namen und Ihre E-Mail-Adresse.',
    readmeRestore: 'Doch anders entschieden? Schreiben Sie uns vor dem {date}.',
  },
} satisfies Record<Locale, Record<string, string>>;

export const getDeletionCopy = (locale: Locale) => copy[locale];

/** The plain-text letter that goes first in the export, in the person's language. */
export function exportReadme(locale: Locale, deletion: { requestedAt: string; deleteAfter: string } | null, exportedAt = new Date()) {
  const t = copy[locale];
  const lines = [t.readmeTitle, '', fill(t.readmeExported, { date: longDate(exportedAt, locale) }), '', t.readmeContents];
  if (deletion) {
    const date = longDate(deletion.deleteAfter, locale);
    lines.push('', fill(t.readmeDeletion, { requested: longDate(deletion.requestedAt, locale), date }), '', fill(t.readmeRestore, { date }));
  }
  return lines.join('\n') + '\n';
}
