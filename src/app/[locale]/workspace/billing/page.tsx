import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, longDate } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { getBillingCopy, managesInStripe, planState } from '@/lib/billing';
import { getBillingStatus } from '@/lib/billing-server';
import { stripeConfigured, stripeTestMode } from '@/lib/stripe-server';
import { fill } from '@/lib/publishing';
import { workspaceConfigured, workspaceSession } from '@/lib/workspace-server';
import { openBilling } from '@/app/workspace/actions';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getBillingCopy(isLocale(locale) ? locale : 'en').title, robots: { index: false, follow: false } };
}

/** Plan & billing (docs/guides/PAYMENTS.md): where the plan stands, and one button to Stripe. Owners only. */
export default async function Billing({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ org?: string; checkout?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getBillingCopy(locale);
  const context = await workspaceSession(locale);
  const { org: chosen, checkout } = await searchParams;
  const membership = chosen ? context.memberships.find((m) => m.organisation === chosen) : context.memberships[0];
  if (!membership || !workspaceConfigured()) notFound();
  const org = membership.organisation;
  const back = `/${locale}/workspace${context.memberships.length > 1 ? `?org=${org}` : ''}`;
  const status = membership.role === 'owner' && stripeConfigured() ? await getBillingStatus(context.supabase, org) : null;
  const state = status ? planState(status) : null;
  const date = (value: string | null) => (value ? longDate(value, locale) : '');
  return (
    <main id="main-content" className="app-main">
      <div className="app-heading">
        <div>
          <h1>{t.title}</h1>
          <p className="lead">{t.intro}</p>
        </div>
        <Link className="quiet-link" href={back}>{getWorkspaceCopy(locale).dashboard}</Link>
      </div>
      {membership.role !== 'owner' ? <p>{t.ownersOnly}</p> : !stripeConfigured() ? <p>{t.notReady}</p> : !status || !state ? <p role="alert">{t.error}</p> : (
        <section className="billing-plan" aria-label={t.title}>
          {checkout === 'done' && <p className="notice" role="status">{t.returned}</p>}
          {checkout === 'cancelled' && <p className="notice" role="status">{t.cancelled}</p>}
          {checkout === 'error' && <p className="notice notice-warning" role="alert">{t.startError}</p>}
          {stripeTestMode() && <p className="notice">{t.testMode}</p>}
          {!status.required && <p>{status.requiredFrom ? fill(t.freeUntil, { date: date(status.requiredFrom) }) : t.free}</p>}
          <p className={state === 'grace' || state === 'ended' ? 'notice notice-warning' : undefined}>
            {state === 'none' ? (status.required && !status.allowed ? t.noneRequired : t.none)
              : state === 'pending' ? t.pending
              : state === 'active' ? (status.periodEnd ? fill(t.active, { date: date(status.periodEnd) }) : t.activeNoDate)
              : state === 'ending' ? fill(t.ending, { date: date(status.periodEnd) })
              : state === 'grace' ? fill(t.grace, { date: date(status.graceUntil) })
              : t.ended}
          </p>
          <form action={openBilling.bind(null, org, locale)}>
            <button type="submit" className="button">{managesInStripe(status) ? t.manage : t.choose}</button>
          </form>
          <p className="muted">{managesInStripe(status) ? t.manageNote : t.chooseNote}</p>
        </section>
      )}
    </main>
  );
}
