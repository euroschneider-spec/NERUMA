import type { Locale } from './i18n';

// What public.two_factor_status() answers for the signed-in account. `passed` is the database's own verdict: false means
// organisation and administrator access is closed for this session until the code is entered or two-factor is set up.
export type TwoFactorStatus = { enrolled: boolean; required: boolean; deadline: string | null; passed: boolean };

// Anything unexpected reads as "not passed", so a caller fails closed.
export function parseTwoFactorStatus(value: unknown): TwoFactorStatus | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.enrolled !== 'boolean' || typeof row.required !== 'boolean' || typeof row.passed !== 'boolean') return null;
  const deadline = typeof row.deadline === 'string' && !Number.isNaN(Date.parse(row.deadline)) ? row.deadline : null;
  return { enrolled: row.enrolled, required: row.required, deadline, passed: row.passed };
}

// Backup codes as Supabase reports them: switched off on the project, none made yet, or how many are left.
export type BackupCodes = { state: 'off' } | { state: 'none' } | { state: 'some'; total: number; remaining: number };

// Where a session that hasn't passed has to go: the code step when an app is set up, otherwise setup on the account page.
export function twoFactorStep(status: TwoFactorStatus): 'verify' | 'setup' | null {
  if (status.passed) return null;
  return status.enrolled ? 'verify' : 'setup';
}

// Authenticator apps show "123 456"; people type it with or without the space.
export function secondFactorCode(value: string): string | null {
  const code = value.replace(/\s/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

// Backup codes are letters and digits; people may type them with spaces, dashes or capitals, which Supabase ignores.
export function backupCode(value: string): string | null {
  const code = value.replace(/[\s-]/g, '');
  return /^[a-z0-9]{8,32}$/i.test(code) ? code : null;
}

// The setup key and backup codes, in groups of four so they can be read and typed.
export const groupedKey = (secret: string) => secret.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') ?? '';

// A banner date is shown only while the deadline is still ahead.
export function upcomingDeadline(status: TwoFactorStatus, now = Date.now()): string | null {
  if (status.enrolled || !status.deadline) return null;
  return Date.parse(status.deadline) > now ? status.deadline : null;
}

const copy = {
  en: {
    title: 'Two-factor sign-in',
    intro: 'After your password, you enter a 6-digit code from an authenticator app on your phone. A stolen password alone is then not enough to get in.',
    setup: 'Set up two-factor sign-in',
    scan: 'Scan this QR code with an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password).',
    manual: 'Can’t scan it? Enter this key in the app instead:',
    qrAlt: 'QR code for your authenticator app',
    code: '6-digit code from the app',
    turnOn: 'Turn on two-factor sign-in',
    on: 'Two-factor sign-in is on.',
    lost: 'If you lose your phone, write to us from your account’s email address. A NERUMA administrator checks who you are and resets two-factor sign-in.',
    verifyTitle: 'Enter your code',
    verifyIntro: 'Open your authenticator app and enter the 6-digit code for NERUMA.',
    verify: 'Confirm',
    wrong: 'That code didn’t work. Check that the time on your phone is right, and try the new code.',
    invalid: 'Enter the 6 digits from the app.',
    error: 'The check didn’t go through. Try again.',
    required: 'Your account must use two-factor sign-in. Set it up to continue.',
    banner: 'From {date}, organisation owners and admins must use two-factor sign-in.',
    bannerLink: 'Set it up now',
    working: 'Checking…',
    backupTitle: 'Backup codes',
    backupIntro: 'If you don’t have your phone, each of these codes lets you sign in once. Save them somewhere safe now, for example printed or in a password manager: they are shown only this once.',
    backupDownload: 'Download the codes',
    continue: 'I’ve saved them, continue',
    continuePlain: 'Continue',
    backupLeft: '{left} of {total} backup codes left.',
    backupNone: 'You have no backup codes yet.',
    backupCreate: 'Create backup codes',
    backupNew: 'Make new backup codes',
    backupNewTitle: 'Make new backup codes?',
    backupNewBody: 'Your current backup codes stop working straight away.',
    backupNewConfirm: 'Make new codes',
    cancel: 'Cancel',
    useBackup: 'Use a backup code instead',
    backupCode: 'Backup code',
    backupSubmit: 'Use this backup code',
    backupWrong: 'That backup code didn’t work. Each code works only once.',
    backupLocked: 'Too many wrong codes. Wait a few minutes and try again.',
  },
  ro: {
    title: 'Autentificare în doi pași',
    intro: 'După parolă, introduceți un cod de 6 cifre dintr-o aplicație de autentificare de pe telefon. Astfel, o parolă furată nu ajunge pentru a intra în cont.',
    setup: 'Configurați autentificarea în doi pași',
    scan: 'Scanați acest cod QR cu o aplicație de autentificare (de exemplu Google Authenticator, Microsoft Authenticator sau 1Password).',
    manual: 'Nu puteți scana? Introduceți în aplicație această cheie:',
    qrAlt: 'Cod QR pentru aplicația de autentificare',
    code: 'Codul de 6 cifre din aplicație',
    turnOn: 'Activați autentificarea în doi pași',
    on: 'Autentificarea în doi pași este activă.',
    lost: 'Dacă pierdeți telefonul, scrieți-ne de pe adresa de email a contului. Un administrator NERUMA vă verifică identitatea și resetează autentificarea în doi pași.',
    verifyTitle: 'Introduceți codul',
    verifyIntro: 'Deschideți aplicația de autentificare și introduceți codul de 6 cifre pentru NERUMA.',
    verify: 'Confirmați',
    wrong: 'Codul nu este corect. Verificați dacă ora de pe telefon este corectă și încercați codul nou.',
    invalid: 'Introduceți cele 6 cifre din aplicație.',
    error: 'Verificarea nu a reușit. Încercați din nou.',
    required: 'Contul dumneavoastră trebuie să folosească autentificarea în doi pași. Configurați-o pentru a continua.',
    banner: 'De la {date}, proprietarii și administratorii organizațiilor trebuie să folosească autentificarea în doi pași.',
    bannerLink: 'Configurați acum',
    working: 'Se verifică…',
    backupTitle: 'Coduri de rezervă',
    backupIntro: 'Dacă nu aveți telefonul la îndemână, fiecare dintre aceste coduri vă permite să intrați în cont o singură dată. Salvați-le acum într-un loc sigur, de exemplu tipărite sau într-un manager de parole: sunt afișate doar acum.',
    backupDownload: 'Descărcați codurile',
    continue: 'Le-am salvat, continuați',
    continuePlain: 'Continuați',
    backupLeft: 'Mai aveți {left} din {total} coduri de rezervă.',
    backupNone: 'Nu aveți încă coduri de rezervă.',
    backupCreate: 'Creați coduri de rezervă',
    backupNew: 'Generați coduri de rezervă noi',
    backupNewTitle: 'Generați coduri de rezervă noi?',
    backupNewBody: 'Codurile de rezervă actuale nu vor mai funcționa de îndată.',
    backupNewConfirm: 'Generați coduri noi',
    cancel: 'Anulați',
    useBackup: 'Folosiți un cod de rezervă',
    backupCode: 'Cod de rezervă',
    backupSubmit: 'Folosiți acest cod',
    backupWrong: 'Codul de rezervă nu este corect. Fiecare cod funcționează o singură dată.',
    backupLocked: 'Prea multe coduri greșite. Așteptați câteva minute și încercați din nou.',
  },
  de: {
    title: 'Zwei-Faktor-Anmeldung',
    intro: 'Nach dem Passwort geben Sie einen 6-stelligen Code aus einer Authenticator-App auf Ihrem Telefon ein. Ein gestohlenes Passwort allein reicht dann nicht mehr aus.',
    setup: 'Zwei-Faktor-Anmeldung einrichten',
    scan: 'Scannen Sie diesen QR-Code mit einer Authenticator-App (zum Beispiel Google Authenticator, Microsoft Authenticator oder 1Password).',
    manual: 'Scannen nicht möglich? Geben Sie stattdessen diesen Schlüssel in der App ein:',
    qrAlt: 'QR-Code für die Authenticator-App',
    code: '6-stelliger Code aus der App',
    turnOn: 'Zwei-Faktor-Anmeldung einschalten',
    on: 'Die Zwei-Faktor-Anmeldung ist eingeschaltet.',
    lost: 'Wenn Sie Ihr Telefon verlieren, schreiben Sie uns von der E-Mail-Adresse Ihres Kontos. Ein NERUMA-Administrator prüft, wer Sie sind, und setzt die Zwei-Faktor-Anmeldung zurück.',
    verifyTitle: 'Code eingeben',
    verifyIntro: 'Öffnen Sie Ihre Authenticator-App und geben Sie den 6-stelligen Code für NERUMA ein.',
    verify: 'Bestätigen',
    wrong: 'Der Code stimmt nicht. Prüfen Sie, ob die Uhrzeit Ihres Telefons stimmt, und versuchen Sie es mit dem neuen Code.',
    invalid: 'Geben Sie die 6 Ziffern aus der App ein.',
    error: 'Die Prüfung hat nicht geklappt. Bitte versuchen Sie es erneut.',
    required: 'Für Ihr Konto ist die Zwei-Faktor-Anmeldung vorgeschrieben. Richten Sie sie ein, um fortzufahren.',
    banner: 'Ab dem {date} müssen Inhaber und Administratoren von Organisationen die Zwei-Faktor-Anmeldung verwenden.',
    bannerLink: 'Jetzt einrichten',
    working: 'Wird geprüft…',
    backupTitle: 'Ersatzcodes',
    backupIntro: 'Wenn Sie Ihr Telefon nicht zur Hand haben, können Sie sich mit jedem dieser Codes einmal anmelden. Speichern Sie sie jetzt an einem sicheren Ort, zum Beispiel ausgedruckt oder in einem Passwortmanager: Sie werden nur dieses eine Mal angezeigt.',
    backupDownload: 'Codes herunterladen',
    continue: 'Gespeichert, weiter',
    continuePlain: 'Weiter',
    backupLeft: 'Noch {left} von {total} Ersatzcodes übrig.',
    backupNone: 'Sie haben noch keine Ersatzcodes.',
    backupCreate: 'Ersatzcodes erstellen',
    backupNew: 'Neue Ersatzcodes erstellen',
    backupNewTitle: 'Neue Ersatzcodes erstellen?',
    backupNewBody: 'Ihre bisherigen Ersatzcodes funktionieren dann sofort nicht mehr.',
    backupNewConfirm: 'Neue Codes erstellen',
    cancel: 'Abbrechen',
    useBackup: 'Stattdessen einen Ersatzcode verwenden',
    backupCode: 'Ersatzcode',
    backupSubmit: 'Diesen Code verwenden',
    backupWrong: 'Dieser Ersatzcode funktioniert nicht. Jeder Code gilt nur einmal.',
    backupLocked: 'Zu viele falsche Codes. Warten Sie einige Minuten und versuchen Sie es erneut.',
  },
} satisfies Record<Locale, Record<string, string>>;

export const getTwoFactorCopy = (locale: Locale) => copy[locale];
