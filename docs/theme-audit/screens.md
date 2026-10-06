# Theme audit — Appearance screens, entry points, migration

Read-only gap audit, 2026-09-29. App: `reactnative-mobile/`. All paths below are relative to `reactnative-mobile/src/` unless stated. Nothing was built, run, or edited except this file.

Sources read: `docs/theme-customization-plan.md`, `docs/theme-progress.md`, `app/appearance.tsx`, `app/_layout.tsx`, `screens/appearance/{appearance-screen,appearance-preview,controls}.tsx`, `components/appearance/appearance-link.tsx`, `i18n/appearance.ts`, `theme/theme-preference.tsx`, `theme/appearance/{settings,tokens,color-math}.ts`, `theme/colors.ts` (+ `git show HEAD:` of it), `app/(fighter)/cai-dat.tsx`, `app/(admin)/quan-tri/cai-dat.tsx`, `screens/admin/admin-home.tsx`, `screens/coach/me.tsx`, `screens/doctor/me-screen.tsx`, `screens/fighter/me-screen.tsx`, `app/(guest)/_layout.tsx`, `screens/parity/blocked-workspace.tsx`, `components/ui/DesignPreview.tsx`.

## Summary

| Result | Count | Items |
| --- | --- | --- |
| PASS | 10 | 1, 2, 3, 4, 5, 7, 9, 13, 14, 16 |
| FAIL | 7 | 6, 8, 10, 11, 12, 15, 18 |
| UNVERIFIED | 1 | 17 |

- **Full Preview verdict: FAIL — it does not exist.** There is no separate Full Preview route or screen. The only preview is the compact pinned pane inside the editor (`AppearancePreview` inside `ThemeScope`). It has no "Back to edit", no preview-only light/dark toggle, and it uses hand-built mock elements rather than real app components.
- **Roles lacking an Appearance entry: Guest.** Fighter, Coach, Doctor and Admin all render the shared `AppearanceLink`. Guest screens and the auth screens only have the quick `ThemeToggle` cycler.
- **Top hardcoded files**: see item 18.

---

## Editor

### 1. Preset picker — PASS
- `screens/appearance/appearance-screen.tsx:318-340`: grid of `PRESET_IDS` chips, `accessibilityRole="radio"`, `onPress={() => pickPreset(id)}`.
- `appearance-screen.tsx:177-180` `pickPreset` pushes history and sets `draft = { presetId, settings: resolvePreset(presetId) }`.
- 12 presets are defined in `theme/appearance/settings.ts:84-139` (system, light, dark, trueBlack, paper, mint, highContrastLight/Dark, largeText, lowVision, compact, readable). The "Custom (based on X)" label is at `appearance-screen.tsx:243-245`.

### 2. Brightness, font family, font size, weight, line height, letter spacing — PASS
| Control | Location |
| --- | --- |
| Brightness (light/dark/system/trueBlack) + dark variant when system | `appearance-screen.tsx:341-358` |
| Font family (7, each row rendered in its own face) | `appearance-screen.tsx:361-400` |
| Font size (0.85–1.60, step 0.05) | `appearance-screen.tsx:402-410`; range `settings.ts:59-63` |
| Weight (regular/bold) | `appearance-screen.tsx:412-418` |
| Line height (1.35–1.80) | `appearance-screen.tsx:420-427` |
| Letter spacing (0–0.12 em) | `appearance-screen.tsx:428-435` |

The sliders are a self-written `PanResponder` `TrackSlider` with −/+ buttons and `adjustable` increment/decrement (`screens/appearance/controls.tsx:73-173`).

### 3. Text / background / surface / accent colors: swatches + hex + self-written picker — PASS
- A role selector for the four roles is at `appearance-screen.tsx:57-58, 438-444`.
- Swatches: `SwatchRow` at `appearance-screen.tsx:445-450`, component `controls.tsx:197-245` (includes a "Default" chip that sets `null`). The swatch data is `appearance-screen.tsx:60-65`.
- Hex field: `HexField` at `appearance-screen.tsx:451`, component `controls.tsx:248-303` (validates with `normalizeHex`, shows an error on invalid input).
- Self-written picker: `HsvPicker` at `appearance-screen.tsx:452-456`, component `controls.tsx:318-392` (three `TrackSlider`s for hue, saturation and value; doc comment at line 318 says "no color-picker dependency").
- No dependency: `reactnative-mobile/package.json` has no `color-picker`, `slider` or `segmented` package (grep returned 0 hits).

### 4. Corner radius, density — PASS (editor), with a caveat
- Radius control: `appearance-screen.tsx:460-466`. Density control: `appearance-screen.tsx:467-473`. Factors: `theme/appearance/tokens.ts:191-192`. The 44 pt minimum is kept at `tokens.ts:195, 224`.
- Caveat (not scored here): only the preview reads these values. `useLayoutTokens()` is consumed only by `theme/theme-preference.tsx` and `screens/appearance/appearance-preview.tsx` (grep). The plan says so at line 40. After Apply, real screens do **not** change radius or density.

### 5. Compact live mini-preview pinned at top — PASS
- `appearance-screen.tsx:297-309`: `previewFrame` sits outside the controls `ScrollView` (`311-475`), so it stays pinned. Height is `min(40% of window, 380)` (`appearance-screen.tsx:257`), and it scrolls internally (`nestedScrollEnabled`).
- Live: it renders from `draftColors`, `draftTypography` and `draftLayout`, which are memoized on `draft.settings` (`appearance-screen.tsx:129-144`).

### 6. Apply, Cancel, Reset to default, Reset this section with confirmation — FAIL
- Apply: PASS. `appearance-screen.tsx:500-510` (disabled when not dirty), handler `207-218`, which calls `applyAppearance` (`theme/theme-preference.tsx:249-255`, persisted at `224-229`).
- Cancel: PASS. `appearance-screen.tsx:493-499` calls `leave()` (`200-204`), which sets `allowLeaveRef` and navigates back. The draft is local state, so it is dropped.
- Reset to default: present but **with no confirmation**. The header "Mặc định" button (`appearance-screen.tsx:286-294`) calls `onReset` (`195-198`), which sets `draft = DEFAULT_APPEARANCE` directly. It is undoable and still needs Apply.
- **Reset this section: missing.** `Section` (`appearance-screen.tsx:517-527`) has only a title and children. No per-section reset exists anywhere in `screens/appearance/`.

### 7. Every color change goes through a contrast check — PASS
- Every color edit goes through `setRoleColor` → `update` → `setDraft` (`appearance-screen.tsx:157-169`), and presets and reset also replace `draft`.
- `issues` is recomputed from `draftBuilt.colors` on every draft change (`appearance-screen.tsx:129, 145-148`) using `contrastReport` (`tokens.ts:265-280`). That function covers 8 pairs (`tokens.ts:249-263`): text, secondary and tertiary on bg/surface, onAccent/accent, and link/bg.
- Derived tokens are forced to AA when neutrals change (`tokens.ts:78-89`).

## Full Preview

### 8. Full Preview screen inside a draft-token provider — FAIL
- No Full Preview route exists. The app routes are listed in `app/_layout.tsx:70-79`, and the only new one is `appearance`. There is no other file under `screens/appearance/` besides `appearance-screen.tsx`, `appearance-preview.tsx` and `controls.tsx`.
- Partial credit for what exists in the **embedded** preview: `ThemeScope` is a draft-token provider (`theme/theme-preference.tsx:423-445`), used at `appearance-screen.tsx:305-307`. `AppearancePreview` (`screens/appearance/appearance-preview.tsx:20-202`) renders a heading (41), body (42), caption (43), list item (45-71), card with chips (73-84), primary, secondary and disabled buttons (86-110), text input with an error state (112-148), switch (150-160), an inline dialog mock (162-171) and a tab bar (173-199).
- Missing: samples of **real app components**. `appearance-preview.tsx:1-12` imports only RN primitives, icons and theme hooks, with no `GlassCard`, `CoachCard`, `DoctorCard`, `AuthButton`, fighter `tab-bar`, etc.

### 9. Everything outside the preview stays on applied until Apply — PASS
- The editor chrome reads applied colors via `useThemePreference()` (`appearance-screen.tsx:78`; `Section`, `Label` and `ContrastIssues` at `518, 530, 535`). Draft tokens only enter through `ThemeScope`, which overrides `ColorsContext`, `TypographyContext` and `LayoutContext` for the preview subtree only (`theme-preference.tsx:427-445`). The preview never reads `useThemePreference` (`appearance-preview.tsx:16-19`, verified: it uses only `useColors`, `useTypography` and `useLayoutTokens`).
- `applied` changes only through `applyAppearance`, `setMode` and `undoLastApply` (`theme-preference.tsx:249-278`).
- Note: when draft history is empty, header **Undo** calls `undoLastApply()` (`appearance-screen.tsx:189-192`). That re-applies the previous applied settings app-wide immediately, without Apply. This is by design ("undo last Apply", plan §0.9), but it is the one path that changes the app from inside the editor without the Apply button.

### 10. Back to edit keeps draft; Cancel discards — FAIL
- "Back to edit" does not exist because there is no Full Preview screen (item 8).
- Cancel discards: PASS (item 6).

### 11. Preview-only light/dark toggle that does not change the draft's saved brightness — FAIL
- No such control exists. The only brightness control writes `draft.settings.mode` (`appearance-screen.tsx:342-347`). `AppearancePreview` has no scheme toggle.

## Flow

### 12. Unsaved-changes dialog (Save / Discard / Keep editing) on back, gesture, AND tab switch — FAIL
- The dialog exists (`appearance-screen.tsx:109-127`, a `beforeRemove` listener with `Alert.alert`), but it only has **Keep editing + Discard** (`114-123`; strings `i18n/appearance.ts:105-110`). There is **no Save option**.
- Back: the header back button calls `router.back()` (`appearance-screen.tsx:271`), which triggers `beforeRemove`. PASS by code.
- Gesture / Android hardware back: UNVERIFIED. `beforeRemove` normally fires for both, but no code specifically handles them. Manual step: make a change, then swipe back on iOS and press hardware back on Android, and confirm the dialog appears.
- Tab switch: **no handler** (no `tabPress`, `blur` or `usePreventRemove` anywhere in `src/`, grep). `/appearance` is a root-stack route (`app/_layout.tsx:79`) pushed above the role tab navigators, so tab bars are probably not reachable while editing. That is UNVERIFIED. Manual step: open Appearance from the coach Me tab, make a change, and check whether any tab bar is visible or tappable.

### 13. Contrast warning below AA, one-tap fix, saving still allowed, extra confirmation below 3:1 — PASS
- Warning: `ContrastIssues` (`appearance-screen.tsx:316, 534-571`) shows each failing pair with its ratio and the required value (`i18n/appearance.ts:88`). The thresholds are 4.5, or 3.0 for WCAG large text after scaling (`tokens.ts:265-280`; `color-math.ts:5-6, 57-60`), and ratios are not rounded before comparison (`formatRatio` floors for display only, `appearance-screen.tsx:73-75`).
- One-tap fix: a "Sửa màu" button per issue (`appearance-screen.tsx:559-566`) calls `fixIssue` (`220-241`), which uses `ensureContrast` (`color-math.ts:47-55`) to move the color toward black or white until the threshold is met.
- Saving allowed: `onApply` applies directly when nothing is severe (`appearance-screen.tsx:208-212`).
- Below 3:1: `level = "severe"` (`tokens.ts:276-277`) triggers an extra `Alert` with "Vẫn áp dụng" (`appearance-screen.tsx:214-217`).
- Not proven: whether one Fix always clears *every* related pair. For example, the secondary and tertiary fixes change `textColor` to reach 7:1 against one background (`appearance-screen.tsx:228-232`). Manual step: pick background `#808080` and text `#909090`, tap each Fix, and confirm the banner disappears.

### 14. Undo and Reset always reachable — PASS
- Both are in the fixed header, outside the scroll view (`appearance-screen.tsx:261-295`). Undo is disabled only when there is nothing to undo (`182, 280-281`). Reset is always enabled (`286-294`).

### 15. Single Settings entry point shared by all roles — FAIL (Guest missing)
| Role | Entry | Evidence |
| --- | --- | --- |
| Guest | **None** | `app/(guest)/_layout.tsx:1-11` is a bare stack. No `AppearanceLink` in any guest or admissions screen (grep). Auth screens only show `ThemeToggle` (`components/auth/auth-shell.tsx:232`). |
| Fighter | Yes | `app/(fighter)/cai-dat.tsx:1, 10` renders `AppearanceLink` (children are rendered by `BlockedFighterPage`, `screens/parity/blocked-workspace.tsx:26-40`). Reached from `screens/fighter/me-screen.tsx:100` (`/cai-dat`). |
| Coach | Yes | `screens/coach/me.tsx:4, 64-66` (no separate Settings screen). |
| Doctor | Yes | `screens/doctor/me-screen.tsx:4, 38`. |
| Admin | Yes | `app/(admin)/quan-tri/cai-dat.tsx:1, 9`. Reached from `screens/admin/admin-home.tsx:21`. |

- All four use the same component (`components/appearance/appearance-link.tsx:9-28`), which pushes `/appearance`. The route is at root level with no `RoleLayoutGate` (`app/appearance.tsx:1-5`, `app/_layout.tsx:79`).

### 16. Two light-mode contrast fixes — PASS
| Token (light) | Old (`git show HEAD:…/theme/colors.ts`) | New (`theme/colors.ts`) | Plan record |
| --- | --- | --- | --- |
| `inkSubtle` | `#7A7C84` (3.34:1 on `#E8E6E1`) | `#62646C` (line 32; 4.73:1) | `docs/theme-customization-plan.md:25` |
| `lotus` | `#8F7040` (3.69:1) | `#735A30` (line 36; 5.21:1) | same line |

- `ring` stays `#8F7040` (`theme/colors.ts:39`), as the plan intended (non-text focus ring). Dark-palette values are unchanged (`colors.ts:53, 57`).

### 17. Accessibility labels, 44x44 pt targets, usability at maximum text scale — UNVERIFIED
- Labels: mostly PASS. Back, undo and reset have explicit labels (`appearance-screen.tsx:268-289`); segments (`controls.tsx:47-51`), sliders (`adjustable` + value + actions, `controls.tsx:141-147`), step buttons (`controls.tsx:140, 169, 186-188`), swatches (`controls.tsx:210-234`), the hex input (`controls.tsx:280`), font rows (`appearance-screen.tsx:374`), Fix buttons (`561`) and the entry link (`appearance-link.tsx:14-16`) are labeled. Weak spots: swatch labels are raw hex strings like "#121316" (`controls.tsx:233`), and preset chips and footer Cancel/Apply rely on their child text (`appearance-screen.tsx:323-337, 493-510`).
- 44 pt: PASS by code. `iconButton` 44×44 (`appearance-screen.tsx:584`), `textButton` minHeight 44 (`585`), preset chip 44 (`599`), font row 56 (`607`), footer 52 (`643`), segment 44 (`controls.tsx:405`), track hit 44 (`415`), step 44×44 (`432-433`), swatch hit 44×44 (`450-451`), default chip 44 (`442`), hex input 44 (`463`), entry row 52 (`appearance-link.tsx:31`).
- Max text scale: **unproven**. Risks visible in code: `Segmented` labels use `numberOfLines={1}` (`controls.tsx:56`), so four brightness options in one row may truncate. The header puts the title, undo and a text "Mặc định" button in one 52 pt row (`appearance-screen.tsx:576-584`). Manual step: set the OS text size to maximum and the in-app size to 160% (the effective cap is 2.0×, `tokens.ts:177`), then open Appearance on a small Android and a small iOS device. Check for truncation or overlap in the header, segmented controls and footer, and check that screen-reader swipe order reaches every control.

## Migration

### 18. Remaining hardcoded colors, font families, font sizes — FAIL (counts only)

Method: `rg --count-matches` over `screens/` and `components/`, `*.test.*` excluded, text-based (not AST). Patterns: hex `#[0-9A-Fa-f]{3,8}\b`, rgb `rgba?\(`, font size `fontSize:\s*\d`, font-family literal `fontFamily:\s*["'\`]`, direct `fontFamily: fonts.*` (bypasses the user's font setting), and line height `lineHeight:\s*\d` for reference. Named color literals (`"white"`, `"black"`, …) in color props: 0.

**Per top-level directory** (`components/ui` shown separately, excluded from totals):

| Directory | Hex | rgb(a) | fontSize numeric | fontFamily literal | `fontFamily: fonts.*` | lineHeight numeric |
| --- | --- | --- | --- | --- | --- | --- |
| `components/launch` | 56 | 0 | 0 | 0 | 2 | 0 |
| `screens/appearance` | 26 | 0 | 0 | 0 | 0 | 0 |
| `screens/admin` | 0 | 0 | 9 | 0 | 8 | 0 |
| `screens/coach` | 0 | 0 | 0 | 0 | 0 | 24 |
| `screens/fighter` | 0 | 0 | 1 | 0 | 0 | 11 |
| `components/auth` | 0 | 3 | 2 | 0 | 0 | 0 |
| `components/admissions` | 0 | 1 | 2 | 0 | 0 | 0 |
| `components/visuals` | 0 | 0 | 3 | 0 | 1 | 0 |
| `screens/doctor` | 0 | 0 | 2 | 0 | 0 | 1 |
| `components/medical` | 0 | 0 | 0 | 0 | 0 | 4 |
| `components/` (root: `system-chrome.tsx`) | 2 | 0 | 0 | 0 | 0 | 0 |
| `components/blocked` | 0 | 0 | 0 | 0 | 0 | 1 |
| all other dirs | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total (excl. ui)** | **84** | **4** | **19** | **0** | **11** | **41** |
| `components/ui` (excluded) | 12 (`tokens.ts` 11, `Button.tsx` 1) | 0 | 0 | 0 | 0 | 0 |

Context: `components/launch/*` is the brand-fixed splash (plan §0.11, out of scope). The 26 hex values in `screens/appearance/appearance-screen.tsx:60-65` are swatch *data*, not styling.

**Top 10 files still hardcoding colors or font sizes** (hex + rgb + numeric fontSize, worst first, `components/ui` excluded):

| # | File | Count | What |
| --- | --- | --- | --- |
| 1 | `screens/appearance/appearance-screen.tsx` | 26 | hex swatch palette (intended data) |
| 2 | `components/launch/splash-hud-overlay.tsx` | 15 | hex (brand splash) |
| 3 | `components/launch/splash-glass-mesh.ts` | 14 | hex (brand splash) |
| 4 | `components/launch/splash-glass-shatter.tsx` | 11 | hex (brand splash) |
| 5 | `components/launch/mma-splash.tsx` | 10 | hex (brand splash) |
| 6 | `screens/admin/admin-page.tsx` | 9 | fontSize (`adminType`, lines 21-26 + 2), also 8 `fontFamily: fonts.*` |
| 7 | `components/admissions/country-select-field.tsx` | 3 | 1 rgba + 2 fontSize |
| 8 | `components/launch/splash-landing-marks.tsx` | 3 | hex (brand splash) |
| 9 | `components/visuals/charts.tsx` | 2 | fontSize (line 369 also `fonts.display`) |
| 10 | `components/auth/auth-date-field.tsx` | 2 | 1 rgba + 1 fontSize |

Ties at 2: `components/auth/auth-select-field.tsx`, `components/launch/launch-gate.tsx`, `components/system-chrome.tsx`. At 1: `components/auth/auth-demo-switch.tsx`, `components/visuals/sessions.tsx`, `screens/doctor/doctor-chrome.tsx`, `screens/doctor/medical-screen.tsx`, `screens/fighter/tab-bar.tsx`.

**Real "must migrate" list** (excluding brand splash, swatch data and `components/ui`): `screens/admin/admin-page.tsx` (9 fontSize + 8 fonts.*), `components/admissions/country-select-field.tsx` (3), `components/visuals/charts.tsx` (2 + 1 fonts.*), `components/auth/auth-date-field.tsx` (2), `components/auth/auth-select-field.tsx` (2), `components/system-chrome.tsx` (2), then the 1-count files above. The numeric `lineHeight` overrides, which ignore the line-height setting, are concentrated in `screens/coach/*` (24: `coach-ui` 5, `fighter-detail` 5, `fighters-list` 4, `plan-detail` 4, `plans-list`/`schedule-list`/`session-detail` 2 each) and `screens/fighter/*` (11 files × 1).

**Override 1 (NativeWind kit, `components/ui`)**: left out of the list. It is imported by:
- `app/_layout.tsx:9, 116`: `DesignPreview` is mounted in the **root layout for every user**, with no `__DEV__` gate, and starts visible as a full-screen overlay (`components/ui/DesignPreview.tsx:334-354`, `useState(true)`). It is marked "REMOVE AFTER REVIEW". This is the only production-path import. It is a layout file, not a role screen, but it renders over every screen. The plan's §0.1 statement that no real screen imports the kit is technically true, yet this overlay is still user-visible.
- `components/visuals/primitives.tsx:7`: only the `uiMotion` constant (no colors).
- `preview/*` (7 files) and `app/preview.tsx` → `preview/PreviewHub`: review-only.
- No role screen under `screens/` imports `components/ui`.
