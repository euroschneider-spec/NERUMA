import 'server-only';
import { parseBillingStatus, type BillingStatus } from './billing';
import { publicClient } from './published-server';
import type { SubscriptionChange } from './stripe-server';
import type { SupabaseClient } from './supabase/server';
import { paymentsReady } from './verification-server';

/** The organisation's plan for its owner or admin, or null (before the migration, or on any error: callers then fail closed). */
export async function getBillingStatus(supabase: SupabaseClient, org: string): Promise<BillingStatus | null> {
  if (!await paymentsReady(supabase)) return null;
  const { data, error } = await supabase.rpc('billing_status', { org });
  return error ? null : parseBillingStatus(data);
}

/**
 * The webhook writes what Stripe said. It has no signed-in person: the database function checks VIANORAE_BILLING_SECRET instead and
 * can do nothing else. 'unknown' is an organisation that doesn't exist (nothing to retry); anything that failed throws, so Stripe
 * sends the event again later.
 */
export async function recordSubscription(change: SubscriptionChange): Promise<'recorded' | 'stale' | 'ignored' | 'unknown'> {
  const client = publicClient();
  if (!client) throw new Error('billing-unavailable');
  const { data, error } = await client.rpc('billing_record_subscription', {
    p_secret: process.env.VIANORAE_BILLING_SECRET, p_org: change.org, p_customer: change.customer, p_subscription: change.subscription,
    p_status: change.status, p_period_end: change.periodEnd, p_cancel_at_period_end: change.cancelAtPeriodEnd, p_event_created: change.created,
  });
  if (error?.code === '22023') return 'unknown';
  if (error || (data !== 'recorded' && data !== 'stale' && data !== 'ignored')) throw new Error('billing-unrecorded');
  return data;
}
