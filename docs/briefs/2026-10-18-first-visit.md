---
status: done   # idea → building → done
date: 2026-10-18
---

# First visit of a new organisation

## Idea
Make the first visit of a brand-new organisation clear (`DESIGN-TASKS.md` section 8):

- The account page shows three steps (1. Email confirmed ✓ · 2. Send your request · 3. Wait for approval) with the form directly under them, instead of blocks of text.
- "Delete my account" and "Open demo workspace" don't appear before a request has been sent. Deletion shows only when there is something to delete, at the bottom; the demo link is dropped from this page.
- *Submit for manual review* says why it is disabled ("Upload your mandate document to continue"), and the line is available to screen readers.
- The workspace error page says what failed. "Your draft was not saved" is for a failed save only; a dashboard that couldn't load says so.

## Why
Found in the owner's test run as a brand-new organisation on production (2026-10-17). A new organisation can't tell what to do next, meets a disabled button with no reason, and gets a wrong error message when only the dashboard failed to load. It may give up before sending a request. Fits the principle "quick and simple, because organisations do the work themselves" in `docs/planning/DECISIONS.md`.

## Done when
On a phone first:

- [ ] A brand-new organisation signs in and sees three steps (email confirmed ✓, send your request, wait for approval) with the form right under them. "Delete my account" and "Open demo workspace" are not there until a request has been sent.
- [ ] With no mandate document uploaded, *Submit for manual review* is greyed out, the line "Upload your mandate document to continue" sits under it and a screen reader reads it. Uploading the document turns the button on.
- [ ] If the dashboard fails to load, the error page says the dashboard couldn't load. "Your draft was not saved" appears only when a save failed.

## Not in scope
- The rest of the registration flow: form fields, the responsibility consent text, the approval process.
- The account page for organisations that are already approved.
- New "what happens next" emails or notifications.
- The demo workspace stays reachable from the organisations page; only the link on the account page goes.

## Decisions
Choices made while building, with the reason. Copy the lasting ones into `docs/planning/DECISIONS.md`.

- The steps replace the "Your email is confirmed" box: step 1 says the same. A person asked for more information, or rejected, is shown at step 2 again, because the form is there.
- "Nothing to delete" means no request and no organisation yet. Platform administrators with no organisation keep seeing the deletion section.
- The error page can't know what failed, only where: on the dashboard it says the dashboard couldn't load, on any other workspace page it says the page couldn't load. "Your draft was not saved" is left to the editor's own save message.

## Result
Pull request: euroschneider-spec/vianorae#77.

Changed: `account/page.tsx`, `organisation-form.tsx`, `workspace/error.tsx`, new `onboarding-steps` (component and copy, EN/RO/DE), `globals.css`, `docs/PRODUCT.md`.

Run: typecheck, lint, `test:unit` (279), `test:db`, `test:workspace` (73, with new checks for the steps, the hidden links and the reason under the button), `tests/platform.spec.ts`.

Not run: the other browser specs; the workspace error page has no automated check (it needs a failing server render); not looked at on a real phone.
