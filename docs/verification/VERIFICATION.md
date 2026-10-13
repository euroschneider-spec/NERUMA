# Verification · 7 October 2026

## Verified flows

Public EN/RO/DE pages, the fictional account-free Museum guide, QR navigation, reading preferences and browser-local demonstration editing remain covered by 47 Playwright scenarios, including eleven reading-panel/text checks and seven optional-speech/visibility checks. Real signup, email confirmation and first-owner organisation creation in the dedicated Vercel/Supabase preview were confirmed separately by the project owner.

The online workspace is tested through the production Next.js server with two fictitious verified owners and separate organisations. The application uses its actual SSR cookies, server actions, image API and all five database migrations. An isolated PGlite PostgreSQL database enforces real RLS and constraints. Test-only Auth and Storage HTTP fixtures run on loopback; no real accounts, emails, files or application rows are created remotely. These are full local application-flow checks, not hosted Supabase service tests.

## Checks

| Check | Result |
| --- | --- |
| Strict TypeScript | PASS |
| ESLint / React checks | PASS |
| Next.js production build | PASS with missing configuration and with explicit workspace fixture configuration |
| Deployment packaging | PASS; all runtime source/assets and build inputs retained, root tooling excluded |
| Database checks | PASS; 61 SQL security, consent, atomic save, conflict, translation and Storage-policy scenarios |
| Public/demo browser scenarios | PASS; 47 scenarios: 29 existing regressions, 11 reading/text checks and 7 speech/visibility checks |
| Online workspace flow | PASS; all 31 scenarios |
| Production dependency audit | PASS; 0 reported vulnerabilities |

The new verification checks cover confirmed-account requests without editor access, admin-only queue access, mandatory approval evidence, requests for information, versioned resubmission, manual approval, private audit evidence, suspension without sign-out, EN/RO/DE accessibility and 320px/200% reflow, and missing-migration registration/editor/photo denial.

The online checks cover unauthenticated redirects/API denial; real app sign-in against simulated Auth; initial save before upload; persistent location/sensory values; PNG-to-private-WebP upload; server resizing and removal of original metadata; saved preview; access in a separate browser session; stale revision refusal with unsaved text retained; cancellable unsaved navigation; cross-tenant place/preview/photo denial; malformed image rejection; step reorder/removal; independent Romanian text/photo alt; EN/RO/DE WCAG A/AA axe checks; 320px reflow with 200% text; photo detachment retaining its private file; and sign-out revoking app access.

An early full-flow check exposed select labels containing option text; the new editor now uses explicit label/control associations. Another exposed translation initialization including retained removed zones; new languages now start from an existing guide's active steps. Both fixes are included in regression coverage.

Existing browser checks also cover corrupt browser data, locale separation, public/draft separation, local photo format/size rejection and IndexedDB persistence, saved-version responsibility review, enabled/disabled account configuration, mobile navigation, dark/high contrast, reading settings and contact preparation without outbound messages. Automated axe rules do not establish complete WCAG conformance.

## Reading and sound-independent access

A single fixed launcher and nonmodal popup replace the header duplicate and permanent media column. EN/RO/DE checks exercise initial focus, Escape, return focus, readable preferences, axe WCAG A/AA and 320px/200% reflow. Browser checks assert the launcher is docked at x=0 on desktop and mobile. Desktop browser-wheel checks confirm that the page scrolls while both the open popup and launcher retain their screen coordinates. Additional checks cover drag/arrow-key/single-click movement, reset, resize bounds, Tab leaving the popup and outside-click focus preservation.

Complete text mode includes all five steps, sensory labels, useful notes, next instructions and general/provenance information. It works without audio/video/images, reads the saved local draft, and retains the current step when returning to step-by-step mode. All instructions and messages are written on screen. No recorded audio/video files are present; optional synthetic speech reads the same visible text; future media requirements are documented in `guides/ACCESSIBILITY.md`. No database migration was required.

Optional speech tests simulate the browser speech engine and cover no autoplay, matching EN/RO/DE voices, pause/resume/stop/speed, all guide content, chunk bounds, stale cancellation callbacks, failure, missing voices with retry, unsupported browsers and competing-reader cancellation. Page narration excludes form input values and stops on close or navigation. The online fixture additionally verifies that private narration includes the saved location, description, image alt and sensory labels and excludes fictional Willow data. These checks do not establish audible output quality on physical devices.

## Live evidence and limits

- The new-account Supabase project is `ywbcsvswisorlgajbkev`. The owner installed the foundation (24 public tables, all RLS) and additional online-builder migration. A read-only API probe confirms `workspace_schema_version = 1` with HTTP 200. Do not repeat the initial installer; reconcile manual migration history before a CLI push.
- The dedicated public key is accepted by Auth; email confirmation is required and anonymous Auth is disabled. Anonymous internal reads and onboarding are denied. Those API probes are read-only and created no rows/accounts.
- The owner confirmed real signup → email confirmation → account → organisation creation in the deployed preview. A live owner-operated save/photo/reload pilot is still required for the new builder. Local fixtures cannot establish actual hosted Storage/API behaviour or email delivery.
- Vercel preview protection previously denied automated fetch access (403); protection is retained. No automated live browser walkthrough is claimed.
- No production SMTP provider, invitation flow, account recovery flow, public guide publishing, live QR registry or billing is enabled. Built-in email delivery remains suitable for authorized development recipients only.
- Supabase management access still refuses the new project. Live advisors and schema-generated type refresh remain pending; the application uses no service-role key.
- Manual screen-reader testing, user testing, professional language/legal review and methodological calibration remain for pilot readiness.

## Reproduce

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:workspace
```

Run the demo checks first: the workspace command deliberately builds with fictitious configuration and shuts down its owned fixture/server after testing. CI runs both suites. Test fixture scripts are excluded from Vercel deployments and never imported by application code.

## Evidence

`home-preview.png`, `mobile-preview.png`, `guide-preview.png`, `workspace-preview.png`, `builder-photo-preview.png` and `registration-preview.png` cover the public/local foundation. `reading-panel-preview.png` and `text-guide-preview.png` show the new localized reading/text views. `media-controls-preview.png` and `audio-guide-preview.png` show the fixed popup and optional voice controls. `organisation-verification-preview.png` shows the platform review controls and private audit history with fictitious fixture evidence. `online-builder-preview.png` shows the authenticated editor with entirely fictitious local-fixture data.

## Packaging regression

An earlier Vercel failure was caused by an unanchored `supabase` exclusion removing nested `src/lib/supabase` modules. Root-only exclusions and `npm run check:deployment` now protect application files from that regression.

## Verification activation boundary

The additive verification migration and initial platform-admin bootstrap are supplied for manual execution in the dedicated VIANORAE SQL Editor. Application gates fail closed until `organization_verification_schema_version()` returns 1. The full database boundary is active only after that SQL runs; local tests and a Vercel deployment cannot establish that it has been applied live. Existing organisations are retained pending review. The bootstrap grants platform administration to the selected confirmed VIANORAE Auth identity and does not approve its own application.
