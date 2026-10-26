# Payments with Stripe: how it works, setting it up, testing it

Organisations pay to **publish**. Registering, building a guide and previewing it stay free. Why Stripe:
`docs/planning/DECISIONS.md`, "Payments go through Stripe". What was decided and built: `docs/briefs/2026-10-18-payments.md`.

**Nothing changes for anyone until you switch payments on** (section 4). You can set everything up, and test it with Stripe's
test mode, before that.

## 1. How it works

```
Owner                    NERUMA                        Stripe
  │  Plan & billing  ──▶  "Choose a plan"  ──────────▶  Checkout page (card or SEPA, VAT, price)
  │                                                          │ pays
  │  ◀── back on Plan & billing ("Stripe is confirming")     │
  │                       webhook  ◀────────────────────  "subscription active" (signed)
  │                       records the plan in the database
  │  Publish works; visitors see the guides
  │
  │  every month or year:  Stripe takes the payment and tells NERUMA again
  │  payment fails:        Stripe retries and emails the customer; NERUMA shows "online until <date>" (30 days)
  │  30 days later:        visitors and the QR code see "This guide isn't available right now"
  │  pays again:           everything is back at once, same address, same QR codes
```

- **One plan per organisation** covers all its locations. The price and the period (monthly, yearly) are set in Stripe, not in the
  code, so you can change them there.
- **Only owners** see *Plan & billing*. Admins who try to publish without a plan are told to ask an owner.
- **The organisation's id travels with the payment** (in Stripe, on the subscription, as `organization_id` under *Metadata*). That
  is how NERUMA knows whose payment it is.
- **The webhook** is the address Stripe calls after every change: `https://neruma.eu/api/stripe/webhook`. It accepts
  only messages signed with the webhook's signing secret, made in the last five minutes. It then asks Stripe for the subscription as
  it is now (events can arrive late or out of order), and writes it to the database through one function that can do nothing but
  record a plan, and only with `VIANORAE_BILLING_SECRET`.
- **The 30 days** start when Stripe first reports a payment as not made (past due, unpaid, cancelled, paused). A cancelled plan stays
  active until the end of what was paid, then has the same 30 days.
- **What Stripe holds**: the customer's name, billing email, address, VAT number and payment details. NERUMA holds only Stripe's
  customer and subscription numbers, the status and the dates (`docs/guides/PERSONAL-DATA.md`).

Where the code is: `src/lib/stripe-server.ts` (everything that talks to Stripe), `src/app/api/stripe/webhook/route.ts`,
`src/app/[locale]/workspace/billing/page.tsx`, `src/lib/billing.ts` (texts and states), and the database rules in
`supabase/migrations/20261018090000_payments.sql`.

## 2. Setting up Stripe (in test mode first)

Stripe's menu names change from time to time; if one below doesn't match, search for it in Stripe's dashboard. Do everything first
with **Test mode** switched on (the switch at the top of Stripe's dashboard). Test mode never takes real money.

1. **Account.** Create the Stripe account in the name of the company that sells (who that is is still open: brief, "Not in scope").
2. **The plan.** *Product catalogue → Add product*: name it "NERUMA plan", add a **recurring** price in EUR (monthly or yearly).
   Save, open the price and copy its id: it starts with `price_`.
3. **How people can pay.** *Settings → Payments → Payment methods*: card on, **SEPA Direct Debit** on.
4. **VAT (Stripe Tax).** *Tax → Get started*: your company's address, where you are registered for VAT, and the tax code
   "Software as a service". Checkout works out VAT and lets businesses enter their VAT number. Stripe charges a small fee for this.
   **Checkout fails while Stripe Tax isn't set up**, because NERUMA asks for it.
5. **Stripe's page for customers.** *Settings → Billing → Customer portal*: activate it. Allow updating payment methods, viewing
   invoices, and cancelling **at the end of the period**.
6. **Failed payments.** *Settings → Billing → Subscriptions and emails*: retry failed payments (for example Smart Retries over two weeks),
   and when all retries fail, **cancel the subscription**. Switch on the emails to customers about failed payments and expiring cards.
7. **Invoices.** *Settings → Billing → Invoices*: company details, VAT number, footer. Switch on "Email finalised invoices to customers".
8. **The webhook.** *Developers → Webhooks → Add endpoint*:
   - URL: `https://neruma.eu/api/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`
   - Save, then reveal and copy the **signing secret**: it starts with `whsec_`.
9. **The API key.** *Developers → API keys*: copy the **secret key** (`sk_test_…` in test mode). Never paste it anywhere but Vercel.
10. **The database secret.** Make a long random secret on your computer (any folder will do):

    ```sh
    openssl rand -hex 32
    ```

    It prints 64 letters and digits. Copy them; this is `VIANORAE_BILLING_SECRET`.
11. **Vercel** (*Project → Settings → Environment Variables*), for Production (and Preview if you test there):

    | Name | Value |
    |---|---|
    | `VIANORAE_STRIPE_SECRET_KEY` | the key from step 9 |
    | `VIANORAE_STRIPE_WEBHOOK_SECRET` | the signing secret from step 8 |
    | `VIANORAE_STRIPE_PRICE_ID` | the price id from step 2 |
    | `VIANORAE_BILLING_SECRET` | the secret from step 10 |

    Then redeploy. *Plan & billing* appears for owners only once all four are there and look right.
12. **Supabase** (*SQL Editor → New query*): install `supabase/migrations/20261018090000_payments.sql` (paste the whole file and run
    it), after the account profile migration. Then give the database the same secret (replace the text in quotes with the secret from
    step 10):

    ```sql
    update private.billing_policy set webhook_secret_sha256 = sha256(convert_to('PASTE-THE-SECRET', 'UTF8'));
    ```

    The database keeps only a fingerprint of the secret, not the secret.

## 3. Testing it by hand, in test mode (about 30 minutes)

Use an organisation owner's account on the real site (or a preview). Stripe's test cards and accounts:

| To test | Use |
|---|---|
| A payment that works | card `4242 4242 4242 4242`, any future date, any 3 digits |
| SEPA that works | IBAN `DE89 3704 0044 0532 0130 00` |
| SEPA that fails | IBAN `DE62 3704 0044 0532 0130 01` |
| A card that is accepted now and fails later (for renewals) | `4000 0000 0000 0341` |

1. **Paying.** Sign in as an owner, open *Plan & billing*. It says *Test mode* and *No plan yet*. *Choose a plan*: Stripe's page
   opens in your language, shows the price and VAT, and asks for a billing address. Pay with `4242…`. Back on *Plan & billing*: "Thank
   you…", and within a minute (reload) *Plan active. It renews on …*.
2. **Stripe received it.** In Stripe: *Developers → Webhooks → your endpoint*: each event has a green tick (answer 200). In
   *Customers*, the customer has the subscription, with `organization_id` under its metadata.
3. **Stripe's page for the customer.** *Change payment details or cancel* opens Stripe's page. Cancel there. Back on *Plan & billing*: *Plan
   cancelled. It stays active until …*.
4. **An admin** of the same organisation sees no *Plan & billing* in the sidebar.
5. **A failed renewal.** Make a second test organisation pay with `4000 0000 0000 0341`. In Stripe, open the subscription and use a
   **test clock** (*Billing → Subscriptions → Test clocks*: create a clock, a customer and a subscription on it, then move the clock
   past the renewal date). Stripe reports the payment as failed: the dashboard and *Plan & billing* say the guides stay online until a
   date 30 days later.
6. **Switching payments on, in test.** Only on a test or dev database: set the start date in the past (section 4). An organisation
   without a plan: Publish says *Publishing needs an active plan*, and its published guides, address and QR code say "isn't available".
   Pay: everything is back. Set the date back to empty afterwards.
7. **Languages.** *Plan & billing* and Stripe's page in Romanian and German (language menu).

If a step fails, section 6 says where to look.

## 4. Switching payments on

Tell the organisations first, with the date, **at least 30 days before** it. On that date, organisations without a plan can no longer
publish and their guides go offline. In Supabase, *SQL Editor* (the date and time in German time):

```sql
update private.billing_policy set required_from = '2027-01-01 00:00 Europe/Berlin';
```

To move it, run the same with another date. To switch payments off again:

```sql
update private.billing_policy set required_from = null;
```

Before the date, *Plan & billing* tells owners from when publishing needs a plan.

## 5. Going live with real money

Only after the email provider and the lawyer-checked terms and privacy text (TECH-TASKS, suggested order).

1. Sign Stripe's data-processing agreement (Stripe's *Settings → Legal*) and name Stripe on the privacy page as a processor.
2. In Stripe, switch **Test mode off** and repeat steps 2 to 9 of section 2: live mode has its own price, its own webhook (with its own
   signing secret) and its own keys (`sk_live_…`).
3. In Vercel, replace the three Stripe values with the live ones. Keep `VIANORAE_BILLING_SECRET` as it is. Redeploy.
4. *Plan & billing* no longer says *Test mode*. Pay once with a real card, check the invoice email, then refund it in Stripe
   (*Payments → the payment → Refund*) and cancel that subscription.
5. Run the deployed-site check: `SMOKE_URL=https://neruma.eu npm run test:smoke`.

## 6. Everyday tasks and when something goes wrong

- **Who has paid**: Stripe → *Billing → Subscriptions* (status and next payment) or *Customers*. The metadata `organization_id` is the
  organisation's id in NERUMA.
- **Refunds, invoices, changing the price**: in Stripe. A new price for new customers: add it to the product and put its id in
  `VIANORAE_STRIPE_PRICE_ID`; existing subscriptions keep theirs until you change them in Stripe.
- **Erasing an organisation or its last owner** (`docs/guides/ACCOUNT-DELETION.md`): **cancel its subscription in Stripe first**. NERUMA
  can't cancel it for you, so the deletions page refuses to erase (no Erase button, and the database refuses too) until Stripe reports the
  subscription as cancelled. A plan with a failed payment counts as still running. Stripe → *Billing → Subscriptions → the subscription →
  Cancel subscription*, then reload the deletions page.
- **A subscription made by hand in Stripe** must carry the metadata `organization_id` with the organisation's id, or NERUMA ignores it.
- ***Plan & billing* isn't in the sidebar**: one of the four Vercel values is missing or mistyped, or the migration isn't installed.
- **"Stripe couldn't be opened"**: the key or the price id is wrong, or Stripe Tax isn't set up (section 2, step 4). Stripe →
  *Developers → Logs* shows the refused request and why.
- **Paid, but *Plan & billing* still says *No plan yet***: look at the webhook's deliveries in Stripe. **400**: the signing secret in
  Vercel isn't this endpoint's. **500**: the database refused, usually because `VIANORAE_BILLING_SECRET` and the secret given to the
  database in section 2, step 12 differ (run that step again with the right secret). **404**: the four values aren't all in Vercel. Once
  fixed, *Resend* the event in Stripe. Stripe also retries failed deliveries for three days by itself.

## 7. What the automated tests check

- `npm run test:db`: only the secret records a plan; nobody reads or writes the plans table directly; without a plan (once switched
  on) publishing is refused and guides, QR codes and their rows are hidden; a failed payment leaves 30 days; an older event changes
  nothing; a second subscription ending doesn't end the paid one; owners and admins see the plan, only owners the Stripe customer; an
  organisation, or its last owner, can't be erased while Stripe still runs their subscription, and can once it is cancelled.
- `npm run test:unit` (`tests/unit/billing.test.ts`): Stripe's signature check (wrong secret, changed body, old messages), reading
  Stripe's events (old and new API versions), what is sent to Checkout, that the browser is only ever sent to Stripe's own pages, and
  every text in three languages.
- `npm run test:workspace`: the whole flow in a browser against a fake Stripe: an owner opens *Plan & billing*, goes to Checkout, a
  signed event activates the plan (a forged one is refused), Stripe's customer page opens; then, with payments switched on, a failed
  payment leaves the guide online, after 30 days the guide and QR code are unavailable and Publish asks for a plan, and paying again
  brings it back.

Not tested by machines: Stripe's real pages, real emails, test clocks, VAT amounts, and live mode. That is section 3.

## 8. Changing to another payment provider later

Everything that knows about Stripe is in `src/lib/stripe-server.ts` and the webhook route. Another provider replaces those two files;
the database, the pages and the 30-day rule stay. Customers would enter their payment details again with the new provider.
