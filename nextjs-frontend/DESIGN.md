---
name: MMA-TMS
description: Fight camp, training and medical clearance for an MMA academy — coaches, fighters, doctors and admins on one record.
colors:
  arena-mat: "#eef1f5"
  surface: "#ffffff"
  surface-muted: "#f2f4f8"
  surface-hover: "#e6ebf1"
  border: "#d8dee7"
  border-strong: "#bfc8d5"
  control-border: "#7a8699"
  navy-ink: "#0e1a2b"
  ink-muted: "#4a5668"
  ink-subtle: "#5b6778"
  blue-corner: "#1846c4"
  blue-corner-hover: "#133a9e"
  blue-corner-soft: "#e6ecfb"
  blue-corner-soft-ink: "#173b9e"
  focus-ring: "#3b6be0"
  red-corner: "#c92637"
  belt-gold: "#e3a82b"
  stage-navy: "#0e1a2b"
  stage-surface: "#16243a"
  stage-accent: "#4d94ec"
  figure-body: "#1c2b45"
  figure-rim: "#4d94ec"
  success-soft: "#e6f5eb"
  success-ink: "#176b34"
  success-solid: "#1a7a3d"
  warning-soft: "#fcf2da"
  warning-ink: "#855600"
  warning-solid: "#c98200"
  danger-soft: "#fce9ea"
  danger-ink: "#b0222c"
  danger-solid: "#cf2f3d"
  info-soft: "#e2f3f7"
  info-ink: "#0b6376"
  ai-soft: "#efebfd"
  ai-ink: "#5639c0"
  night-bg: "#0d1626"
  night-surface: "#142036"
  night-ink: "#e9eef6"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "0.01em"
  eyebrow:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0.12em"
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  numeric:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "tnum"
rounded:
  badge: "6px"
  control: "8px"
  card: "12px"
  pill: "9999px"
spacing:
  hairline: "4px"
  tight: "8px"
  cozy: "12px"
  base: "16px"
  card-inset: "20px"
  section: "24px"
  page-top: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue-corner}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.blue-corner-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "36px"
  button-lg:
    height: "44px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  badge:
    rounded: "{rounded.badge}"
    height: "24px"
    padding: "0 8px"
    typography: "{typography.label}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-ink}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-ink}"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-ink}"
  nav-rail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    width: "256px"
  nav-item-active:
    backgroundColor: "{colors.arena-mat}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
---

# Design System: MMA-TMS

## Overview

**Creative North Star: "Fight Night"**

The app is the academy's fight-night table: a cool arena-mat grey under navy ink by day, and "Arena night" — deep navy, never near-black — after dark. Blue and red are the two corners of the cage. Blue is the corner that acts (every primary button, link and focus ring). Red is the corner that announces (the active-nav slash, the fight countdown, the tab underline) and is never used to mean "error". Gold is the belt, kept for wins and milestones.

Most screens are Operate surfaces: a coach checks clearance and schedules a session, a doctor clears a fighter, a fighter logs a weight on a phone between rounds of training. Density is medium-high and calm; hierarchy comes from the condensed display face (Barlow Condensed), not from colour. Expression is saved for the moments that answer "why not a spreadsheet": the fighter drawn as a 3D body, the round replay, the camp timeline. Those live on a dark, fixed "stage" palette that does not follow the theme.

Components feel firm and compact: 8 px controls, 12 px cards, a near-invisible card shadow, a 3 % give under the finger on press. Nothing glows, nothing floats, nothing is decorated that is not data.

**Key Characteristics:**
- Semantic tokens only; every colour resolves through `globals.css` so light, dark and system themes stay in step.
- Condensed display type for titles, eyebrows and numbers; Be Vietnam Pro for reading (full Vietnamese diacritics).
- Status is always tone + icon + word, never colour alone.
- 3D and motion only where they show recorded data, with a 2D or static fallback that states the same facts.
- A `lite` graphics tier for weak machines that keeps all content and drops only cost.

## Colors

A cool, low-chroma neutral field with two saturated corner colours and a full set of soft/ink/solid status tones.

### Primary
- **Blue Corner** (`--primary`): the one action colour. Primary buttons, links, selected segments, the current-phase highlight, focus rings (`--ring`). Hover deepens to Blue Corner Hover. Its soft pair (`--primary-soft` / `--primary-soft-fg`) marks selection and "you are here" panels.

### Secondary
- **Red Corner** (`--corner-red`, `--rail-accent`): brand moments only — the skewed slash on the active nav item, the fight countdown, the tab underline, the octagon mark. It is not an error colour; errors use the danger tone.
- **Belt Gold** (`--belt-gold`, `--belt-gold-fg` for text): wins, records and milestones.

### Tertiary
- **The Stage** (`--nav-bg`, `--nav-surface`, `--nav-border`, `--nav-accent`): a fixed deep-navy ground that stays dark in every theme — landing page, video player, sign-in aside, avatars, theme previews.
- **Figure** (`--figure-body`, `--figure-rim`): body and rim light for 3D figures drawn straight onto the page through a transparent canvas; redefined per theme.

### Neutral
- **Arena Mat** (`--bg`): the page plane.
- **Surface** (`--surface`) / **Surface Muted** / **Surface Hover**: cards, inset wells, hover rows.
- **Border** / **Border Strong**: card edges and dividers. **Control Border** (`--control-border`) is darker so form edges reach 3:1 against every plane.
- **Navy Ink** (`--fg`), **Ink Muted** (`--fg-muted`), **Ink Subtle** (`--fg-subtle`): primary text, secondary text, captions and placeholders.

### Status tones
Each tone has four tokens — `soft` (background), `fg` (text on soft), `solid` (fills, dots, chart marks), `border` — for **success**, **warning**, **danger**, **info**, **ai** (anything a model produced) and **neutral**. Health, clearance and injury badges map onto them through `HEALTH_STATUS_META` / `INJURY_STATUS_META`; WebGL reads `<tone>-solid` through the same map.

### Data visualisation
`--chart-1` … `--chart-8` in their validated categorical order, plus `--chart-grid`, `--chart-axis`, `--chart-surface`. Series take colours in order; never pick by hue.

### Named Rules
**The Two Corners Rule.** Blue acts, red announces. If a red element can be clicked to do something, it is the danger tone, not Red Corner.

**The No-Hex Rule.** Components never contain a hex value. CSS uses the Tailwind token classes; WebGL reads the same tokens with `useThemeTokens([...])` and `THREE.Color.setStyle(token)`.

**The Arena Night Rule.** The dark theme is navy (`#0d1626` plane), never black. The dark block is written twice in `globals.css` (explicit dark and system-dark) and the two must stay identical.

## Typography

**Display Font:** Barlow Condensed 600/700/800 (fallback Arial Narrow, Roboto Condensed)
**Body Font:** Be Vietnam Pro 400–700 (fallback system UI)
**Mono:** Geist Mono (IDs, codes, timestamps in tables)

**Character:** A fight-poster condensed face for everything you scan — titles, eyebrows, record numbers, measures — over a humanist sans built for Vietnamese diacritics for everything you read.

### Hierarchy
- **Display** (800 italic, 32 px → 38 px from `sm`, line-height 1.02): the page `h1` in `PageHeader`. One per page.
- **Title** (700, 19 px / 24 px, +0.01em): card titles (`CardHeader`), section heads.
- **Eyebrow** (700, 13 px, +0.12em, uppercase, Ink Subtle): the label above a page title, nav section labels (12 px).
- **Body** (400, 15 px): page descriptions and reading text; cap prose at `max-w-3xl`.
- **Body small** (400, 14 px): card descriptions, table cells, form text.
- **Label** (500, 11–12 px): badges, field hints, axis labels.
- **Numeric** (Barlow Condensed 700, `tabular-nums`): measures, scores, records, countdowns; the unit sits beside it at 11 px in Ink Muted.

### Named Rules
**The Poster-for-Scanning Rule.** Barlow Condensed is for things the eye jumps to (titles, numbers, labels). Paragraphs and form input are always Be Vietnam Pro.

**The Diacritics Rule.** Every string must render in Vietnamese. Don't introduce a font without Vietnamese coverage; check uppercase eyebrows with stacked marks ("HỒ SƠ VÕ SĨ").

## Layout

- **Shell:** a 256 px navigation rail on `lg` and up; below that a 56 px sticky top bar (surface at 90 % with blur) plus a bottom tab bar on phones. Content sits in `main`: max 1440 px, 16 px gutters on phones, 24 px from `sm`, 32 px from `lg`, 24/32 px top padding and extra bottom padding so the phone tab bar never covers content.
- **Page rhythm:** `PageHeader` (back link, eyebrow, display title, description, actions aligned to the bottom-right from `md`), then cards in a single column on phones and a 2:1 or 1:1 grid on desktop, 24 px apart. Card insets are 20 px.
- **Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Every screen is checked at 390 px and 1440 px with no horizontal scroll.
- **Phones first for fighters:** the fighter area is used on a phone. Targets are at least 44 px (`size="lg"` buttons, `min-h-11`), primary actions go full width below `sm`.
- **Read before act:** on phones, the facts that drive a decision (name, status, next bout, primary action) come before decorative or 3D content.

## Elevation & Depth

Flat by default with tonal layering: the arena-mat plane, white surfaces, muted wells. Shadows are faint and structural, never decorative.

### Shadow Vocabulary
- **Card** (`--shadow-sm`: `0 1px 2px rgba(14,26,43,0.06)`): cards, buttons, inputs at rest.
- **Popover** (`--shadow-md`): menus, popovers, tooltips.
- **Dialog** (`--shadow-lg`: `0 24px 48px -12px rgba(14,26,43,0.3)`): modal dialogs and drawers, over the `--overlay` scrim with a 2 px blur.

### Named Rules
**The Faint Shadow Rule.** If a shadow is noticeable at a glance on a card, it is too strong. Depth between cards comes from the plane colour, not from lift.

**The Lite Rule.** Under `<html data-graphics="lite">` every `backdrop-filter` is off and blurred surfaces turn near-opaque. Any new blur must survive being removed.

## Shapes

Gently rounded and rectangular. Badges 6 px, buttons and inputs 8 px, cards and panels 12 px, pills and dots fully round. Borders are 1 px; tonal badges use a 1 px inset ring in the tone's border colour. The octagon is the brand silhouette: it appears in the logo mark, avatars (`shape="octagon"`) and the floor ring under 3D figures, nowhere else. The red active-nav marker is a 4 px bar skewed −14°.

## Components

### Buttons
Firm and compact; they give a little under the finger.
- **Shape:** 8 px radius. Heights 32 / 36 / 44 px (`sm` / `md` / `lg`); icon buttons are square.
- **Primary:** Blue Corner fill, white text, card shadow; hover deepens.
- **Secondary:** white surface, 1 px border, ink text; hover to Surface Hover.
- **Ghost:** no fill, Ink Muted text; hover fills Surface Hover.
- **Danger / Danger soft:** danger solid fill, or danger soft with its ring, for destructive actions only.
- **States:** `active:scale-[0.97]` over 150 ms ease-out (off under reduced motion); 2 px Blue focus outline offset 2 px; disabled at 50 % opacity. `ButtonLink` has the same classes for navigation.

### Badges
- **Style:** 24 px high (20 px small), 6 px radius, soft tone background, tone ink text, inset tone ring, icon or dot first.
- **Use:** health, clearance, injury, bout phase, weight status. Always icon + word.

### Cards / Containers
- **Corner Style:** 12 px.
- **Background:** Surface, 1 px Border, card shadow.
- **Header:** title in the Title style with an optional 18 px icon in Blue Corner Soft Ink, description in body-small muted, actions on the right.
- **Internal Padding:** 20 px sides, 16 px top, 20 px bottom.
- **Highlight:** a "current" item inside a card (the active meal-plan phase, the selected option) gets Blue Corner Soft at 60 % with a 1 px Blue ring at 40 % and a small solid Blue label.

### Inputs / Fields
- **Style:** 36 px high, 8 px radius, Control Border, Surface fill, card shadow; placeholders in Ink Subtle.
- **Focus:** border turns Focus Ring with a 2 px outline at 40 %.
- **Error:** message under the field in danger ink, wired with `aria-describedby`; the form's summary message sits above the fields.
- **Field:** label 14 px medium, required `*` in danger ink, hint under the control.

### Navigation
- **Rail:** white in light, deep navy in dark. Items are 18 px icon + label; active item gets Arena Mat background, strong ink and the red skewed bar on the left. Section labels are 12 px eyebrows.
- **Phones:** a bottom tab bar with the same items and badges; a drawer from the top-bar menu holds the rest.
- **Tabs (`TabNav`):** underline tabs that scroll sideways on phones; the active underline is Red Corner.

### Empty and error states
Centred icon, one-line title, one sentence that says what to do next, and an action when there is one (`EmptyState`, `ErrorState`). Never a blank card.

### 3D figure and body map (signature)
- **One stage per page** (`BodyStage`, R3F `Canvas`, transparent background, `frameloop="demand"`). Lists never get a canvas per item: `portraitStudio()` renders every card portrait with one shared WebGL renderer into plain 2D canvases.
- **Colour:** body and rim from `--figure-*`, region highlights from tone solids, floor ring as an octagon.
- **Fallback:** no WebGL or printing → the 2D `BodyMap`; every fact is also in text or `aria-label`.
- **Lite tier:** pixel ratio 1, no bloom, no MSAA (cutouts use `alphaTest`), no reflections.
- **Credit:** the scanned model's author and licence show under every stage (`ModelCredit`).

### Round replay (signature)
A GSAP timeline over what was recorded per round (self score, tactic marks, knockdowns, stunned/bleeding/fatigued, corner advice). It never animates positions or strikes, because those are not recorded.

## Do's and Don'ts

### Do:
- **Do** use the semantic token classes (`bg-surface`, `text-fg-muted`, `bg-primary`, `text-success-fg`…) and the `dark:` / `lite:` variants; nothing else.
- **Do** pair every status colour with an icon and a word, and give charts a data table (`ChartFigure`) and a legend.
- **Do** animate only for feedback, state change or one focal moment per screen: ease-out (`cubic-bezier(0.23,1,0.32,1)`), 150–250 ms for UI, entrances from `translateY(8px) scale(0.98)`, exits instant. Under `prefers-reduced-motion` keep only opacity.
- **Do** put every user-facing string in the dictionaries (`screens*.ts`, `*.en.ts` / `*.vi.ts`) and pass `locale` to shared components; Vietnamese mode shows Vietnamese, with the sport's English term in brackets only on first mention in a profile ("Hạng gà (Bantamweight)").
- **Do** check every new screen at 390 px and 1440 px, light and dark, `full` and `lite`.
- **Do** say what a 3D or animated surface drops on `lite`, and keep its 2D fallback.

### Don't:
- **Don't** write hex, `rgb()` or Tailwind palette colours (`bg-blue-600`) in components.
- **Don't** use Red Corner for errors or for primary actions.
- **Don't** animate from `scale(0)`, use `ease-in` for UI, or animate keyboard-driven actions.
- **Don't** put more than one WebGL `Canvas` on a page, or one per list item.
- **Don't** animate data the app does not record (fighter positions, strike locations), and don't let a figure push the name, status or primary action below the first phone screen.
- **Don't** use black backgrounds in the dark theme, or `backdrop-filter` that the page needs to stay readable.
- **Don't** hard-code English (or Vietnamese) in components, and don't compare user-visible labels in code: compare codes and enums.
