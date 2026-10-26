# Personal data: what NERUMA holds, where, and what is still undecided

Written 2026-10-13 from the migrations and the code, not from memory. Updated 2026-10-14: deleting an account exists now
(`docs/guides/ACCOUNT-DELETION.md`); the "Blocks deleting the user" column describes the tables, and `erase_account` handles each of them. It is the **input** for three things: the privacy
notice (to be drafted with a lawyer), "Delete my account and export my data" (TECH-TASKS §13 step 3), and the terms
acceptance (§13).

**What is fact and what is a decision.** *What* is stored, *where*, and *who can read it* are facts about the code, and are
listed here. The **legal basis** for each item, **how long** to keep it, who is the **controller**, which companies are
**processors**, and what the privacy notice and terms must **say** are decisions for the owner and a lawyer. Each is marked
**DECIDE**. This is not legal advice.

Visitors have no accounts and are not tracked (no analytics, no third parties; see the privacy page). Everything below is
about organisations and administrators.

## 1. Where personal data lives

Whose data: the **applicant or member** (the person who registers), the **administrator** who reviews, and occasionally
**third parties** named in free text.

### Sign-in (Supabase Auth: Supabase's own tables, not in our migrations)

| What | Detail | Who can read it | Removed on user deletion |
|---|---|---|---|
| `auth.users.email` | The work email | Supabase; the email is copied into the tables below | Yes (it is the user) |
| `auth.users` password | A hash only; we never see or log the password | Supabase | Yes |
| `auth.users.raw_user_meta_data` | **A copy of the whole registration form** written at sign-up: display name, organisation name and type, preferred language, and the full request (representative, role, website, country, registry reference, authority text). Stored even if the email is never confirmed or the request never submitted. The account holder can edit it. | Supabase; the app reads it only to prefill the form | Yes |
| `auth.mfa_factors` | The authenticator-app secret and backup-code status | Supabase | Yes (Supabase removes it with the user) |
| Sessions, sign-in times, IP addresses | Supabase's own logs and tables | Supabase | **DECIDE**: check how long Supabase keeps them (dashboard → Logs) |

### Our tables (`public` and `private`)

| Table.column | What | Who can read it | Public? | Blocks deleting the user? |
|---|---|---|---|---|
| `public.users.display_name` | The representative's name | The user | No | **Yes** |
| `public.organization_applications` (`applicant_email`, `representative_name`, `representative_role`, `authorization_description`, `official_website`, `registry_reference`, `applicant_note`) | The request: who, in what role, how to confirm it, and the administrator's note back | The applicant; platform administrators | No | **Yes** |
| `public.organization_evidence_documents` + bucket `vianorae-mandate-evidence` | File name, type, size, a fingerprint, and **the file itself**: signed letters carry names and signatures | The applicant; platform administrators | No | **Yes** |
| `public.organization_review_events` (`application_snapshot`, `verified_source`, `evidence_reference`, `applicant_note`, `actor_id`) | The review history. A **full copy of the request**, and what the administrator did to verify the person (contacts, sources). Immutable by design. | Platform administrators | No | **Yes** (`actor_id`) |
| `public.organization_acknowledgements` | Proof of what the representative accepted: name, version, language, time | Platform administrators | No | **Yes** |
| `public.organization_members` | Which user has which role in which organisation | Members of that organisation; administrators | No | **Yes** |
| `public.problem_reports` (`reporter_email`, `message`, `reporter_id`, `closed_by`) | A report to NERUMA: sender's email and free text | The sender's organisation (owners, admins); administrators | No | **Yes** |
| `public.audit_log` (`actor_id`, `before_json`, `after_json`) | A **row-by-row history of changes** to places, steps, guides, own fields and **problem reports**: so the reporter's email and message are copied here too | Owners and admins of the organisation | No | **Yes** (`actor_id`) |
| `public.guide_versions.created_by` | Who published each version. Published versions are immutable. | The organisation | The version is public; the author is not | **Yes** |
| `public.organization_change_log` (`actor_id`, `changes`) | What a **platform administrator changed** while visiting an organisation: which record, from what into what, when, and which administrator | The organisation's owners and admins see the change, never the administrator's address; platform administrators see the address | No | No: `actor_id` is emptied with the administrator's account; the rows go with the organisation |
| `private.admin_visits` | Which platform administrator is visiting which organisation now (one row each, valid eight hours) | Nobody through the app | No | No: removed with the user |
| `private.platform_admins` | Who is an administrator | Platform administrators, who also see every account (email, dates, organisations, two-factor on or off) in `/admin/accounts` and on each account's profile page (`/admin/accounts/<id>`, which adds the organisation request and any deletion); nothing new is stored, and views are not recorded | No | **Yes** |
| `private.remembered_devices`, `private.trusted_sessions` | A hash of a remembered-device token, and dates. No device name, browser or IP. | The account holder (dates only) | No | No: removed with the user |
| `private.account_deletions`, `private.deletion_takedowns` | A deletion in progress: who, when asked, when due, which administrator started it, which guides went down | Platform administrators | No | No: removed with the user |
| `private.organisation_holds` | An organisation hidden after its only owner asked to be deleted, and who that was | Platform administrators | No | No: `former_owner` is emptied with the user |
| Bucket `vianorae-account-exports` | A person's own export (a ZIP), kept for the 7 days its link works | The person, through the private link | No | Yes (removed before the erase) |
| Pilot tables: `assessors`, `assessment_assignments`, `assessments`, `reviews` | User ids and reviewers' notes. **Not used by the app today.** | Staff of the organisation | No | **Yes** |

### Organisation-written content (may name or show third parties by mistake)

| Table.column | What | Public? |
|---|---|---|
| `public.place_translations`, `zone_translations`, `zone_field_translations` (names, descriptions, notes, own fields) | The guide text. Organisations are told to describe the place, but staff names or contact details can end up in it. | Yes, once published |
| `public.media_assets` (`alt_text`, `rights`) + bucket `vianorae-private-photos` | Photographs, their descriptions, and who holds the rights: a photographer's name may be in `rights`. A photo can show people. | Yes, for published guides |
| `public.guide_versions.content` | The published snapshot of the above | Yes |

### Not on our servers

- **The visitor's device:** cookies and local storage, listed on the privacy page. Nothing leaves the device except through the sign-in cookies.
- **Vercel (hosting):** request logs, which normally include IP address and browser. **DECIDE**: confirm retention.
- **The future email provider (TECH-TASKS §4):** the recipient's address and the message.
- **Stripe (payments, `docs/guides/PAYMENTS.md`):** for each paying organisation, the name, billing email and address, VAT number and
  payment details the owner types on Stripe's pages, the invoices and payments. NERUMA keeps only Stripe's customer and subscription
  numbers, the plan's status and dates (`public.organization_subscriptions`, readable through `billing_status` by owners and admins).
  Erasing an organisation doesn't cancel its Stripe subscription or delete the Stripe customer: an administrator does that in Stripe.
  **DECIDE**: retention in Stripe (invoices must be kept 10 years under German tax law); Stripe as a processor (D5).

## 2. Findings that change decisions

1. *Resolved by `20261016090000_account_deletion.sql` (`erase_account`, checked in `test:db` by scanning every column for the person's id
   and email afterwards). Kept for the record:* **A user could not be deleted.** 15 foreign keys in 14 of our tables point at `auth.users` with "no action", so deleting an account that has
   registered, filed a report, been reviewed or published a guide **fails**. The list is the "Blocks deleting the user" column
   above. Only an account that never did anything (an unconfirmed sign-up) can be removed, and Supabase's own "Delete user"
   button will fail for the rest. §13 step 3 therefore needs a design, not a button: for each row either **delete**,
   **anonymise** (keep the row, remove the person), or **keep** (and say why).
2. **The same personal data is copied in several places**, so deleting one row isn't deleting the data: the registration form
   lives in `auth.users.raw_user_meta_data`, `organization_applications`, `organization_review_events.application_snapshot` and
   `organization_acknowledgements`; a problem report lives in `problem_reports` and again in `audit_log`.
3. **Some records are immutable on purpose** (review history, published versions, acknowledgements). A deletion request
   collides with that. **DECIDE** whether they are kept (a legal obligation or a legitimate interest, and for how long), or
   anonymised.
4. **Nothing is deleted automatically.** There is no retention job: requests, documents, reports and audit entries stay forever.
   (Remembered devices are the only thing that expires.)
5. **Dynamic pages run in the US.** The static pages are served from Frankfurt, but every dynamic page (registration, sign-in,
   the workspace) ran in Washington D.C. when checked on 2026-10-13: the response header reads `x-vercel-id: fra1::iad1::…`.
   No region is set in the project. So the registration form's contents are processed in the US on their way to an EU
   database. Fix, when you agree: set the function region to Frankfurt (Vercel project → Settings → Functions → Region, or a
   `vercel.json` with `"regions": ["fra1"]`). Whether any transfer outside the EU is acceptable is **DECIDE**.
6. **Administrators see a lot.** Platform administrators can read every request, document, report and review. **DECIDE** how
   many there should be, and whether access should be logged.
7. **The database region is unverified.** The docs say West EU (Ireland); confirm it in Supabase → Project Settings.

## 3. Decisions for the owner and the lawyer

| # | Question |
|---|---|
| D1 | Who is the **controller** (legal name, address, contact for data requests)? |
| D2 | The **legal basis** for each group: running an account, verifying an organisation (a legitimate interest?), keeping the review history, problem reports. |
| D3 | **Retention** for each group: unconfirmed sign-ups, rejected requests, approved organisations, documents, reports, audit entries, review history, accounts after deletion. |
| D4 | The **deletion rule** for each blocking row above: delete, anonymise or keep. |
| D5 | **Processors** and agreements: Supabase, Vercel, the email provider, Stripe. Regions, and whether a transfer outside the EU is acceptable (finding 5). |
| D6 | How a person **asks** (an email address, a form), and the time we answer in. Export format. |
| D7 | What to do if data leaks (who is told, within how long). |
| D8 | Whether to keep the **registration form copy** in `raw_user_meta_data` at all. It exists to prefill the form after email confirmation. A shorter lifetime, or none, is possible. |

## 4. The column list the build checks

`scripts/test-database.mjs` reads this block. It fails if a column that looks personal (it points at a user, or is named like an
email, a name, a note, a file name, a free-text message or a snapshot) is **missing from this list**, or if a column here no
longer exists. A new table with personal data therefore can't be added without being written down here, and then in §1.

<!-- personal-data-columns:start -->
private.account_deletions.requested_by
private.account_deletions.user_id
private.admin_visits.user_id
private.deletion_takedowns.user_id
private.organisation_holds.former_owner
private.platform_admins.user_id
private.remembered_devices.token_hash
private.remembered_devices.user_id
private.trusted_sessions.user_id
public.assessment_assignments.user_id
public.assessments.instruments
public.assessments.reviewer_id
public.assessors.user_id
public.audit_log.actor_id
public.audit_log.after_json
public.audit_log.before_json
public.guide_versions.content
public.guide_versions.created_by
public.media_assets.alt_text
public.media_assets.rights
public.organization_acknowledgements.representative_name
public.organization_acknowledgements.user_id
public.organization_applications.applicant_email
public.organization_applications.applicant_id
public.organization_applications.applicant_note
public.organization_applications.authorization_description
public.organization_applications.official_website
public.organization_applications.registry_reference
public.organization_applications.representative_name
public.organization_applications.representative_role
public.organization_change_log.actor_id
public.organization_evidence_documents.applicant_id
public.organization_evidence_documents.filename
public.organization_members.user_id
public.organization_review_events.actor_id
public.organization_review_events.applicant_note
public.organization_review_events.application_snapshot
public.organization_review_events.evidence_reference
public.organization_review_events.verified_source
public.place_translations.arrival_info
public.place_translations.short_description
public.problem_reports.closed_by
public.problem_reports.message
public.problem_reports.reporter_email
public.problem_reports.reporter_id
public.reviews.notes
public.reviews.reviewer_id
public.users.display_name
public.users.id
public.zone_translations.description
public.zone_translations.useful_note
<!-- personal-data-columns:end -->
