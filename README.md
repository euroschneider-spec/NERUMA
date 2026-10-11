# NERUMA platform · foundation v0.1

A separate Next.js + TypeScript foundation based on `VIANORAE_plan_platforma_v0.1.pdf` (6 October 2026). Public pre-visit and sensory guides help visitors make their own decisions. VIANORAE does not certify venues, assign an overall accessibility score, or ask visitors for a diagnosis.

## Run locally

Use Node.js 24 (minimum 22), then:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/en`. No `.env` file, database or account is required for the demonstration.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:workspace
npm run start
```

`check` runs TypeScript, ESLint, isolated PostgreSQL security checks and the production build. Browser tests run against the production server, starting it if needed. `test:workspace` builds with explicit fake-project settings and runs two fictitious organisations against the real migrations in PGlite; Auth and Storage HTTP are simulated on loopback. It never contacts a live Supabase project. Run the anonymous demo tests before the workspace tests, because each uses a different build configuration.

## Included

- EN/RO/DE URLs with translated public content, explicit language choice and correct document language.
- Home, How it works, For organisations, Methodology, Example guide, Explore, Contact, Sign-in and organisation registration, Privacy, Terms and Accessibility draft pages.
- Fictional Willow Museum with five illustrated visit zones, six sensory bands, factual predictability information, source label, step navigation, skipping and completion.
- Demo workspace: overview, locations, local Guide Builder, preview, QR/share, role descriptions and settings.
- Versioned, validated browser-local drafts, separated by language. Public demo data remains fixed.
- Stable `/q/willow-museum` redirect and QR SVG at `/api/qr/willow-museum`.
- Reading preferences in a single fixed, movable, nonmodal popup opened from a tab docked to the left screen edge, with page scrolling available: text size, light/dark/high contrast, text spacing, reset and reduced-motion support.
- Optional browser read-aloud for pages, guide steps, complete guides and private online previews, with pause/resume/stop and speed. Matching EN/RO/DE voices depend on the device; no autoplay or paid TTS service.
- Sound-independent instructions/messages and a complete text view of every public/demo guide, with all steps, sensory labels and visit information.
- Five Supabase migrations, 26 RLS-protected public tables, relational tenant constraints, immutable guide snapshots, audit records and pilot provenance structures.
- Fictional local SQL seed, schema/domain types, automated checks and GitHub Actions workflow.
- Local zone photograph selection, binary storage in IndexedDB, alternative text, rights and photography dates.
- Organisation responsibility at registration, in the editor and in a deliberate pre-publication review.
- Authenticated online workspace with atomic database saves, revision conflicts, per-language steps and descriptions, private server photo storage, and saved-draft previews.
- Supabase SSR sign-in and email confirmation, organisation verification requests, and a separate platform-admin queue with mandatory entity/mandate evidence, review history and access suspension. Organisation editing requires manual approval in the application, database and private Storage policies.

## Demonstration boundaries

This is the **foundation and start of the MVP**. The public site is temporarily hosted at https://vianorae.lignorae.com with its own VIANORAE Vercel application and dedicated Supabase project `uzlngrzokjzxvdfpctnt`. Email confirmation establishes a personal sign-in; it does not authorise an organisation. Applicants submit verification information and await a platform administrator's recorded approval. See [manual organisation verification](docs/organisation-verification.md) for the evidence procedure and additive SQL activation. Existing organisations retain all data and require review. Until the verification migration is installed, online registration/editing fail closed.

Approved organisation accounts access the private database-backed Guide Builder at `/[locale]/workspace`; the public demonstration editor remains browser-local. Invitations, live publishing, assessor workflows, billing and PDF export remain to implement. Built-in email serves authorised development recipients; a production email provider is still required before public invitations. No automatic review emails are sent. The Contact form prepares an enquiry to copy; it does not send messages. Missing dedicated configuration disables account forms.

The illustrations are original example assets, not photographs or evidence of a real venue. Every Museum description is fictional. Translations and legal/accessibility statements are development drafts requiring professional and user review before a real pilot.

## Project isolation

Work is confined to the dedicated VIANORAE directory, `euroschneider-spec/Vianorae`, Vercel project `vianorae-platform` (`prj_wxGgoaJGSuHR7ko74qEDGuJWMFzy`) and Supabase project. The temporary `vianorae.lignorae.com` subdomain was explicitly authorised. No other application, database or secrets are shared or modified, and no paid service was provisioned.

Branch `foundation-v0.1` contains the complete application; remote `main` preserves the owner's initial README until review. The dedicated Supabase URL/ref/publishable key and workspace flag are configured for Production and this branch's Preview. The owner installed the first four migrations manually; the fifth verification migration and initial platform-admin bootstrap require the supplied additive SQL in the dedicated VIANORAE SQL Editor because management API access still refuses this project.

Read [the organisation-flow update](docs/architecture/ORGANISATION-FLOW.md), [architecture](docs/architecture/ARCHITECTURE.md), [database security](docs/architecture/DATABASE.md), [verification](docs/verification/VERIFICATION.md), and [next MVP phase](docs/planning/NEXT-STEPS.md).


## Recovery release — 8 October 2026

The displayed brand is NERUMA. The repository, Supabase project, existing bucket names,
environment variable names and browser persistence keys remain unchanged to preserve data.
The target public address is https://neruma.lignorae.com; domain activation is a separate
release step, not implied by this commit. Supabase default email delivery remains in use;
the templates in this repository are inactive examples, not SMTP configuration.
