---
name: MMA Vision
description: Fight-camp app for one bout, shared by coach and fighter (MMA-TMS)
colors:
  lotus: "#C23A22"
  lotus-on-dark: "#FF8066"
  cta: "#C23A22"
  on-cta: "#FFFFFF"
  bg: "#F6F6F8"
  bg-dark: "#0A0A0C"
  surface: "#FFFFFF"
  surface-dark: "#16161A"
  surface-muted: "#ECECEF"
  surface-muted-dark: "#1E1E24"
  ink: "#18181B"
  ink-dark: "#F4F4F5"
  ink-muted: "#616169"
  ink-muted-dark: "#A1A1AA"
  ink-subtle: "#5F6B75"
  ink-subtle-dark: "#8A8A94"
  line: "#E4E6E9"
  line-dark: "#303038"
  control-border: "#8A8A93"
  control-border-dark: "#6A6A74"
  danger: "#B4123F"
  danger-dark: "#FF6B81"
  danger-soft: "#FFEDF1"
  danger-soft-dark: "#331A21"
  warning: "#7A4F00"
  warning-dark: "#FFB020"
  success: "#21664B"
  success-dark: "#6BC48F"
  disabled-fill: "#ECECEF"
  disabled-fill-dark: "#24242C"
  disabled-ink: "#8A8A93"
  disabled-ink-dark: "#6E6E78"
typography:
  display:
    fontFamily: "BarlowCondensed_700Bold"
    fontSize: "39px"
    letterSpacing: "0em"
  display-small:
    fontFamily: "BarlowCondensed_700Bold"
    fontSize: "26px"
  weight-numeral:
    fontFamily: "BarlowCondensed_700Bold"
    fontSize: "78px"
    lineHeight: "98px"
  title:
    fontFamily: "BarlowCondensed_600SemiBold"
    fontSize: "22px"
    letterSpacing: "0.4px"
    lineHeight: 1.35
  body-large:
    fontFamily: "IBMPlexSans_400Regular"
    fontSize: "18px"
    lineHeight: 1.35
  body:
    fontFamily: "IBMPlexSans_400Regular"
    fontSize: "14px"
    lineHeight: 1.35
  action:
    fontFamily: "IBMPlexSans_700Bold"
    fontSize: "15px"
    lineHeight: 1.35
  label:
    fontFamily: "IBMPlexSans_500Medium"
    fontSize: "14px"
    lineHeight: 1.35
  caption:
    fontFamily: "IBMPlexSans_400Regular"
    fontSize: "12px"
    lineHeight: 1.35
rounded:
  field: "12px"
  panel: "16px"
  pill: "9999px"
  cut-corner: "17px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  camp-gutter: "22px"
  camp-section-gap: "22px"
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
    typography: "{typography.action}"
    height: "54px"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    height: "54px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-cta}"
    height: "54px"
  button-disabled:
    backgroundColor: "{colors.disabled-fill}"
    textColor: "{colors.disabled-ink}"
    height: "54px"
  arena-frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.cut-corner}"
    padding: "16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "13px"
    height: "44px"
  weight-slip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.weight-numeral}"
    padding: "20px"
  choice:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    height: "50px"
  choice-selected:
    textColor: "{colors.lotus}"
    height: "50px"
---

# Design System: MMA Vision

## Overview

**Creative North Star: "Góc đài — The Corner Slip"**

Bề mặt phẳng, kỷ luật như một công cụ huấn luyện chuyên nghiệp; khung vẽ bằng nét sắc cắt góc chứ không đóng hộp; chỉ một màu Đỏ võ đài, dùng dứt khoát cho đúng điểm cần hành động hoặc rủi ro; các con số quyết định trận in thật to, đậm và có tương phản cao.

Mood: **dứt khoát, kỷ luật, tin cậy.** Density is medium and single-column: one portrait phone column, capped at 480px, 22px gutters and 22px between groups. Status is written as words in context, never as pill badges or color alone. Each screen carries exactly one vector title. Light and dark are first-class schemes; "Đỏ võ đài" is the default palette, and the user's Appearance settings may override color, face, size and spacing on top.

Confirmed visual rejections (from `design/fight-camp/DESIGN-NOTES.md`): repeated black title cards, shape badges/pills for business status, a duplicated header title, hero tiles, screenshots in place of UI.

**Key Characteristics:**
- One accent ("Đỏ võ đài" #C23A22 light / #FF8066 dark), used for CTA, focus, selection and corner seams.
- Cut-corner SVG chrome (ArenaFrame / ArenaSurface) instead of rounded cards.
- Barlow Condensed for titles and weight numerals; IBM Plex Sans for all data and forms.
- Text status, with glyph + word (`!`, `✓`, `↗`) — never color alone.
- Motion is short, eased-out, and fully disabled under Reduce Motion.

## Colors

A near-monochrome zinc palette with a single ring-red accent and muted semantic colors that always travel with words.

### Primary
- **Đỏ võ đài / Ring Red**: the CTA fill (same red in both schemes, white text), focus ring, selected choice underline, chart points, title slash, and the corner seams on every frame. On dark, accent *ink* lifts to the lighter coral so it stays readable; the CTA fill does not change.

### Neutral
- **Ink** / **Ink dark**: primary text.
- **Ink muted**, **Ink subtle**: secondary copy, helper text, placeholders, chart axis labels.
- **Ground (bg)** and **Surface**: screen ground is a cool off-white (light) or near-black (dark); frames fill with surface. An OLED preset swaps ground to #000000 and surface to #101013.
- **Line**: hairline dividers under facts and the header bottom border; **Control border**: neutral frame strokes and secondary-button outline.

### Semantic (status, always with text)
- **Danger** (+ soft fill): error frames, danger notices (`accessibilityRole="alert"`), destructive action, weight-limit dashed line, danger plan toggles.
- **Success**: made-weight / saved notices (polite live region).
- **Warning** (+ soft): "chưa vượt hạn mức" warnings; token comment requires icon + text.
- **Info** (+ soft): "Phục hồi" blue, optional in the palette.

### Named Rules
**The One Red Rule.** Ring Red is the only accent. It marks action, focus, selection and frame seams; it is never used for decoration or for status (status uses danger/success/warning).
**The Words-First Status Rule.** No status is communicated by color alone; every tone carries a glyph and a Vietnamese word.

## Typography

**Display Font:** Barlow Condensed (700 Bold; 600 SemiBold for titles; 800/900 for the wordmark)
**Body Font:** IBM Plex Sans (400/500/600/700)

**Character:** Chữ hiển thị hẹp kiểu poster thi đấu (Barlow Condensed) + chữ nội dung kỹ thuật, điềm đạm (IBM Plex Sans).

### Hierarchy
- **Display** (Barlow 700, 39px, uppercase, SVG-rendered, wraps at ~23 chars): the single screen title in `SvgTitle`, preceded by a slanted red slash.
- **Display small** (Barlow 700, 26px): compact titles inside sub-screens.
- **Weight numeral** (Barlow 700, 78px / 98px, centered): the kg entry on the weight slip.
- **Title** (Barlow 600, 22px, +0.4 tracking, uppercase): shared app title role.
- **Body large / Body** (Plex 400, 18 / 14px): `Copy`; `strong` switches to bold.
- **Action** (Plex 700, 15px): button labels.
- **Label** (Plex 500, 14px): choice labels; content-role label is 13px.
- **Caption** (Plex 400, 12px); chart axis text 10px (SVG).

### Named Rules
**The Diacritic Leading Rule.** Line height is never below 1.35× font size (`viLineHeight`) — Vietnamese marks need the room.
**The Live Type Rule.** Body text reads size, face, weight and tracking from the user's Appearance settings at render time (`readableTextStyle`); don't snapshot type in module-level styles.

## Layout

Single portrait column, `maxWidth: 480` centered; fight-camp gutters 22px, header 18px. Groups stack with a 22px gap; title block gap 6px; field label gap 7px. Header row is 54px tall: back chevron (48×48 target), "Fight Camp" label, and "Dữ liệu mẫu" marker when on preview data. Content sits inside top safe-area inset; bottom padding is max(inset, 24) + 24. Keyboard: `KeyboardAvoidingView` with `padding` on iOS only; taps persist. Facts are label-left / value-right rows (value max 62% width) with hairline dividers. Global scale: 4 / 8 / 12 / 16 / 24 / 32, screen gutter 24 outside fight-camp.

## Elevation & Depth

**Current build: flat (Drawn-Not-Lifted).** Fight Camp today has no shadows. Depth comes only from the stroke and the cut-corner silhouette; the active state adds a soft 5px gradient halo of the accent behind the frame stroke. App-wide shadow tokens exist (panel, panel-dark, CTA) but fight-camp screens do not use them.

**Confirmed direction (not built yet): "Layered Corner Slips + one Spotlight".** Cut-corner frames read as stacked paper slips, offset by a few px, using a double outline and red corner marks, with no blur shadows. Sheets and popups are the top slip with the heaviest outline. Each screen may carry exactly one subtle top-down spotlight cone, on its single bout-deciding frame (e.g. today's weight, a suspension warning). Light mode needs its own variant of the spotlight. Until implemented, new work stays flat and must not invent blur shadows.

### Named Rules
**The No-Blur Rule.** Depth is outline, offset and corner marks — never a blurred drop shadow.
**The One Spotlight Rule.** At most one spotlight per screen, only on the frame that decides the bout.

## Shapes

One silhouette: a rectangle with the top-right and bottom-left corners chamfered (cut = min(17, h/4, w/6) px), 1px stroke (1.5px active), plus 2px accent L-seams on the top-left and bottom-right corners (≤29px). Buttons use the same chamfer at fixed 13px. Radius tokens (field 12, panel 16, pill) belong to the older shared `components/ui` kit, not the fight-camp world.

## Components

Component feel: **cắt góc, sắc cạnh, tiết chế** — sharp in shape, restrained in quantity.

### Buttons (`Action`)
- **Shape:** chamfered SVG plate, min height 54px.
- **Primary:** Ring Red fill, white bold label. **Secondary:** surface fill with control-border stroke. **Danger:** danger fill.
- **States:** press scales to 0.97 (80ms in / 160ms out; off under Reduce Motion); disabled and pending use disabled fill/ink; pending shows a spinner and `busy` state. Optional +/− stroke icon.

### Choices (segmented, `Choices`)
- **Style:** text options over a 1px line; selected option gets a 3px Ring Red underline and red label. Min height 50px, wrap, radiogroup semantics.

### Plan toggle (`PlanToggle`)
- Full-row checkbox on an arena surface, ✓ / ＋ glyph, danger variant on danger-soft fill; disabled at 55% opacity.

### Cards / Containers (`Frame` → `ArenaFrame`)
- Chamfered surface, default padding 16 (Frame default 20), internal gap 12; tones neutral / accent / danger / success change the stroke and seam color.

### Inputs / Fields (`Field`)
- Native TextInput inside an ArenaFrame (pad 13, large 18); label above in bold. **Focus:** frame switches to accent tone. **Error:** danger tone + danger message below; helper text muted otherwise. Multiline min 75px.

### Notice
- Framed message with glyph + bold title (`!` danger, `✓` success, `↗` neutral accent); success fades in.

### Phiếu ghi cân (`WeightSlip`) — signature
- flat slip, label left / limit right, centered 78px numeral, "kg" suffix, decimal pad, max 5 chars, hint "30–200 kg · 1 số thập phân".

### Weight plot (`WeightPlot`)
- SVG line plot: Ring Red dots for logged weights, dashed control-border reference path, dashed danger limit line; accessible summary label; muted legend.

### Navigation (`CampShell`)
- In-screen header with back chevron, one SVG title in content, content cross-fades/rises on screen change. Internal sub-screen history inside one route (coach: detail → weigh → decision → catchweight → cancel …).

### Loading (`Busy`)
- Accent ActivityIndicator + "Đang tải dữ liệu…".

## Do's and Don'ts

### Do:
- **Do** use one SVG title per screen with the red slash.
- **Do** put status in Vietnamese words with a glyph, in context.
- **Do** keep Ring Red for action, focus, selection and seams only.
- **Do** keep line height ≥ 1.35× and read type from live Appearance settings.
- **Do** keep targets ≥ 48px (header back 48×48, actions 54, choices 50).
- **Do** respect Reduce Motion: fades instead of rises, no press scale.

### Don't:
- **Don't** use pill or shape badges for business status.
- **Don't** repeat the screen title in the header or use black title cards.
- **Don't** add blurred drop shadows; depth is outline, offset and corner marks.
- **Don't** use more than one spotlight per screen.
- **Don't** convey state by color alone.
