import { longDate, type Locale } from './i18n';

export { longDate };

// The superadmin area (brief docs/briefs/2026-10-17-superadmin-dashboard.md): what the platform administrator reads and manages.

export const ACCOUNTS_PER_PAGE = 25;

export type Overview = { pendingRequests: number; openReports: number; deletionsInProgress: number; deletionsDue: number; accounts: number; administrators: number };
export type AccountOrganisation = { id: string; name: string; role: string };
export type AccountRow = {
  userId: string; email: string; createdAt: string; lastSignInAt: string | null; confirmed: boolean; isAdmin: boolean;
  twoFactor: boolean; deletionPending: boolean; organisations: AccountOrganisation[];
};
export type AccountsPage = { total: number; rows: AccountRow[] };

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

export function parseOverview(value: unknown): Overview | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  return {
    pendingRequests: count(r.pending_requests), openReports: count(r.open_reports), deletionsInProgress: count(r.deletions_in_progress),
    deletionsDue: count(r.deletions_due), accounts: count(r.accounts), administrators: count(r.administrators),
  };
}

export function parseAccounts(value: unknown): AccountsPage | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.rows)) return null;
  const rows = r.rows.flatMap((row): AccountRow[] => {
    if (!row || typeof row !== 'object') return [];
    const a = row as Record<string, unknown>;
    if (!text(a.user_id)) return [];
    const organisations = Array.isArray(a.organisations)
      ? a.organisations.flatMap((org): AccountOrganisation[] => {
        const o = org && typeof org === 'object' ? (org as Record<string, unknown>) : {};
        return text(o.id) ? [{ id: text(o.id), name: text(o.name), role: text(o.role) }] : [];
      })
      : [];
    return [{
      userId: text(a.user_id), email: text(a.email), createdAt: text(a.created_at), lastSignInAt: text(a.last_sign_in_at) || null,
      confirmed: a.confirmed === true, isAdmin: a.is_admin === true, twoFactor: a.two_factor === true,
      deletionPending: a.deletion_pending === true, organisations,
    }];
  });
  return { total: count(r.total), rows };
}

const copy = {
  en: {
    title: 'Administration', intro: 'What waits for you, and who has an account.', dashboard: 'Dashboard', account: 'My account',
    unavailable: 'The administration tools are being activated. Account and administrator tools are unavailable until the latest database update is installed.',
    error: 'This could not be loaded. Reload the page, and try again later if it stays this way.',
    waiting: 'What waits', requests: 'Organisation requests', requestsCount: '{n} waiting', reports: 'Problem reports', reportsCount: '{n} open',
    deletions: 'Account deletions', deletionsCount: '{n} in progress, {due} due', people: 'People', accounts: 'Accounts', accountsCount: '{n} accounts',
    administrators: 'Administrators', administratorsCount: '{n} administrators',
    search: 'Search by email', searchButton: 'Search', clear: 'Clear search', none: 'No accounts match.', results: '{n} found',
    created: 'Created {date}', lastSignIn: 'Last sign-in {date}', never: 'Never signed in', notConfirmed: 'Email not confirmed',
    adminBadge: 'Administrator', twoFactorOn: 'Two-factor on', twoFactorOff: 'Two-factor off', deletionPending: 'Deletion in progress',
    noOrganisation: 'No organisation', previous: 'Previous page', next: 'Next page', page: 'Page {page} of {pages}',
    adminsIntro: 'Platform administrators review organisations and can see every account. Two-factor is always required for them.',
    addTitle: 'Add an administrator', addHint: 'The person needs a confirmed account first. Use the email they sign in with.', email: 'Email', add: 'Add administrator',
    added: 'Added. They see the administration area the next time they sign in.', alreadyAdmin: 'That account is already an administrator.',
    noAccount: 'There is no confirmed account with that email.', addError: 'The administrator could not be added.',
    remove: 'Remove', removeTitle: 'Remove this administrator?', removeBody: 'They lose access to the administration area at once. They keep their account and any organisation they belong to.',
    cancel: 'Cancel', you: 'You', removeNote: 'You can’t remove yourself, and the last administrator can’t be removed.',
  },
  ro: {
    title: 'Administrare', intro: 'Ce te așteaptă și cine are cont.', dashboard: 'Panou', account: 'Contul meu',
    unavailable: 'Instrumentele de administrare sunt în curs de activare. Instrumentele pentru conturi și administratori nu sunt disponibile până la instalarea ultimei actualizări a bazei de date.',
    error: 'Nu s-a putut încărca. Reîncarcă pagina și încearcă mai târziu dacă problema continuă.',
    waiting: 'Ce așteaptă', requests: 'Cereri ale organizațiilor', requestsCount: '{n} în așteptare', reports: 'Probleme raportate', reportsCount: '{n} deschise',
    deletions: 'Ștergeri de conturi', deletionsCount: '{n} în curs, {due} scadente', people: 'Persoane', accounts: 'Conturi', accountsCount: '{n} conturi',
    administrators: 'Administratori', administratorsCount: '{n} administratori',
    search: 'Caută după email', searchButton: 'Caută', clear: 'Șterge căutarea', none: 'Niciun cont nu se potrivește.', results: '{n} găsite',
    created: 'Creat la {date}', lastSignIn: 'Ultima autentificare: {date}', never: 'Nu s-a autentificat niciodată', notConfirmed: 'Email neconfirmat',
    adminBadge: 'Administrator', twoFactorOn: 'Doi factori activ', twoFactorOff: 'Doi factori inactiv', deletionPending: 'Ștergere în curs',
    noOrganisation: 'Nicio organizație', previous: 'Pagina anterioară', next: 'Pagina următoare', page: 'Pagina {page} din {pages}',
    adminsIntro: 'Administratorii platformei verifică organizațiile și pot vedea toate conturile. Autentificarea în doi pași este întotdeauna obligatorie pentru ei.',
    addTitle: 'Adaugă un administrator', addHint: 'Persoana are nevoie mai întâi de un cont confirmat. Folosește emailul cu care se autentifică.', email: 'Email', add: 'Adaugă administrator',
    added: 'Adăugat. Vede zona de administrare la următoarea autentificare.', alreadyAdmin: 'Acest cont este deja administrator.',
    noAccount: 'Nu există niciun cont confirmat cu acest email.', addError: 'Administratorul nu a putut fi adăugat.',
    remove: 'Elimină', removeTitle: 'Elimini acest administrator?', removeBody: 'Pierde imediat accesul la zona de administrare. Își păstrează contul și organizațiile din care face parte.',
    cancel: 'Anulează', you: 'Tu', removeNote: 'Nu te poți elimina pe tine și nici ultimul administrator.',
  },
  de: {
    title: 'Verwaltung', intro: 'Was auf Sie wartet und wer ein Konto hat.', dashboard: 'Übersicht', account: 'Mein Konto',
    unavailable: 'Die Verwaltungswerkzeuge werden aktiviert. Konten- und Administratorfunktionen sind erst nach dem neuesten Datenbank-Update verfügbar.',
    error: 'Das konnte nicht geladen werden. Laden Sie die Seite neu und versuchen Sie es später erneut.',
    waiting: 'Was wartet', requests: 'Organisationsanträge', requestsCount: '{n} wartend', reports: 'Gemeldete Probleme', reportsCount: '{n} offen',
    deletions: 'Kontolöschungen', deletionsCount: '{n} laufend, {due} fällig', people: 'Personen', accounts: 'Konten', accountsCount: '{n} Konten',
    administrators: 'Administratoren', administratorsCount: '{n} Administratoren',
    search: 'Nach E-Mail suchen', searchButton: 'Suchen', clear: 'Suche zurücksetzen', none: 'Kein Konto passt.', results: '{n} gefunden',
    created: 'Erstellt am {date}', lastSignIn: 'Letzte Anmeldung {date}', never: 'Noch nie angemeldet', notConfirmed: 'E-Mail nicht bestätigt',
    adminBadge: 'Administrator', twoFactorOn: 'Zwei-Faktor an', twoFactorOff: 'Zwei-Faktor aus', deletionPending: 'Löschung läuft',
    noOrganisation: 'Keine Organisation', previous: 'Vorherige Seite', next: 'Nächste Seite', page: 'Seite {page} von {pages}',
    adminsIntro: 'Plattform-Administratoren prüfen Organisationen und sehen alle Konten. Für sie ist die Zwei-Faktor-Anmeldung immer Pflicht.',
    addTitle: 'Administrator hinzufügen', addHint: 'Die Person braucht zuerst ein bestätigtes Konto. Verwenden Sie die E-Mail, mit der sie sich anmeldet.', email: 'E-Mail', add: 'Administrator hinzufügen',
    added: 'Hinzugefügt. Die Person sieht die Verwaltung bei der nächsten Anmeldung.', alreadyAdmin: 'Dieses Konto ist bereits Administrator.',
    noAccount: 'Es gibt kein bestätigtes Konto mit dieser E-Mail.', addError: 'Der Administrator konnte nicht hinzugefügt werden.',
    remove: 'Entfernen', removeTitle: 'Diesen Administrator entfernen?', removeBody: 'Der Zugang zur Verwaltung endet sofort. Konto und Organisationen bleiben bestehen.',
    cancel: 'Abbrechen', you: 'Sie', removeNote: 'Sie können sich nicht selbst entfernen, und der letzte Administrator kann nicht entfernt werden.',
  },
} as const;

export const getSuperadminCopy = (locale: Locale) => copy[locale];
