# Design tasks

Findings from the design review of 2026-10-11, checked at 320, 360, 390, 430, 768 and 1280px.
Pixel heights are from a 390px-wide phone. Work top to bottom: sections 1 and 2 decide where
content lives, so do them before trimming copy. The reasons behind these choices are in
`DECISIONS.md`; where a task here disagrees with it, `DECISIONS.md` wins.

## Done

- [x] Banner, hero panel and footer divider ran past the content edge, and touched the screen edge
  on phones. `.container` now sets inline padding only, from one `--gutter` token shared with the
  header and top bar (PR #8).
- [x] The principles strip and the footer bottom lost their top padding on phones (same cause, PR #8).
- [x] Workspace CI suite repaired: stale `.header-login` selector, alert locator matching Next's route
  announcer, fixture auth errors in the wrong field (PR #8).

## 1. Separate what visitors see from what organisations see

Decision needed before starting.

- [x] Visitor navigation: now *How it works · Who it's for · Sources · Explore*, an outlined *Example guide*
  button and a filled *For organisations* button (PR #13; `DECISIONS.md`).
- [ ] (Link done, PR #13: "How we decide →" in *Sources*. Plain-language rewrite of the Methodology page still to do.)
  Keep *Methodology* for visitors too, but link it from *How it works* ("How we decide →") instead of
  the main navigation, and rewrite the top in plain language. It is written for experts (dB(A), lux,
  PAS 6463, "platform plan v0.1", "Working status"); keep that detail further down. See `DECISIONS.md`.
- [x] Footer (PR #13): move *Request organisation access*, *Organisation sign in* and *Demo workspace* into the
  organisations area. Keep a single *For organisations* link.
- [x] Home (PR #13): the hero's *For your organisation* button and the organisations banner are removed;
  the organisations page already says it.
- [x] (PR #13) Remove the internal "NERUMA · WORKING METHODOLOGY · V0.1" heading from *How it works* and
  *For organisations*.
- [ ] **PINNED** (owner: talk about it after the organisation side). Done so far: the "Registration is not active
  yet" line is gone from the Register and Login forms (PR #15). Replace the scattered development notices
  with one thin site-wide "Preview" strip:
  "Registration is not active yet…", "Live publishing will be available after… the separate database
  are configured", "share it with the project owner through your existing contact".

## 2. Page structure and jump links

- [x] Visitors (PR #13): merge Home, *How it works* and a short "Where the information comes from" section into
  one page. The navigation buttons jump to its sections.
- [x] Keep *Explore* and the guide as separate pages.
- [ ] Organisations: one page with jump links: Why → What you describe → Responsibilities →
  Methodology → Request access. (Started: *Request access* and *Sign in* now sit at the top, PR #14.)

## 3. Guide examples

- [x] One address: the example guide lives at `/places/willow-museum/guide`, the shape real places will have;
  `/example-guide` redirects to it.
- [x] On phones the guide drops the frame and scrolls with the page. The step buttons stay at the bottom and the
  guide's header with its options stays under the site header.
- [x] One label above the guide: *Museum pre-visit guide* (`DECISIONS.md`). The "fictional" wording stays in the intro.
- [x] *Variable* shows filled, empty, filled; *Not recorded* stays empty with a dashed outline.
- [x] The home preview uses the same squares as the guide (`level-squares.tsx`). Left: the builder's draft preview
  (`guide-viewer.tsx`) still uses its own dot style.

## 4. Wording and space on phones

- [x] Responsibility text ("Your information can change someone's experience" + the full
  responsibility paragraph, ~650px) appears on *For organisations*, *Register* and *Builder*. Show it
  once, as the consent step in Register, and link to it elsewhere. Done: it sits in the request form (Register and the
  account page) directly above the two statements; *For organisations* links to it; the publish step keeps its short version
  and the Terms page its own copy.
- [ ] Register (3784px, 427 words): four info blocks before the form, which starts ~2 screens down.
  Put the form first.
- [x] Builder (10282px, ~12 screens): all five steps are open at once. Make each step an accordion. Done: the first step is open, the others folded, with Expand all / Collapse all (checked 2026-10-26).
- [ ] Home (4709px): the six feature cards take one row each. Use two columns or a compact list.
- [ ] Dashboard: seven tabs wrap into three rows. Use one scrollable row. The three stat cards stack to
  ~330px; put them in one row.
- [x] Top bar on content pages wraps to two rows (92px) because of *Summary / Full page*: that control moved into
  the reading panel; the top bar fits one row down to 320px.
- [x] Login: the resend-confirmation section is as prominent as sign-in and repeats its heading
  (h2 + legend). Collapse it behind "Didn't get the email?".
- [ ] Trim copy, e.g. "A NERUMA guide describes a place before you visit it. You read it on your phone
  or computer. You do not need an account." → "Read about a place before you go — on any device, no
  account needed."

## 5. Banners and boxes

- [x] Notice kinds now differ by shape and icon, without new colours: `.notice` (filled box), `.notice-warning` (⚠, heavier border,
  bold) for "not available / action needed", `.note` (quiet rule, no fill) for empty states. On Register the second box is plain text.
  Still open: the Dashboard and Contact boxes were not changed; look at them on a phone and decide whether they still earn a box.
- [ ] *How it works* and *Methodology* end in a bordered box containing a single link
  ("Example guide →"). Make it a button.
- [x] Move the home organisations banner (see section 1; removed in PR #13). Its button text wraps to two lines on
  phones; shorten it.

## 6. Settings

Done on 2026-10-12: the top bar keeps three controls and everything else lives in the reading panel.

| Setting | Top bar | Reading panel |
|---|---|---|
| Language | ✓ | |
| Light / Dark | ✓ (icon only) | ✓ (with Match my device and High contrast) |
| Reading settings button | ✓ (labelled) | |
| Accent colour (Blue / Green) | | ✓ (not in High contrast) |
| How much of the page (Full / Summary) | | ✓ (text pages only) |
| Text size, line width, typeface, spacing | | ✓ |
| Read aloud, reset | | ✓ |

- [x] **Light/dark as an icon-only button.** Show a moon or sun icon, keep the action as the
  accessible name ("Switch to dark mode"), plus a tooltip. Same height as the language button.
  This also lets the top bar fit on one row on phones (section 4).
- [x] **Follow the device by default** (PR #33; *Reset* going back to it still to check). When the visitor has not chosen, use the device's light/dark
  setting and follow it if it changes. Once they pick one, remember it. Add "Match device" to the
  theme list in the panel, and make *Reset* go back to it. The code change is in the technical tasks
  (`docs/planning/TECH-TASKS.md`, section 2).
- [x] **Top bar keeps language, light/dark and the reading button.** *Cool / Warm* and *Summary / Full page*
  moved into the reading panel (and left the organisation sidebar).
- [x] **Rename "Cool / Warm"** to *Accent colour: Blue / Green* (stored values stay `cool` and `warm`).
- [x] The reading-settings trigger is a labelled button in the organisation sidebar and in the top bar of the public
  site. The floating edge tab is gone. Trade-off: the top bar scrolls away on long pages, so the button does too.
  Decided 2026-10-13: it stays there; settings are set once and not needed on screen all the time.
- [ ] **Slim the panel header.** Moving the panel uses a drag handle plus five nudge buttons. Check
  whether a fixed position (right side on desktop, bottom sheet on phones) removes the need to move it.

## 7. Alignment and control sizes (left from the first review)

- [x] The dot before the hero tagline and the ✓ before "No account needed…" centre on the whole
  block. When the text wraps, they sit between the lines. Align them to the first line
  (`.eyebrow`, `.reassurance` in `globals.css`).
- [x] Login: "Work email" and "Password" labels differ in size and colour, and their inputs are 3px
  out of line. `organisation-form.tsx` mixes `<label class="form-field">` with
  `<div class="form-field"><label>`. Use one pattern. Done: both labels are 13px, the same colour, and label and input tops match (449.2 / 477.4px at 1280, checked 2026-10-26).
- [ ] Login: the notice, sign-in form and resend panel end at three different widths (984 / 982 /
  1196px). Measured 2026-10-26: equal at 320 and 390px; at 1280px the form ends at 984px (it is capped at 900px) while the resend panel and the button row end at 1196px.
- [ ] Home feature grid: six cards make a row of four and a row of two at desktop. Use 3 × 2.
- [x] Two button systems (PR #94, `docs/briefs/2026-10-26-button-sizes.md`): `.btn` (36px) and `.button` (48px), plus `.button-small` (32px), `.btn-lg`
  (48px) and a 40px phone override. Settle on three sizes in one system. Done as two sizes: normal 44/40px and small 36/32px (phone/desktop).
- [x] Inputs (36–37px) sit next to 48px buttons. Match the heights. Done (PR #73): fields are 48px, 40px on phones like the buttons.
- [x] (PR #16) Top bar on phones: language 32px, Cool/Warm 34px, Light 40px. The Light button picks up the
  phone `.button` override. Make all three the same height.
- [x] The reading-settings tab (36px wide) covers content on phones: the tab is gone.
- [x] Unused CSS: `.pilot` and `.principle` aren't referenced by any page. Deleted.
- [ ] Account and admin pages: `.verification-page` centres a 900px column, while other pages align
  left to the header. Check while signed in.

## 8. The first visit of a new organisation (owner's test run, 2026-10-17)

Found when the owner signed in as a brand-new organisation account on production. Brief to write before building.

- [x] **No path.** The account page shows blocks of text. Show three steps ("1. Email confirmed ✓ · 2. Send your request · 3. Wait for approval") with the form directly under them. Done (PR #77).
- [x] **Too early.** "Delete my account" and "Open demo workspace" appear before the person has sent a request. Show deletion only when there is something to delete, at the bottom; drop the demo link here. Done (PR #77).
- [x] **A disabled button with no reason.** *Submit for manual review* stays disabled until a mandate document is uploaded and says nothing. Say why under it ("Upload your mandate document to continue") and keep that line available to screen readers. Done (PR #77).
- [x] **The wrong words on a load error.** The workspace error page says "Your draft was not saved" for any failure, including a dashboard that couldn't load. Say what failed. Done (PR #77).
