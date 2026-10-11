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

- [ ] Visitor navigation: *How it works · Explore places · Example guide*, plus one *For organisations*
  link on the right.
- [ ] Keep *Methodology* for visitors too, but link it from *How it works* ("How we decide →") instead of
  the main navigation, and rewrite the top in plain language. It is written for experts (dB(A), lux,
  PAS 6463, "platform plan v0.1", "Working status"); keep that detail further down. See `DECISIONS.md`.
- [ ] Footer: move *Request organisation access*, *Organisation sign in* and *Demo workspace* into the
  organisations area. Keep a single *For organisations* link.
- [ ] Home: remove the hero's *For your organisation* button and move the organisations banner to the
  organisations page.
- [ ] Remove the internal "NERUMA · WORKING METHODOLOGY · V0.1" heading from *How it works* and
  *For organisations*.
- [ ] Replace the scattered development notices with one thin site-wide "Preview" strip:
  "Registration is not active yet…", "Live publishing will be available after… the separate database
  are configured", "share it with the project owner through your existing contact".

## 2. Page structure and jump links

- [ ] Visitors: merge Home, *How it works* and a short "Where the information comes from" section into
  one page. The navigation buttons jump to its sections.
- [ ] Keep *Explore* and the guide as separate pages.
- [ ] Organisations: one page with jump links: Why → What you describe → Responsibilities →
  Methodology → Request access.

## 3. Guide examples

- [ ] `/example-guide` and `/places/willow-museum/guide` render the same page. The home button and the
  Explore card link to different URLs. Keep one.
- [ ] On phones the guide sits inside a phone frame with a fixed height and its own scrolling. The
  Sound/Light rows end up behind the step buttons. On phones, drop the frame and show the guide at
  full width.
- [ ] Three labels stack before the guide starts: "Museum pre-visit guide", "Demonstration · fictional
  information" and "What a visitor sees". Keep one.
- [ ] "Sound: Variable" shows three empty squares, which reads as quiet. Give *variable* its own symbol.
- [ ] The home preview card shows levels as chips; the guide shows them as squares. Use one style.

## 4. Wording and space on phones

- [ ] Responsibility text ("Your information can change someone's experience" + the full
  responsibility paragraph, ~650px) appears on *For organisations*, *Register* and *Builder*. Show it
  once, as the consent step in Register, and link to it elsewhere.
- [ ] Register (3784px, 427 words): four info blocks before the form, which starts ~2 screens down.
  Put the form first.
- [ ] Builder (10282px, ~12 screens): all five steps are open at once. Make each step an accordion.
- [ ] Home (4709px): the six feature cards take one row each. Use two columns or a compact list.
- [ ] Explore: three filters, each offering only "All", for one result. Hide them until there are more
  places.
- [ ] Dashboard: seven tabs wrap into three rows. Use one scrollable row. The three stat cards stack to
  ~330px; put them in one row.
- [ ] Top bar on content pages wraps to two rows (92px) because of *Summary / Full page*. Fit it on
  one row, or move that control into the page.
- [ ] Login: the resend-confirmation section is as prominent as sign-in and repeats its heading
  (h2 + legend). Collapse it behind "Didn't get the email?".
- [ ] Trim copy, e.g. "A NERUMA guide describes a place before you visit it. You read it on your phone
  or computer. You do not need an account." → "Read about a place before you go — on any device, no
  account needed."

## 5. Banners and boxes

- [ ] Blue notice boxes are overused: two stacked on Register, two on Dashboard, one each on Contact
  and Login. Information and warnings look the same. Use separate styles.
- [ ] *How it works* and *Methodology* end in a bordered box containing a single link
  ("Example guide →"). Make it a button.
- [ ] Move the home organisations banner (see section 1). Its button text wraps to two lines on
  phones; shorten it.

## 6. Settings

Today settings live in two places, and the theme appears in both:

| Setting | Top bar | Reading panel (floating tab) |
|---|---|---|
| Language | ✓ | |
| Summary / Full page | ✓ (content pages only) | |
| Cool / Warm | ✓ | |
| Light / Dark | ✓ (icon + word) | ✓ (with High contrast) |
| Text size, line width, typeface, spacing | | ✓ |
| Read aloud, reset | | ✓ |

- [ ] **Light/dark as an icon-only button.** Show a moon or sun icon, keep the action as the
  accessible name ("Switch to dark mode"), plus a tooltip. Same height as the language button.
  This also lets the top bar fit on one row on phones (section 4).
- [ ] **Follow the device by default.** When the visitor has not chosen, use the device's light/dark
  setting and follow it if it changes. Once they pick one, remember it. Add "Match device" to the
  theme list in the panel, and make *Reset* go back to it. The code change is in the technical tasks
  (`docs/planning/TECH-TASKS.md`, section 2).
- [ ] **Top bar keeps only language and light/dark.** Move *Cool / Warm* and *Summary / Full page*
  into the reading panel.
- [ ] **Rename "Cool / Warm".** It switches the accent between blue and green, which the names don't
  say. Try "Accent colour: Blue / Green".
- [ ] **Move the reading-settings trigger into the top bar** as a labelled button ("Aa Reading" or
  similar). The floating edge tab is easy to miss, has no visible label, and covers content on phones.
- [ ] **Slim the panel header.** Moving the panel uses a drag handle plus five nudge buttons. Check
  whether a fixed position (right side on desktop, bottom sheet on phones) removes the need to move it.

## 7. Alignment and control sizes (left from the first review)

- [ ] The dot before the hero tagline and the ✓ before "No account needed…" centre on the whole
  block. When the text wraps, they sit between the lines. Align them to the first line
  (`.eyebrow`, `.reassurance` in `globals.css`).
- [ ] Login: "Work email" and "Password" labels differ in size and colour, and their inputs are 3px
  out of line. `organisation-form.tsx` mixes `<label class="form-field">` with
  `<div class="form-field"><label>`. Use one pattern.
- [ ] Login: the notice, sign-in form and resend panel end at three different widths (984 / 982 /
  1196px).
- [ ] Home feature grid: six cards make a row of four and a row of two at desktop. Use 3 × 2.
- [ ] Two button systems: `.btn` (36px) and `.button` (48px), plus `.button-small` (32px), `.btn-lg`
  (48px) and a 40px phone override. Settle on three sizes in one system.
- [ ] Inputs (36–37px) sit next to 48px buttons. Match the heights.
- [ ] Top bar on phones: language 32px, Cool/Warm 34px, Light 40px. The Light button picks up the
  phone `.button` override. Make all three the same height.
- [ ] The reading-settings tab (36px wide) covers content on phones, where the side margin is 16px.
- [ ] Unused CSS: `.pilot` and `.principle` aren't referenced by any page. Delete them.
- [ ] Account and admin pages: `.verification-page` centres a 900px column, while other pages align
  left to the header. Check while signed in.
