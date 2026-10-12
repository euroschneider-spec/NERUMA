---
status: building   # idea → building → done
date: 2026-10-12
---

# The demo shows the real organisation app

## Idea
The demo workspace should be what an organisation actually gets: the same sidebar, dashboard, step editor,
preview and QR code as a signed-in organisation, filled with realistic but fictional data. A visitor can try
everything except publishing. Their changes are kept only in their own browser, so two people exploring the demo
at the same time never see or overwrite each other's work. (Owner, 2026-10-12.)

## Why
Today `/dashboard` is a separate, older builder with its own pages (overview, locations, builder, preview, share,
team, settings). It no longer matches the organisation app, so it shows organisations something they won't get.
`DECISIONS.md` already says the demo gets the same shell as the real one; this brief says how.

## Done when
Checked on a phone first, then at 1280px, in EN, RO and DE.

- [ ] `/en/demo` opens the organisation app shell (sidebar with "Willow Museum (demo)" and *Owner*), with one calm
      strip at the top: "Demo · your changes stay in this browser" and a *Reset demo* button.
- [ ] The dashboard shows two location cards from the real card component: the **Willow Museum**, *Published*, with
      a photo, nothing needing attention, a working **QR code and link** that open the example guide, and sample
      visits; and a **garden pavilion**, *Draft*, two steps, so *Needs attention* says "Add at least 3 steps".
- [ ] *Edit* opens the real step editor. Changing a step and pressing *Save* keeps the change after a reload; a
      private window (or another browser) still shows the original; *Reset demo* brings the original back.
- [ ] *Preview* shows the visitor's own saved changes with the guide component visitors see.
- [ ] *Publish* is visible but switched off, with "Publishing is switched off in the demo." Nothing is written to the
      server: no request to `/api/workspace/*`, no server action, no database row.
- [ ] `/en/dashboard` and every old `/dashboard/...` address redirect to `/en/demo`.
- [ ] axe passes on the demo dashboard, editor and preview in dark, light and high contrast.

## Not in scope
- *Report a problem*, *Team*, *Plan & billing* and the administrator pages in the demo (hidden there for now).
- Showing a visitor's own edits behind the QR code: they exist only in that browser. The QR opens the public example.
- The live preview in a second tab (brief `2026-10-11-organisation-app.md`, Task 2); it will work in the demo too.
- Moving the *Reading settings* button into the sticky header: a separate, small pull request (decided the same day).
- Removing the dev:mock-only sample QR and visits from the real workspace (#30); revisit once the demo exists.

## Decisions
- **Same components, not copies** (owner): one editor, one dashboard card list, one sidebar. Only where the data is
  kept differs, so the demo cannot drift from the real app again.
- **Saved only in this browser** (owner): browser storage, private to each visitor, nothing on the server, nothing to
  clean up. Changes stay until *Reset demo* or until the visitor clears their browser data.
- **Address `/demo`** (owner); the old `/dashboard` addresses redirect.
- **Two locations** (owner): one complete and published, one unfinished, so both card states and *Needs attention*
  are visible.
- **Same language rules as the real app:** step names and descriptions are kept per language; photos, sensory levels,
  step order, removed fields and yes / no answers are shared by all languages, as the editor tells organisations.
- **QR only on the published location**, as in the real app (`DECISIONS.md`, "QR codes"), and it uses the existing
  `willow-museum` code, which opens the example guide.

### Technical design (agreed before building)
1. **A store chosen by mode.** `OnlineBuilder` gets `mode: 'live' | 'demo'` (functions can't be passed from a server
   page to a client component, so the client picks the implementation). Both stores have the same shape:
   `save(draft) → SaveResult`, `uploadPhoto(file, zone, placeId) → OnlinePhoto | error`, `photoSrc(photo) → string`,
   `previewHref(placeId)`, `canPublish`. Live wraps the existing `savePlaceDraft` action and `/api/workspace/photos`;
   demo writes to `localStorage` and keeps photos in IndexedDB with the existing `src/lib/local-photos.ts`.
2. **Demo data in code**: `src/lib/demo-workspace.ts` builds the two places as `PlaceDraft`s per language from the
   texts already in `src/lib/demo.ts` (EN/RO/DE). Sample photos are the existing illustrations; `photoSrc` returns
   their public path, or a `blob:` address for a photo the visitor added.
3. **Storage shape**: one key per demo place, `neruma:demo:v1:<placeId>`, holding the shared fields once and the texts
   per language, merged on load the same way `loadPlace` merges database rows. A version number in the key lets a
   later change of shape start fresh instead of breaking.
4. **Shared pieces extracted, then reused**: the location cards (from `workspace/page.tsx`) into a component that
   takes the place list and the base address; the draft preview (from `workspace/[id]/preview/page.tsx`) into a
   component that takes a draft and `photoSrc`. The demo pages are client pages that read the store; the real pages
   stay server pages.
5. **Shell**: `OrgSidebar` gets an optional exit link instead of *Sign out* ("Leave demo" → *For organisations*).
6. **Removed when the demo works**: the old `/dashboard` page, `demo-builder.tsx`, the draft parts of `demo.ts`
   (`parseDraft`, `draftKey`) and `guide-viewer.tsx` if nothing else uses it; tests move to `/demo`.
7. **Tests**: unit tests for the demo store (save, reset, shared-versus-per-language fields, a corrupt or old stored
   value falling back to the sample); a browser spec for every "Done when" line, including "no request to
   `/api/workspace`" (Playwright request listener) and "a second browser context sees the original".

## Result
Filled in at the end: the pull request, what changed, what was run, what was not run.
