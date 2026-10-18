// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBillingCopy, managesInStripe, parseBillingStatus, planState, type BillingStatus } from '@/lib/billing';
import { locales } from '@/lib/i18n';
vi.mock('server-only', () => ({}));
const { createCheckout, createPortal, currentSubscription, parseSubscription, stripeConfigured, subscriptionInEvent, verifyStripeSignature } = await import('@/lib/stripe-server');

const org = '00000000-0000-4000-8000-000000000170';
const day = 86400000;
const status = (overrides: Partial<BillingStatus> = {}): BillingStatus => ({
  requiredFrom: null, required: false, allowed: true, status: null, periodEnd: null, cancelAtPeriodEnd: false, graceUntil: null, customer: null, ...overrides,
});

describe('parseBillingStatus', () => {
  it('reads what the database answers', () => {
    expect(parseBillingStatus({ requiredFrom: '2027-01-01T00:00:00+00:00', required: false, allowed: true, status: 'active', periodEnd: '2027-02-01T00:00:00+00:00', cancelAtPeriodEnd: false, graceUntil: null, customer: 'cus_Abc123' }))
      .toEqual(status({ requiredFrom: '2027-01-01T00:00:00+00:00', status: 'active', periodEnd: '2027-02-01T00:00:00+00:00', customer: 'cus_Abc123' }));
  });
  it('fails closed on anything unexpected', () => {
    expect(parseBillingStatus(null)).toBeNull();
    expect(parseBillingStatus([])).toBeNull();
    expect(parseBillingStatus({ required: false })).toBeNull();
    expect(parseBillingStatus({ required: false, allowed: 'yes' })).toBeNull();
    expect(parseBillingStatus({ required: false, allowed: true, status: 'free' })).toBeNull();
  });
  it('drops a date that is not one and a customer that is not Stripe\'s', () => {
    const parsed = parseBillingStatus({ required: true, allowed: false, periodEnd: 'soon', customer: 'https://example.test' });
    expect(parsed?.periodEnd).toBeNull();
    expect(parsed?.customer).toBeNull();
  });
});

describe('planState', () => {
  it('names each state the owner can be in', () => {
    expect(planState(status())).toBe('none');
    expect(planState(status({ status: 'incomplete' }))).toBe('pending');
    expect(planState(status({ status: 'active' }))).toBe('active');
    expect(planState(status({ status: 'trialing' }))).toBe('active');
    expect(planState(status({ status: 'active', cancelAtPeriodEnd: true }))).toBe('ending');
    expect(planState(status({ status: 'past_due', graceUntil: new Date(Date.now() + day).toISOString() }))).toBe('grace');
    expect(planState(status({ status: 'canceled', graceUntil: new Date(Date.now() - day).toISOString() }))).toBe('ended');
    // A plan that was never paid has no grace, and reads as no plan.
    expect(planState(status({ status: 'incomplete_expired' }))).toBe('none');
  });
});

describe('managesInStripe', () => {
  it('sends an organisation with a running subscription to Stripe\'s page, and one without to Checkout', () => {
    expect(managesInStripe(status({ status: 'active', customer: 'cus_A1' }))).toBe(true);
    expect(managesInStripe(status({ status: 'past_due', customer: 'cus_A1' }))).toBe(true);
    expect(managesInStripe(status({ status: 'canceled', customer: 'cus_A1' }))).toBe(false);
    expect(managesInStripe(status({ status: 'incomplete_expired', customer: 'cus_A1' }))).toBe(false);
    // Admins never receive the customer, so they never get Stripe's page.
    expect(managesInStripe(status({ status: 'active' }))).toBe(false);
  });
});

describe('billing copy', () => {
  it('says everything in all three languages, with the same placeholders', () => {
    const english = getBillingCopy('en');
    for (const locale of locales) {
      const copy = getBillingCopy(locale);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort());
      for (const [key, text] of Object.entries(copy)) {
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(text.match(/\{\w+\}/g) ?? [], `${locale}.${key}`).toEqual(english[key as keyof typeof english].match(/\{\w+\}/g) ?? []);
      }
    }
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_testsecret';
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const sign = (body: string, at = now, key = secret) => createHmac('sha256', key).update(`${at}.${body}`).digest('hex');
  it('accepts Stripe\'s signature, including among several', () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sign(payload)}`, secret, now)).toBe(true);
    expect(verifyStripeSignature(payload, `t=${now},v1=${'0'.repeat(64)},v1=${sign(payload)},v0=abc`, secret, now)).toBe(true);
  });
  it('refuses a changed body, another secret, an old or future timestamp, and anything malformed', () => {
    expect(verifyStripeSignature(`${payload} `, `t=${now},v1=${sign(payload)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now},v1=${sign(payload, now, 'whsec_other')}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now - 301},v1=${sign(payload, now - 301)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now + 301},v1=${sign(payload, now + 301)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `v1=${sign(payload)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now},v1=xyz`, secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${now},v1=${sign(payload)}`, '', now)).toBe(false);
  });
});

describe('reading Stripe\'s subscriptions', () => {
  const read = '2027-01-15T08:00:00.000Z';
  const subscription = (overrides: Record<string, unknown> = {}) => ({
    object: 'subscription', id: 'sub_A1', customer: 'cus_A1', status: 'active', cancel_at_period_end: false, cancel_at: null, metadata: { organization_id: org }, ...overrides,
  });
  it('takes the subscription out of customer.subscription events only', () => {
    expect(subscriptionInEvent({ type: 'customer.subscription.updated', data: { object: subscription() } })).toBe('sub_A1');
    expect(subscriptionInEvent({ type: 'customer.subscription.deleted', data: { object: subscription() } })).toBe('sub_A1');
    expect(subscriptionInEvent({ type: 'invoice.paid', data: { object: { id: 'in_1' } } })).toBeNull();
    expect(subscriptionInEvent({ type: 'customer.subscription.updated', data: { object: { id: '../customers' } } })).toBeNull();
    expect(subscriptionInEvent(null)).toBeNull();
  });
  it('reads the period from the item (newer API versions) or from the subscription (older ones)', () => {
    expect(parseSubscription(subscription({ items: { data: [{ current_period_end: 1_802_592_000 }] } }), read)).toEqual({
      org, customer: 'cus_A1', subscription: 'sub_A1', status: 'active', periodEnd: '2027-02-14T08:00:00.000Z', cancelAtPeriodEnd: false, created: read,
    });
    expect(parseSubscription(subscription({ current_period_end: 1_802_592_000 }), read)?.periodEnd).toBe('2027-02-14T08:00:00.000Z');
  });
  it('reads a cancellation, whichever way Stripe says it', () => {
    expect(parseSubscription(subscription({ cancel_at_period_end: true }), read)?.cancelAtPeriodEnd).toBe(true);
    expect(parseSubscription(subscription({ cancel_at: 1_802_592_000 }), read)?.cancelAtPeriodEnd).toBe(true);
    expect(parseSubscription(subscription({ status: 'canceled' }), read)?.status).toBe('canceled');
  });
  it('ignores subscriptions that name no organisation, and anything malformed', () => {
    expect(parseSubscription(subscription({ metadata: {} }), read)).toBeNull();
    expect(parseSubscription(subscription({ metadata: { organization_id: 'not-a-uuid' } }), read)).toBeNull();
    expect(parseSubscription(subscription({ status: 'free' }), read)).toBeNull();
    expect(parseSubscription(subscription({ id: 'cus_A1' }), read)).toBeNull();
    expect(parseSubscription(subscription({ customer: { id: 'cus_A1' } }), read)).toBeNull();
    expect(parseSubscription(subscription({ object: 'invoice' }), read)).toBeNull();
    expect(parseSubscription(null, read)).toBeNull();
  });
});

describe('talking to Stripe', () => {
  const settings = {
    VIANORAE_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst', NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', VIANORAE_STRIPE_SECRET_KEY: 'sk_test_fixture',
    VIANORAE_STRIPE_WEBHOOK_SECRET: 'whsec_fixture', VIANORAE_STRIPE_PRICE_ID: 'price_fixture', VIANORAE_BILLING_SECRET: 'x'.repeat(32),
  };
  beforeEach(() => { for (const [key, value] of Object.entries(settings)) vi.stubEnv(key, value); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const stripeAnswers = (body: unknown, ok = true) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };
  it('is configured only with all four settings shaped like Stripe\'s', () => {
    expect(stripeConfigured()).toBe(true);
    vi.stubEnv('VIANORAE_STRIPE_SECRET_KEY', 'pk_test_fixture');
    expect(stripeConfigured()).toBe(false);
    vi.stubEnv('VIANORAE_STRIPE_SECRET_KEY', 'sk_live_fixture');
    vi.stubEnv('VIANORAE_BILLING_SECRET', 'short');
    expect(stripeConfigured()).toBe(false);
  });
  it('opens Checkout for the one price, in the owner\'s language, with the organisation in the metadata and VAT on', async () => {
    const fetch = stripeAnswers({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    expect(await createCheckout({ org, customer: null, email: 'owner@example.test', locale: 'de', origin: 'https://neruma.example.test' })).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_fixture');
    const sent = init.body as URLSearchParams;
    expect(Object.fromEntries(sent)).toMatchObject({
      mode: 'subscription', 'line_items[0][price]': 'price_fixture', locale: 'de', customer_email: 'owner@example.test',
      'subscription_data[metadata][organization_id]': org, 'automatic_tax[enabled]': 'true', 'tax_id_collection[enabled]': 'true',
      success_url: `https://neruma.example.test/de/workspace/billing?org=${org}&checkout=done`,
    });
    expect(sent.has('customer')).toBe(false);
  });
  it('keeps an organisation\'s Stripe customer when it pays again', async () => {
    const fetch = stripeAnswers({ url: 'https://checkout.stripe.com/c/pay/cs_test_2' });
    await createCheckout({ org, customer: 'cus_A1', email: 'owner@example.test', locale: 'en', origin: 'https://neruma.example.test' });
    const sent = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(sent.get('customer')).toBe('cus_A1');
    expect(sent.has('customer_email')).toBe(false);
  });
  it('asks Stripe for the subscription as it is now, and lets a failure be retried', async () => {
    const fetch = stripeAnswers({ object: 'subscription', id: 'sub_A1', customer: 'cus_A1', status: 'past_due', metadata: { organization_id: org } });
    expect((await currentSubscription('sub_A1'))?.status).toBe('past_due');
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://api.stripe.com/v1/subscriptions/sub_A1');
    stripeAnswers({ error: { message: 'Server error' } }, false);
    await expect(currentSubscription('sub_A1')).rejects.toThrow();
  });
  it('sends the browser only to Stripe\'s own pages', async () => {
    stripeAnswers({ url: 'https://checkout.stripe.com.example.test/c/pay' });
    expect(await createCheckout({ org, customer: null, email: 'o@example.test', locale: 'en', origin: 'https://n.example.test' })).toBeNull();
    stripeAnswers({ url: 'https://billing.stripe.com/p/session/test_1' });
    expect(await createPortal({ customer: 'cus_A1', locale: 'ro', returnUrl: 'https://n.example.test/ro/workspace/billing' })).toBe('https://billing.stripe.com/p/session/test_1');
    stripeAnswers({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    expect(await createPortal({ customer: 'cus_A1', locale: 'ro', returnUrl: 'https://n.example.test' })).toBeNull();
    stripeAnswers({ error: { message: 'No such price' } }, false);
    expect(await createCheckout({ org, customer: null, email: 'o@example.test', locale: 'en', origin: 'https://n.example.test' })).toBeNull();
  });
});
