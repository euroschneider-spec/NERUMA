import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Locale } from './i18n';
import { isSubscriptionStatus, type SubscriptionStatus } from './billing';
import { authConfigured } from './supabase/config';
import { uuidPattern } from './workspace';

/**
 * Everything that knows about Stripe (docs/guides/PAYMENTS.md). Two requests (Checkout, and Stripe's page for managing a plan)
 * and the webhook's signature check, with fetch and Node's crypto rather than Stripe's library. Another payment provider replaces
 * this file; the rest of the app reads the plan from the database.
 */

const api = 'https://api.stripe.com/v1';

/** All four settings present and shaped like Stripe's. Without them the billing page says payments aren't available yet. */
export function stripeConfigured() {
  const key = process.env.VIANORAE_STRIPE_SECRET_KEY || '';
  return authConfigured()
    && /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)
    && /^whsec_[A-Za-z0-9+/=]+$/.test(process.env.VIANORAE_STRIPE_WEBHOOK_SECRET || '')
    && /^price_[A-Za-z0-9]+$/.test(process.env.VIANORAE_STRIPE_PRICE_ID || '')
    && (process.env.VIANORAE_BILLING_SECRET || '').length >= 32;
}
/** A test key takes no real money; the page says so. */
export const stripeTestMode = () => /^(sk|rk)_test_/.test(process.env.VIANORAE_STRIPE_SECRET_KEY || '');

/** Stripe's own check: an HMAC-SHA256 of "timestamp.payload" with the endpoint's secret, made within the last five minutes. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now() / 1000, tolerance = 300) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((part) => part.split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > tolerance) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest();
  return parts.filter(([key, value]) => key === 'v1' && /^[0-9a-f]{64}$/.test(value ?? '')).some(([, value]) =>
    timingSafeEqual(Buffer.from(value, 'hex'), expected));
}

/** One organisation's plan as Stripe describes it, and when NERUMA read it. */
export type SubscriptionChange = {
  org: string; customer: string; subscription: string; status: SubscriptionStatus;
  periodEnd: string | null; cancelAtPeriodEnd: boolean; created: string;
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const seconds = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? new Date(value * 1000).toISOString() : null);

/** The subscription a customer.subscription.* event is about; null for every other event. */
export function subscriptionInEvent(event: unknown): string | null {
  if (!record(event) || typeof event.type !== 'string' || !event.type.startsWith('customer.subscription.')) return null;
  const subscription = record(event.data) ? event.data.object : null;
  return record(subscription) && typeof subscription.id === 'string' && /^sub_[A-Za-z0-9]+$/.test(subscription.id) ? subscription.id : null;
}

/**
 * A Stripe subscription as one organisation's plan, read at `read`. A subscription that doesn't name an organisation (made by hand in
 * Stripe without the metadata), or anything malformed, is null and ignored.
 */
export function parseSubscription(subscription: unknown, read: string): SubscriptionChange | null {
  if (!record(subscription) || subscription.object !== 'subscription') return null;
  const org = record(subscription.metadata) ? subscription.metadata.organization_id : null;
  if (typeof org !== 'string' || !uuidPattern.test(org) || !isSubscriptionStatus(subscription.status)) return null;
  if (typeof subscription.id !== 'string' || !/^sub_[A-Za-z0-9]+$/.test(subscription.id)) return null;
  if (typeof subscription.customer !== 'string' || !/^cus_[A-Za-z0-9]+$/.test(subscription.customer)) return null;
  // Newer API versions keep the period on the subscription's item; older ones on the subscription itself.
  const item = record(subscription.items) && Array.isArray(subscription.items.data) && record(subscription.items.data[0]) ? subscription.items.data[0] : {};
  return {
    org, customer: subscription.customer, subscription: subscription.id, status: subscription.status,
    periodEnd: seconds(item.current_period_end) ?? seconds(subscription.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true || seconds(subscription.cancel_at) !== null, created: read,
  };
}

/**
 * The subscription as Stripe has it now. Events come late, twice, and out of order, and two made in the same second can't be put in
 * order, so the webhook reads the current state instead of the event's copy. Throws when Stripe can't be asked (the webhook then
 * answers 500 and Stripe sends the event again later).
 */
export async function currentSubscription(id: string): Promise<SubscriptionChange | null> {
  const read = new Date().toISOString();
  const response = await fetch(`${api}/subscriptions/${id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${process.env.VIANORAE_STRIPE_SECRET_KEY}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('stripe-unavailable');
  return parseSubscription(await response.json(), read);
}

async function post(path: string, params: URLSearchParams): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${api}${path}`, {
      method: 'POST', cache: 'no-store', body: params,
      headers: { Authorization: `Bearer ${process.env.VIANORAE_STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const body: unknown = await response.json();
    return response.ok && record(body) ? body : null;
  } catch { return null; }
}
// Only ever send the browser to Stripe's own pages.
const stripePage = (body: Record<string, unknown> | null, host: string) => {
  if (typeof body?.url !== 'string') return null;
  try { return new URL(body.url).origin === `https://${host}` ? body.url : null; } catch { return null; }
};

/**
 * Stripe Checkout for the one plan, in the owner's language. The organisation's id travels in the subscription's metadata, which is
 * how the webhook knows whose plan it is. An organisation that paid before keeps its Stripe customer (and its invoices).
 */
export async function createCheckout({ org, customer, email, locale, origin }: { org: string; customer: string | null; email: string; locale: Locale; origin: string }) {
  const back = `${origin}/${locale}/workspace/billing?org=${org}`;
  const params = new URLSearchParams({
    mode: 'subscription', 'line_items[0][price]': process.env.VIANORAE_STRIPE_PRICE_ID!, 'line_items[0][quantity]': '1',
    success_url: `${back}&checkout=done`, cancel_url: `${back}&checkout=cancelled`, locale,
    client_reference_id: org, 'metadata[organization_id]': org, 'subscription_data[metadata][organization_id]': org,
    // VAT: Stripe Tax works it out from the billing address, and a business can give its VAT number (reverse charge).
    'automatic_tax[enabled]': 'true', 'tax_id_collection[enabled]': 'true', billing_address_collection: 'required',
  });
  if (customer) {
    params.set('customer', customer);
    params.set('customer_update[address]', 'auto');
    params.set('customer_update[name]', 'auto');
  } else params.set('customer_email', email);
  return stripePage(await post('/checkout/sessions', params), 'checkout.stripe.com');
}

/** Stripe's page where the owner changes the card, sees invoices or cancels. */
export async function createPortal({ customer, locale, returnUrl }: { customer: string; locale: Locale; returnUrl: string }) {
  return stripePage(await post('/billing_portal/sessions', new URLSearchParams({ customer, locale, return_url: returnUrl })), 'billing.stripe.com');
}
