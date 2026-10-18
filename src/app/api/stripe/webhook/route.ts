import { recordSubscription } from '@/lib/billing-server';
import { currentSubscription, stripeConfigured, subscriptionInEvent, verifyStripeSignature } from '@/lib/stripe-server';

// Stripe's events are small; anything far larger is not one.
const maxBytes = 512 * 1024;
const answer = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Stripe tells NERUMA about subscriptions here (docs/guides/PAYMENTS.md). Only a correctly signed, recent event is read. A 2xx answer
 * tells Stripe it arrived; any other answer makes Stripe try again later, for up to three days.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return answer(404);
  const declared = request.headers.get('content-length');
  if (declared !== null && !(Number(declared) <= maxBytes)) return answer(413);
  const payload = await request.text();
  if (payload.length > maxBytes) return answer(413);
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), process.env.VIANORAE_STRIPE_WEBHOOK_SECRET!)) return answer(400);
  let event: unknown;
  try { event = JSON.parse(payload); } catch { return answer(400); }
  const subscription = subscriptionInEvent(event);
  // Other event types need nothing from NERUMA.
  if (!subscription) return answer(200);
  try {
    const change = await currentSubscription(subscription);
    // A subscription that names no organisation is not NERUMA's to record.
    if (change) await recordSubscription(change);
    return answer(200);
  } catch {
    return answer(500);
  }
}
