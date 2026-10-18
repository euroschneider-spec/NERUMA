import type { Locale } from './i18n';

/**
 * Password reset (brief docs/briefs/2026-10-18-password-reset.md): the rules for a new password and the words for the three pages
 * (ask for a link, open the link, choose the new password). Shared by server and client.
 */

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 128;

/** An email address as the forms accept it: one @, a dot after it, at most 254 characters. Supabase decides whether it is real. */
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export type PasswordProblem = 'short' | 'long' | 'mismatch';

/** What is wrong with a new password typed twice, or null. Supabase applies its own minimum again on the server. */
export function passwordProblem(password: string, repeated: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD) return 'short';
  if (password.length > MAX_PASSWORD) return 'long';
  return password === repeated ? null : 'mismatch';
}

/** The one-time token in a reset link: Supabase's hash, URL-safe letters and digits only. Anything else is not a link we sent. */
export const tokenHashPattern = /^[A-Za-z0-9_-]{16,200}$/;

const en = {
  forgot: 'Forgot your password?',
  requestTitle: 'Reset your password',
  requestIntro: 'Enter the email address of your account. If there is one, we send you a link to choose a new password.',
  email: 'Email address',
  send: 'Send the link',
  sending: 'Sending…',
  sent: 'If there is an account for that address, an email with a link is on its way. Check your inbox and your spam folder. The link works once, for one hour.',
  expired: 'That link has expired or was already used. Ask for a new one below.',
  back: 'Back to sign in',
  continueTitle: 'Choose a new password',
  continueIntro: 'You asked to reset the password of your NERUMA account. Continue to choose a new one.',
  continueButton: 'Continue',
  setTitle: 'Choose a new password',
  setIntro: 'Use at least 12 characters. When you save, you are signed out everywhere and sign in again with the new password.',
  newPassword: 'New password',
  repeatPassword: 'Repeat the new password',
  hint: 'Use at least 12 characters.',
  codeIntro: 'This account uses two-factor sign-in. Enter the code from your authenticator app before choosing a new password.',
  save: 'Save new password',
  saving: 'Saving…',
  short: 'The password needs at least 12 characters.',
  long: 'The password can have at most 128 characters.',
  mismatch: 'The two passwords are not the same.',
  same: 'Choose a password you did not use before for this account.',
  wrongCode: 'That code is not right. Try the current code from the app.',
  error: 'The password was not changed. Nothing else changed. Try again, or ask for a new link.',
  changed: 'Your password was changed. Sign in with the new password.',
  rate: 'Too many requests. Wait a few minutes, then try again.',
  unavailable: 'Sign-in is not active yet.',
};
type ResetCopy = { [K in keyof typeof en]: string };
const ro: ResetCopy = {
  forgot: 'Ai uitat parola?',
  requestTitle: 'Resetează parola',
  requestIntro: 'Introdu adresa de email a contului tău. Dacă există un cont, îți trimitem un link pentru a alege o parolă nouă.',
  email: 'Adresa de email',
  send: 'Trimite linkul',
  sending: 'Se trimite…',
  sent: 'Dacă există un cont pentru această adresă, un email cu un link este pe drum. Verifică inboxul și folderul spam. Linkul funcționează o singură dată, timp de o oră.',
  expired: 'Linkul a expirat sau a fost deja folosit. Cere unul nou mai jos.',
  back: 'Înapoi la autentificare',
  continueTitle: 'Alege o parolă nouă',
  continueIntro: 'Ai cerut resetarea parolei contului tău NERUMA. Continuă pentru a alege una nouă.',
  continueButton: 'Continuă',
  setTitle: 'Alege o parolă nouă',
  setIntro: 'Folosește cel puțin 12 caractere. După salvare ești deconectat peste tot și te autentifici din nou cu parola nouă.',
  newPassword: 'Parola nouă',
  repeatPassword: 'Repetă parola nouă',
  hint: 'Folosește cel puțin 12 caractere.',
  codeIntro: 'Acest cont folosește autentificarea în doi pași. Introdu codul din aplicația de autentificare înainte de a alege o parolă nouă.',
  save: 'Salvează parola nouă',
  saving: 'Se salvează…',
  short: 'Parola trebuie să aibă cel puțin 12 caractere.',
  long: 'Parola poate avea cel mult 128 de caractere.',
  mismatch: 'Cele două parole nu sunt la fel.',
  same: 'Alege o parolă pe care nu ai mai folosit-o pentru acest cont.',
  wrongCode: 'Codul nu este corect. Încearcă codul curent din aplicație.',
  error: 'Parola nu a fost schimbată. Nimic altceva nu s-a schimbat. Încearcă din nou sau cere un link nou.',
  changed: 'Parola ta a fost schimbată. Autentifică-te cu parola nouă.',
  rate: 'Prea multe cereri. Așteaptă câteva minute, apoi încearcă din nou.',
  unavailable: 'Autentificarea nu este încă activă.',
};
const de: ResetCopy = {
  forgot: 'Passwort vergessen?',
  requestTitle: 'Passwort zurücksetzen',
  requestIntro: 'Geben Sie die E-Mail-Adresse Ihres Kontos ein. Falls es eines gibt, senden wir Ihnen einen Link, um ein neues Passwort zu wählen.',
  email: 'E-Mail-Adresse',
  send: 'Link senden',
  sending: 'Wird gesendet…',
  sent: 'Falls es für diese Adresse ein Konto gibt, ist eine E-Mail mit einem Link unterwegs. Prüfen Sie Posteingang und Spamordner. Der Link funktioniert einmal und eine Stunde lang.',
  expired: 'Dieser Link ist abgelaufen oder wurde schon benutzt. Fordern Sie unten einen neuen an.',
  back: 'Zurück zur Anmeldung',
  continueTitle: 'Neues Passwort wählen',
  continueIntro: 'Sie haben das Zurücksetzen des Passworts Ihres NERUMA-Kontos angefordert. Fahren Sie fort, um ein neues zu wählen.',
  continueButton: 'Weiter',
  setTitle: 'Neues Passwort wählen',
  setIntro: 'Verwenden Sie mindestens 12 Zeichen. Nach dem Speichern werden Sie überall abgemeldet und melden sich mit dem neuen Passwort wieder an.',
  newPassword: 'Neues Passwort',
  repeatPassword: 'Neues Passwort wiederholen',
  hint: 'Verwenden Sie mindestens 12 Zeichen.',
  codeIntro: 'Dieses Konto nutzt die Zwei-Faktor-Anmeldung. Geben Sie den Code aus Ihrer Authenticator-App ein, bevor Sie ein neues Passwort wählen.',
  save: 'Neues Passwort speichern',
  saving: 'Wird gespeichert…',
  short: 'Das Passwort braucht mindestens 12 Zeichen.',
  long: 'Das Passwort darf höchstens 128 Zeichen haben.',
  mismatch: 'Die beiden Passwörter stimmen nicht überein.',
  same: 'Wählen Sie ein Passwort, das Sie für dieses Konto noch nicht verwendet haben.',
  wrongCode: 'Dieser Code stimmt nicht. Versuchen Sie den aktuellen Code aus der App.',
  error: 'Das Passwort wurde nicht geändert. Sonst hat sich nichts geändert. Versuchen Sie es erneut oder fordern Sie einen neuen Link an.',
  changed: 'Ihr Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.',
  rate: 'Zu viele Anfragen. Warten Sie einige Minuten und versuchen Sie es dann erneut.',
  unavailable: 'Die Anmeldung ist noch nicht aktiv.',
};
export const getResetCopy = (locale: Locale): ResetCopy => ({ en, ro, de })[locale];
