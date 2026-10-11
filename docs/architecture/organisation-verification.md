# Manual organisation verification

A confirmed email creates a personal sign-in, not an active organisation. The applicant submits the entity name and type, country, official website, optional public registry reference, representative name and role, and a description of how their authority can be confirmed. They explicitly accept the fixed responsibility statement. Website and email-domain matching are signals, never approval criteria on their own.

A platform administrator checks two things:

1. The entity exists and the submitted identity matches an independently obtained official source: a government website or registry, institutional directory, or equivalent reliable source.
2. The applicant is authorised to represent it. Confirm through an official contact obtained independently from that source, or verify a written mandate with its issuer. The applicant's supplied contact alone is insufficient.

Record the source, mandate confirmation reference/contact/method/date, both confirmations, and a message for the applicant. Do not approve an application until both checks are complete. Use “Request more information” or “Reject request” when evidence is incomplete or conflicting. Never collect passports or other identity scans through the free-text form. Verification concerns the organisation and representative; it does not certify the accuracy or accessibility of their visitor guides.

The review portal is `/{locale}/admin/organisations`, with EN/RO/DE translations. Only confirmed users explicitly present in `private.platform_admins` can open it or invoke the review RPC. Organisation `owner`/`admin` roles and editable Auth metadata cannot confer this permission. A different platform administrator must review an administrator's own application. Internal evidence and immutable decision events are readable only by platform administrators; applicants see their status and the applicant-facing note.

## Activation

Apply `supabase/migrations/20261007111624_organisation_verification.sql` once, after the existing four migrations, to the dedicated VIANORAE project `uzlngrzokjzxvdfpctnt`. Do not replay the original database installer. The owner delivery SQL combines this additive migration with an explicitly authorised initial administrator bootstrap; it validates the existing VIANORAE workspace schema and exactly one confirmed, non-anonymous Auth account with the selected email before changing anything. The selected email is an existing account in the VIANORAE database, not permission to access another application's database.

If the selected email has no confirmed VIANORAE Auth account, use the separate schema-only delivery SQL first. It assigns no platform roles and enables the new registration flow after deployment. Create and confirm the selected personal sign-in (or explicitly select an already confirmed account), then run the separate administrator bootstrap. The bootstrap refuses a missing/unconfirmed/ambiguous account.

An initial administrator role must be granted by trusted SQL administration, never by a public onboarding route. Granting this role does not approve that administrator's own organisation. A second, explicitly designated reviewer can be bootstrapped through trusted SQL administration when needed; there is no self-service admin promotion endpoint.

The application checks `organization_verification_schema_version() = 1`. If the migration is absent or inaccessible, registration, online editing and photo routes fail closed and explain that activation is in progress. The application gate alone cannot revoke an old database API: the SQL migration is required for the full security boundary. No service-role secret is added to the application.

## Existing organisations and enforcement

All existing organisations become `pending`; their content, memberships and private photos are retained. An existing owner submits the same verification information; the server links only that owner's pending organisation. Approval unlocks the existing data. Multiple pending organisations owned by one account require administrative handling rather than guessing which tenant to activate.

Approved new applications create exactly one tenant, a fixed owner membership and a responsibility acknowledgement in the same transaction as the review event. Tenant identity changes and approval-state changes are unavailable to ordinary clients. Existing private RLS and Storage checks require current approved status and a confirmed, non-anonymous Auth identity. Suspensions take effect on subsequent database/storage requests without requiring sign-out and also hide live public snapshots and QR redirects. The local fictional demo remains public.

The SQL rejects incomplete evidence, stale review/resubmission revisions, self-approval, direct application/event writes, unconfirmed/anonymous accounts, and approvals after the applicant's verified email changes. A submitted pending request cannot be silently edited under a reviewer. Requests for additional information and rejections allow a versioned resubmission. Suspended access can only be restored by a fresh manual review with the mandatory evidence.

## Validation

The isolated PostgreSQL security suite executes every real migration and exercises privilege escalation attempts, tenant isolation, direct API bypasses, evidence requirements, review revisions, legacy data retention and suspension. The isolated browser flow uses those migrations with simulated Auth/Storage HTTP services and covers request, information request, correction, approval, editing, private audit history, suspension and missing-migration gates. Public route, accessibility, reading/audio and local-demo regression checks remain part of CI.

No outbound review notifications are sent automatically. Administrators check the queue; applicants see decisions in their account. Supabase email confirmation still depends on the separately configured Auth URL and email delivery settings.


## Private mandate documents

Registration explains the two steps: confirm the personal email first, then upload mandate documents on the signed-in account page before submitting the organisation application. Uploaded files never enter Auth metadata, browser storage, public guides or public buckets. Submit requires one to three uploaded PDF/JPEG/PNG documents, each at most 3 MiB. The server checks file signatures, decodes/re-encodes images to strip metadata, and hashes the stored bytes. PDFs are downloaded as attachments with `nosniff`, a sandbox CSP and no caching; no PDF preview or malware-scanning service is claimed.

`20261007164203_mandate_documents.sql` adds immutable evidence metadata and a dedicated private Storage bucket. Confirmed applicants may reserve and upload their own staged documents; platform administrators can read only evidence bound to submitted applications. Storage has no UPDATE or DELETE policy. Staged uploads survive a page reload; choosing “Remove from this submission” only removes the association from the next submission. Reservations are capped at 10/day and 30/account. Unattached files are retained for now; a retention/cleanup policy is a separate operational decision.

Submission atomically validates ownership, object existence, upload completion and the complete document list, then binds the evidence to the application. Pending submissions and evidence lists cannot change. Corrections require an administrator's information request and the current revision; historical documents remain available for the decision audit. Approval requires explicit confirmation of every document, both independent verification checks and recorded sources. The audit records the reviewed document IDs and request snapshot. The former approval endpoint and private bypass functions are revoked. Existing approved tenants remain approved; legacy pending applications without documents need an information request before approval.

## Authentication email identity

`supabase/templates/confirmation.html` is the VIANORAE EN/RO/DE confirmation template. It uses the standard Supabase confirmation URL and the registration's language preference; user metadata is not used for authorisation. It removes Supabase branding and explains the document and manual-review steps. Prepared configuration is in `supabase/templates/auth-email-settings.example.json`. These files do not update a hosted project by themselves.

The default Supabase SMTP sender cannot be relabelled into an owned sender address. Custom SMTP is required for an actual VIANORAE From name/address; new Free projects using default SMTP also cannot customise templates after the June 3, 2026 policy change. Configure SMTP only in this project's Authentication settings. Use dedicated VIANORAE credentials; do not copy other projects' secrets. Disable the email provider's link tracking, retain email confirmation, and test delivery/redirect with the owner. No live SMTP configuration or email-template change is claimed until the provider and sender have been configured.


## Request feedback and administration entry

The header's Account menu links to sign-in, the organisation account, registration and platform administration. These links never grant permissions; the review route still validates the confirmed user and platform-admin role. Registration success is a prominent email-confirmation notice and explicitly states that the organisation request has not yet been submitted. The account page distinguishes email-confirmed/no request from received/awaiting review and shows administrator notes. Signup and resend errors distinguish email rate limits, unauthorised test recipients and unconfirmed accounts without disclosing whether another person's address is registered. The login page includes a resend-confirmation form.

The owner explicitly chose to retain Supabase's default mail sender during this phase. Custom SMTP and branded templates remain prepared reference files only; no live mail configuration, DNS, billing or other project's credentials are changed.
