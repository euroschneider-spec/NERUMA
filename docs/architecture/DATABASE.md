# Database foundation and safety boundaries

The CLI created all five migration filenames. Supabase CLI 2.81.3 was used after the newer CLI could not initialise its global config in the managed read-only home. PostgreSQL 17 is configured for future local Supabase use. The CLI remains unlinked. The owner installed the four migrations manually in the new dedicated Supabase project `uzlngrzokjzxvdfpctnt`; the VIANORAE preview uses that project. Manual installation did not populate CLI migration history: inspect and reconcile it before any migration push, and do not reapply the foundation.

`npm run test:db` executes all five migrations in an isolated PGlite PostgreSQL instance with test-only `auth.users`, `auth.uid()`, anon/authenticated/service roles and initially permissive default privileges. It tests real SQL grants, constraints and RLS; it does not substitute for a full Supabase integration test.

## Tables

Foundation: users, organizations, organization_members, templates, places, place_translations, zones, zone_translations, media_assets, sensory_profiles, guides, guide_steps, guide_versions, qr_redirects, audit_log.

Pilot structures: assessors, assessments, assessment_assignments, measurements, time_profiles, relief_features, reviews, external_certifications.

Subscriptions and API keys are deferred until their commercial/integration phase. No billing resources are provisioned.

## Access model

| Actor | Read | Write |
| --- | --- | --- |
| Public visitor | Published templates, published guide metadata, current snapshot, published QR routes | None |
| Owner | Own organisation and content, audit records | Own members, organisation, drafts, snapshots and publication pointer |
| Admin | Own organisation and content, audit records | Drafts, snapshots and publication pointer; no role administration |
| Editor | Own organisation and mutable content | Draft content; no publication, membership, verified label or snapshot changes |
| Assessor/reviewer | Own assignment and related pilot records | Closed pending trusted live workflow |
| Outsider with an account | Public published content | None |
| Trusted server / platform admin | Controlled server operations | Onboarding and pilot workflows, after server authorization is implemented |

Every public table enables RLS and explicitly revokes inherited client privileges before granting the required operations. Client roles receive no delete grants. UPDATE policies include USING and WITH CHECK. Tenant reassignment is additionally blocked by a trigger, including for users belonging to two organisations.

Internal membership and assignment lookups are SECURITY DEFINER functions in the non-exposed `private` schema. They have an empty search path, check `auth.uid()`, accept no caller-supplied user identity, and revoke PUBLIC execute access. Their purpose is scoped internal lookup without recursive RLS. Audit writes use a private trigger function; clients cannot forge audit records. Auth metadata is never trusted for roles.

Immutable guide versions permit INSERT by owners/admins, but no client UPDATE or DELETE. The guide's current-version foreign key ties publication to an existing snapshot. Public policies read only that current published version. The editable sensory profile and snapshot are constrained to `venue_provided`; independent claims cannot be invented through normal client writes. Separate assessment tables retain future verified provenance. Publication should become one server-controlled transaction with full content validation before live use.

The private `platform_admins` table has no client policies or direct client grants. Assignments and assessor training must be created by a trusted server. Pilot tables are read-only for clients, so this foundation does not accidentally expose an unimplemented approval workflow.

## Fictional seed

`supabase/seed.sql` creates one explicitly fictional, draft Museum with five zones and EN/RO/DE translations. It contains no auth accounts, passwords or memberships and publishes no guide. It is generated from the same typed demonstration data by `node scripts/create-demo-seed.mjs`. It is intended for a disposable local database or the dedicated project only, after deliberate review. The manual installer does not apply this sample seed.

## Before connecting a new live database

1. Create the dedicated project under the intended owner and select an EU region where feasible. Do not select an existing database.
2. Apply and test migrations on a disposable branch/local stack; run Supabase security/performance advisors.
3. Regenerate schema types from that new schema; configure Supabase Auth SSR with server-validated identity.
4. Implement onboarding, last-owner protections, invitation validation and server-authorized membership management before exposing role controls.
5. Implement atomic publication with complete snapshot validation, assigned-assessor checks, independent reviewer separation, validity/expiry logic, and trustworthy source mapping.
6. Configure private Storage buckets and tenant-specific media policies before enabling uploads. The online-builder migration creates only the private `vianorae-private-photos` bucket, capped at 3 MB of WebP per object, with tenant/known-zone SELECT and immutable INSERT policies. UPDATE and DELETE are not granted by those policies.
7. Validate actual Data API grants and RLS in the real Supabase stack. Recent Supabase changes remove automatic Data API exposure; explicit grants in these migrations address that difference.
8. Keep publishable keys separate from server-only keys; never place a service key in a `NEXT_PUBLIC_` variable. Add retention, processor agreements and backup procedures before the pilot.

The original organisation-onboarding migration added the controlled first-owner bootstrap and responsibility record. The fifth migration revokes that automatic creation path. Confirmed users submit pending verification requests; only a separately bootstrapped platform administrator can approve them after mandatory independent entity/mandate evidence. Existing tenants remain pending with content retained. Current approval is required by private content RLS and Storage; suspension also hides public snapshots. Direct client updates to verified organisation identity/status are revoked. See `organisation-verification.md`. Live management/advisor access remains unavailable.

## Online workspace migration

`20261007074309_online_builder_private_photos.sql` adds place revisions, localized next-step text, active/history flags, stable step ordering, private Storage policies and `save_place_draft`. The owner installed it in the existing dedicated VIANORAE database; a read-only public API probe confirms version 1. It is additive and deletes no records or files.

The invoker RPC checks verified non-anonymous identity and owner/admin/editor membership, locks the place, checks the expected global revision, validates all input and saves the draft in one transaction. Invalid data, cross-place IDs, absent photo files and stale revisions roll back the whole operation. Server identity never comes from caller-supplied user metadata. Public guide snapshots and publication status are unchanged by a draft save.

Photo keys contain organisation/place/zone/asset UUIDs. Storage authorization checks verified editable membership and an existing zone belonging to that place and organisation. Each file has an immutable key; metadata attaches it only after checking the private object exists. Detaching or replacing a photo retains its private file and metadata history. Removed steps become inactive for their guide language; core zone records remain. Descriptions and step order are per language; venue facts, sensory fields and photos are shared. A global revision prevents simultaneous language/device saves from silently overwriting one another.

Sixty-one SQL scenarios test actual grants, RLS, constraints, atomicity, onboarding, tenant isolation, immutable snapshots and photo policies in PGlite. The Storage schema is a minimal test fixture: these checks do not exercise the hosted Storage service itself. `npm run test:workspace` additionally runs the application, real image re-encoding and browser flows against those migrations with simulated Auth and Storage HTTP. Live advisors and hosted multi-tenant tests remain pending management access.
