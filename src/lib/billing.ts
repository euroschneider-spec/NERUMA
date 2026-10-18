import type { Locale } from './i18n';

/**
 * Payments (brief docs/briefs/2026-10-18-payments.md): what the database answers about an organisation's plan, read carefully, and
 * the words for it. Shared by server and client; nothing here talks to Stripe (that is src/lib/stripe-server.ts).
 */

export const subscriptionStatuses = ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export const isSubscriptionStatus = (value: unknown): value is SubscriptionStatus => subscriptionStatuses.includes(value as SubscriptionStatus);

/** What public.billing_status(org) answers. `allowed` is the database's own verdict on publishing and on what visitors see. */
export type BillingStatus = {
  requiredFrom: string | null; required: boolean; allowed: boolean; status: SubscriptionStatus | null;
  periodEnd: string | null; cancelAtPeriodEnd: boolean; graceUntil: string | null; customer: string | null;
};

const date = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

// Anything unexpected is null, and the callers then treat publishing as not allowed.
export function parseBillingStatus(value: unknown): BillingStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.required !== 'boolean' || typeof row.allowed !== 'boolean') return null;
  if (row.status != null && !isSubscriptionStatus(row.status)) return null;
  return {
    requiredFrom: date(row.requiredFrom), required: row.required, allowed: row.allowed,
    status: (row.status as SubscriptionStatus | null | undefined) ?? null,
    periodEnd: date(row.periodEnd), cancelAtPeriodEnd: row.cancelAtPeriodEnd === true, graceUntil: date(row.graceUntil),
    customer: typeof row.customer === 'string' && /^cus_[A-Za-z0-9]+$/.test(row.customer) ? row.customer : null,
  };
}

/**
 * Where the plan stands, in the words the owner reads:
 * none (never chose one), pending (Stripe is still waiting for the first payment), active, ending (cancelled, paid until periodEnd),
 * grace (a payment failed or the plan ended; online until graceUntil), ended (offline until paid again).
 */
export type PlanState = 'none' | 'pending' | 'active' | 'ending' | 'grace' | 'ended';
export function planState(status: BillingStatus): PlanState {
  if (!status.status) return 'none';
  if (status.status === 'active' || status.status === 'trialing') return status.cancelAtPeriodEnd ? 'ending' : 'active';
  if (status.graceUntil && Date.parse(status.graceUntil) > Date.now()) return 'grace';
  if (status.status === 'incomplete') return 'pending';
  return status.graceUntil ? 'ended' : 'none';
}

/** Stripe's page for changing the card or cancelling is offered while there is a subscription Stripe still runs. */
export const managesInStripe = (status: BillingStatus) =>
  status.customer !== null && ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(status.status ?? '');

const en = {
  title: 'Plan & billing',
  intro: 'Building and previewing guides is free. Publishing needs a plan: one plan covers every location of the organisation.',
  notReady: "Plans and payment aren't available yet. You can build and preview your guides in the meantime.",
  error: "The plan couldn't be loaded. Try again.",
  ownersOnly: 'Only an owner of the organisation can see and change the plan.',
  testMode: 'Test mode: no real money is taken. Use the test card 4242 4242 4242 4242.',
  freeUntil: 'Publishing is free until {date}. From then on, publishing needs a plan.',
  free: 'Publishing is free for now. You will be told before a plan is needed.',
  none: 'No plan yet.',
  noneRequired: 'No plan yet. Your guides are not shown to visitors, and you can publish again as soon as you choose a plan.',
  pending: 'Stripe is still waiting for the first payment.',
  active: 'Plan active. It renews on {date}.',
  activeNoDate: 'Plan active.',
  ending: 'Plan cancelled. It stays active until {date}.',
  grace: "The payment didn't go through. Your guides stay online until {date}. Update your payment details to keep them there.",
  ended: 'The plan has ended. Your guides are not shown to visitors. Choose a plan to publish them again; their addresses and QR codes stay the same.',
  choose: 'Choose a plan',
  chooseNote: "You pay on Stripe's secure page, by card or SEPA direct debit. Stripe shows the price, VAT and the period before you pay.",
  manage: 'Change payment details or cancel',
  manageNote: "Opens Stripe's page for this organisation's plan. You come back here afterwards.",
  returned: 'Thank you. Stripe is confirming the payment; this page shows it within a minute. Reload to check.',
  cancelled: 'Nothing was paid.',
  startError: "Stripe couldn't be opened. Nothing was paid. Try again.",
  dashboardGrace: "The payment for the plan didn't go through. Your guides stay online until {date}.",
  dashboardEnded: 'The plan has ended: your guides are not shown to visitors.',
  dashboardNone: 'Publishing needs a plan: your guides are not shown to visitors.',
  dashboardLink: 'Plan & billing',
  publishNeedsPlan: 'Publishing needs an active plan.',
  publishNeedsPlanOwner: 'Choose one under Plan & billing, then publish.',
  publishNeedsPlanAdmin: 'Ask an owner of the organisation to choose one.',
};
type BillingCopy = { [K in keyof typeof en]: string };
const ro: BillingCopy = {
  title: 'Plan și facturare',
  intro: 'Crearea și previzualizarea ghidurilor sunt gratuite. Publicarea are nevoie de un plan: un plan acoperă toate locațiile organizației.',
  notReady: 'Planurile și plata nu sunt încă disponibile. Între timp poți crea și previzualiza ghidurile.',
  error: 'Planul nu a putut fi încărcat. Încearcă din nou.',
  ownersOnly: 'Doar un proprietar al organizației poate vedea și schimba planul.',
  testMode: 'Mod de test: nu se iau bani reali. Folosește cardul de test 4242 4242 4242 4242.',
  freeUntil: 'Publicarea este gratuită până la {date}. De atunci, publicarea are nevoie de un plan.',
  free: 'Publicarea este gratuită deocamdată. Vei fi anunțat înainte să fie nevoie de un plan.',
  none: 'Niciun plan încă.',
  noneRequired: 'Niciun plan încă. Ghidurile tale nu sunt afișate vizitatorilor și poți publica din nou imediat ce alegi un plan.',
  pending: 'Stripe încă așteaptă prima plată.',
  active: 'Plan activ. Se reînnoiește pe {date}.',
  activeNoDate: 'Plan activ.',
  ending: 'Plan anulat. Rămâne activ până pe {date}.',
  grace: 'Plata nu a reușit. Ghidurile tale rămân online până pe {date}. Actualizează datele de plată ca să rămână online.',
  ended: 'Planul s-a încheiat. Ghidurile tale nu sunt afișate vizitatorilor. Alege un plan ca să le publici din nou; adresele și codurile QR rămân aceleași.',
  choose: 'Alege un plan',
  chooseNote: 'Plătești pe pagina securizată Stripe, cu cardul sau prin debit direct SEPA. Stripe arată prețul, TVA-ul și perioada înainte să plătești.',
  manage: 'Schimbă datele de plată sau anulează',
  manageNote: 'Deschide pagina Stripe pentru planul acestei organizații. Revii aici după aceea.',
  returned: 'Mulțumim. Stripe confirmă plata; această pagină o arată în cel mult un minut. Reîncarcă pentru a verifica.',
  cancelled: 'Nu s-a plătit nimic.',
  startError: 'Stripe nu a putut fi deschis. Nu s-a plătit nimic. Încearcă din nou.',
  dashboardGrace: 'Plata pentru plan nu a reușit. Ghidurile tale rămân online până pe {date}.',
  dashboardEnded: 'Planul s-a încheiat: ghidurile tale nu sunt afișate vizitatorilor.',
  dashboardNone: 'Publicarea are nevoie de un plan: ghidurile tale nu sunt afișate vizitatorilor.',
  dashboardLink: 'Plan și facturare',
  publishNeedsPlan: 'Publicarea are nevoie de un plan activ.',
  publishNeedsPlanOwner: 'Alege unul la Plan și facturare, apoi publică.',
  publishNeedsPlanAdmin: 'Roagă un proprietar al organizației să aleagă unul.',
};
const de: BillingCopy = {
  title: 'Tarif & Abrechnung',
  intro: 'Guides erstellen und in der Vorschau ansehen ist kostenlos. Zum Veröffentlichen braucht es einen Tarif: Ein Tarif gilt für alle Standorte der Organisation.',
  notReady: 'Tarife und Zahlung sind noch nicht verfügbar. Bis dahin können Sie Ihre Guides erstellen und in der Vorschau ansehen.',
  error: 'Der Tarif konnte nicht geladen werden. Versuchen Sie es erneut.',
  ownersOnly: 'Nur Eigentümer der Organisation können den Tarif sehen und ändern.',
  testMode: 'Testmodus: Es wird kein echtes Geld abgebucht. Verwenden Sie die Testkarte 4242 4242 4242 4242.',
  freeUntil: 'Veröffentlichen ist bis zum {date} kostenlos. Danach braucht es dafür einen Tarif.',
  free: 'Veröffentlichen ist vorerst kostenlos. Sie werden informiert, bevor ein Tarif nötig wird.',
  none: 'Noch kein Tarif.',
  noneRequired: 'Noch kein Tarif. Ihre Guides werden Besuchern nicht angezeigt; sobald Sie einen Tarif wählen, können Sie wieder veröffentlichen.',
  pending: 'Stripe wartet noch auf die erste Zahlung.',
  active: 'Tarif aktiv. Er verlängert sich am {date}.',
  activeNoDate: 'Tarif aktiv.',
  ending: 'Tarif gekündigt. Er bleibt bis zum {date} aktiv.',
  grace: 'Die Zahlung ist fehlgeschlagen. Ihre Guides bleiben bis zum {date} online. Aktualisieren Sie Ihre Zahlungsdaten, damit sie online bleiben.',
  ended: 'Der Tarif ist beendet. Ihre Guides werden Besuchern nicht angezeigt. Wählen Sie einen Tarif, um sie wieder zu veröffentlichen; Adressen und QR-Codes bleiben gleich.',
  choose: 'Tarif wählen',
  chooseNote: 'Sie zahlen auf der sicheren Seite von Stripe, per Karte oder SEPA-Lastschrift. Stripe zeigt Preis, Mehrwertsteuer und Zeitraum, bevor Sie zahlen.',
  manage: 'Zahlungsdaten ändern oder kündigen',
  manageNote: 'Öffnet die Stripe-Seite für den Tarif dieser Organisation. Danach kommen Sie hierher zurück.',
  returned: 'Danke. Stripe bestätigt die Zahlung; diese Seite zeigt sie innerhalb einer Minute an. Laden Sie die Seite neu, um nachzusehen.',
  cancelled: 'Es wurde nichts bezahlt.',
  startError: 'Stripe konnte nicht geöffnet werden. Es wurde nichts bezahlt. Versuchen Sie es erneut.',
  dashboardGrace: 'Die Zahlung für den Tarif ist fehlgeschlagen. Ihre Guides bleiben bis zum {date} online.',
  dashboardEnded: 'Der Tarif ist beendet: Ihre Guides werden Besuchern nicht angezeigt.',
  dashboardNone: 'Zum Veröffentlichen braucht es einen Tarif: Ihre Guides werden Besuchern nicht angezeigt.',
  dashboardLink: 'Tarif & Abrechnung',
  publishNeedsPlan: 'Zum Veröffentlichen braucht es einen aktiven Tarif.',
  publishNeedsPlanOwner: 'Wählen Sie einen unter Tarif & Abrechnung und veröffentlichen Sie dann.',
  publishNeedsPlanAdmin: 'Bitten Sie eine Eigentümerin oder einen Eigentümer der Organisation, einen zu wählen.',
};
export const getBillingCopy = (locale: Locale): BillingCopy => ({ en, ro, de })[locale];
