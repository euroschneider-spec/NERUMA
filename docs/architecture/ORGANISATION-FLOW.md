# Organisation accounts, photographs and responsibility · 7 October 2026

## Available in the preview

- `/en/register`, `/ro/register`, `/de/register`: dedicated organisation registration, linked from the header, footer, organisation page and sign-in. Categories include institutions, museums, hotels, cultural venues, public services and other organisations.
- `/[locale]/dashboard/builder`: one JPEG/PNG/WebP photograph per zone, image preview, required alternative text, rights/credit and photography date. Files are limited to 5 MB, checked for format and decoded as images. Raster re-encoding removes original EXIF/GPS metadata and limits dimensions to 1600 px. Binary images use browser IndexedDB; only references and descriptive metadata enter the saved draft.
- Public fictional guide data remains independent of local drafts. The editor and local preview can show uploaded photos. Removing a photo from the draft restores the illustration; browser site-data clearing removes retained local images.
- Organisation responsibility appears at registration, on the organisation and terms pages, in the editor and before publication. It covers supplied content, completeness, accuracy, currency, image rights and ongoing updates, with a concrete explanation of the impact on visitors. It is not a blanket legal release of the platform’s own obligations.
- A separate publication review requires the responsible representative, check date and explicit acknowledgements. The exact saved draft is recorded locally with statement version `2026-10-07-v1`. Editing invalidates the displayed review and requires checking the new version. This neither publishes nor certifies a guide.

## Real accounts and manual approval

The dedicated Supabase project is `uzlngrzokjzxvdfpctnt`. The owner installed the first four migrations and previously confirmed the old signup → email confirmation → organisation creation flow. The fifth migration replaces immediate tenant creation with pending verification requests and revokes both old onboarding RPC entry points. See [the verification procedure](organisation-verification.md) for the new flow, administrator permissions and activation.

The separate VIANORAE Vercel project has dedicated Preview/Production settings and the authorised temporary public subdomain `vianorae.lignorae.com`. No service-role key or another application's credentials are used. Editable metadata only prefills suggestions; submitted identity and responsibilities are independently validated and recorded. Confirmed users without an approved organisation cannot access the online editor or private photographs.

Manual approval requires independent entity and representative checks, an evidence reference and an applicant-facing decision. Decisions are versioned and audited; applicants can correct requests when additional information is requested. Platform administrators are explicitly bootstrapped through trusted SQL and are separate from organisation admins. A reviewer cannot approve their own application.

Management API access still refuses this project, so the owner must apply the supplied additive migration and initial verified-account admin bootstrap. The application fails closed while activation is pending. Built-in Supabase email remains suitable for authorised development recipients; no automatic review notifications or production SMTP service is activated.

## Remaining activation and integration checks

1. Dedicated project provisioned by the owner: `uzlngrzokjzxvdfpctnt`. Never use another project as a fallback.
2. Schema installed manually; run Supabase advisors and regenerate database types when management access is available. Reconcile migration history before future CLI pushes.
3. Set only this project's `VIANORAE_SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the VIANORAE preview. The guard requires matching project ref/URL and a publishable key. No service-role key is used.
4. Enable email confirmation; configure the app URL and allow only the exact VIANORAE callback/branch URLs for redirects. Configure an appropriate email provider and abuse controls before public signup; built-in email delivery has development limits.
5. Owner-performed signup → confirmation → account → organisation creation passed. Still verify sign-out/re-login, expired links and a second user/tenant. PGlite tests do not replace authenticated multi-tenant integration checks.
6. Private guide persistence and photo storage are implemented at `/[locale]/workspace`, behind the dedicated configuration and workspace flag. The additional migration is installed and the API reports schema version 1. Perform an owner-operated live save/upload/reload check, then implement server-enforced publication review. The `/dashboard` editor remains a separate browser demo.

A Vercel preview branch remains separate from production. No custom domains, DNS, paid services or unrelated application settings are part of this change.

## Online editor

The account page links directly to the private organisation workspace. Owners/admins/editors can create locations, save 1–8 draft steps with all six sensory channels, reorder or remove steps, upload private photos and preview the persisted version. Images require localized alternative text, rights/credit and a valid photography date. Input is checked by the browser, server action and atomic database RPC. The photo API independently decodes/re-encodes images to prevent clients bypassing metadata stripping.

Save the initial location/zone before uploading. Upload creates a private file; a subsequent successful draft save attaches it. Detaching/replacing retains the processed private file. A failed or stale save does not claim publication or silently overwrite another revision. Publishing, QR registry activation and server-recorded publication responsibility review remain the next implementation.
