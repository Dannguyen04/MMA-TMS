# Theme Customization Plan — MMA-TMS mobile (`reactnative-mobile/`)

Status: **Step 1 of 3 — audit, research, plan only.** No source file, dependency, or config was changed to produce this document.
Date: 2026-09-29.

Goal: move from a fixed light / dark / system choice to user-controlled appearance (font family, size, weight, line height, letter spacing, text / background / surface / accent colors, corner radius, spacing density, brightness mode), persisted locally, previewed live, and applied app-wide without restart.

---

## 0. Approved decisions (step 2 — implemented 2026-09-29)

These override anything below that conflicts.

**Stop gates (all passed before any install or source edit)**

- **Gate A — font method.** `@expo-google-fonts/*` packages loaded at runtime with `Font.loadAsync` from bundled `require()` assets, using the already-installed `expo-font ~57.0.4` (not reinstalled). Per https://docs.expo.dev/versions/v57.0.0/sdk/font/ this path needs no config plugin and no prebuild, so **no native rebuild**. The `expo-font` config plugin path (embed at build time) was **not** used because it requires prebuild.
- **Slider.** https://docs.expo.dev/versions/v57.0.0/sdk/slider/ lists `@react-native-community/slider` (5.2.1, MIT) as a native component. This project runs a dev build (`expo run:android`), so adding it would need a native rebuild. **Not installed**; sliders are a JS `PanResponder` control with −/+ buttons and screen-reader increment/decrement.
- **Gate B — bytes (measured from the npm tarballs).** Regular + Bold only for added families. Bundled typography fonts after this step: Barlow Condensed 600/700/800/900 = 418,332 B; IBM Plex Sans 400/500/600/700 = 872,964 B; Inter 686,480; Be Vietnam Pro 270,672; Noto Sans 1,259,992; Literata 516,136; Source Serif 4 660,156; Lexend 156,984 → **4,841,716 B ≈ 4.84 MB** (cap 6 MB). All imports use per-weight subpaths (e.g. `@expo-google-fonts/inter/400Regular`); the old package-root imports bundled every weight of Barlow + IBM Plex (5,009,736 B), so total font bytes went **down**. Merriweather (2,129,304 B for Regular+Bold) was **excluded** — it would push the total to ≈ 6.97 MB.
- **Gate C — packages installed** (`npx expo install`, names verified with `npm view`, license `MIT AND OFL-1.1`): `@expo-google-fonts/inter`, `@expo-google-fonts/be-vietnam-pro`, `@expo-google-fonts/noto-sans`, `@expo-google-fonts/literata`, `@expo-google-fonts/source-serif-4`, `@expo-google-fonts/lexend`. Nothing else.
- **Vietnamese coverage.** The cmap of every bundled Regular/Bold TTF was checked for 96 Vietnamese code points (Đ đ Ơ ơ Ư ư and all tone-marked vowels ạ…ỹ): 96/96 in all families. OpenDyslexic skipped (no rendered verification).

**Product decisions**

1. NativeWind UI kit (`components/ui/*`, `preview/*`, `tailwind.config.js`) left untouched. No real screen imports it (only the review-only `DesignPreview` and a motion constant in `components/visuals/primitives.tsx`), so nothing needed rebinding.
2. Colors: preset swatches **plus** free hex input and a self-written HSV picker (three sliders, no color-picker dependency). Every draft change runs the contrast check.
3. Light-mode WCAG fix (the only change to defaults): `inkSubtle` `#7A7C84` → `#62646C` (3.34 → 4.73:1 on `bg #E8E6E1`), `lotus` `#8F7040` → `#735A30` (3.69 → 5.21:1). `ring` (non-text focus ring, same old hex) was not changed.
4. Fonts (7): IBM Plex Sans (default), Inter, Be Vietnam Pro, Noto Sans, Literata, Source Serif 4, Lexend. No extras from the shortlist (Merriweather excluded by Gate B; monospace not requested).
5. Font family applies to body/content only (`type.body/label/link/caption/cta`). Headings (`type.title`, Barlow Condensed) and brand wordmark styles never change family. `displayFont` setting dropped.
6. Font scale 0.85–1.60 (step 0.05). Effective in-app factor = `min(fontScale, 2.0 / osFontScale)` using RN `useWindowDimensions().fontScale` (same value as `PixelRatio.getFontScale()`), so in-app × OS ≤ 2.0. `followSystemTextSize` dropped (OS scaling always on).
7. Font weight is `regular | bold` only (only Regular + Bold bundled for added families; no "light"). For added families, `medium` maps to Regular and `semibold` to Bold.
8. One Appearance screen at route `/appearance` (root stack). One shared entry component (`AppearanceLink`) in: fighter `/cai-dat`, admin `/quan-tri/cai-dat`, coach Me, doctor Me (coach and doctor have no separate Settings screen). The quick `ThemeToggle` stays and writes `applied.mode` directly (no draft).
9. Low contrast: inline warning + one-tap "Fix", Apply allowed. Below 3:1, one extra confirmation dialog. Undo (header, draft history then last Apply) and Reset (“Mặc định”) always visible.
10. Local only, AsyncStorage key `mma.ui.appearance.v1`, schema v1 as in §7; legacy `mma.ui.themePreference` migrated once and left in place. No sync, no API, no runtime font download.
11. Splash: stays brand black. `RootNavigator` renders `LaunchGate` (the only caller of `SplashScreen.hideAsync`) only after saved appearance **and** its body font are loaded (3 s storage / 4 s font timeouts fall back to defaults). `runSplashBootstrap` was not changed; the provider owns hydration.
12. Settings kept out of step 2: `motion`, `highContrast` (the high-contrast presets cover it), `displayFont`, `followSystemTextSize`.

**What is live vs. follow-up**

- Live now: colors (all `useThemePreference().colors` consumers), `type.title/body/label/link/caption/cta` (family, size, weight, line height, letter spacing — resolved at render time by every call site), native color scheme, preview, persistence.
- Density and corner radius are stored, previewed, and exposed via `useLayoutTokens()`, but existing screens still use the module-level `spacing` / `radius` constants baked into `StyleSheet.create` — they do not change yet.
- Fixed `fontSize` / `lineHeight` overrides that will ignore the scale/line-height settings: 29 files, e.g. `screens/admin/admin-page.tsx` (`adminType`, 9), `screens/coach/*` (`coach-ui`, `fighter-detail`, `fighters-list`, `plan-detail`, `plans-list`, `schedule-list`, `session-detail`), `screens/fighter/*` (11 files, mostly `lineHeight`), `components/medical/*`, `components/auth/auth-date-field|auth-select-field`, `components/admissions/country-select-field`, `components/visuals/charts|sessions`, `screens/doctor/doctor-chrome|medical-screen`, `components/blocked/blocked-api-notice`, `app/(coach)/_layout.tsx`.

---

## 1. Framework detection

Source: `reactnative-mobile/package.json` (quoted verbatim).

| Package | Version string in `package.json` |
| --- | --- |
| `expo` | `"~57.0.22"` |
| `react-native` | `"0.86.3"` |
| `react` | `"19.2.3"` |
| `expo-router` | `"~57.0.21"` |
| `nativewind` | `"4.2.7"` |
| `tailwindcss` (dev) | `"^3.4.17"` |
| `react-native-reanimated` | `"4.5.1"` |
| `react-native-worklets` | `"0.10.1"` |
| `moti` | `"^0.30.0"` |
| `expo-font` | `"~57.0.4"` |
| `@expo-google-fonts/barlow-condensed` | `"^0.4.1"` |
| `@expo-google-fonts/ibm-plex-sans` | `"^0.4.1"` |
| `expo-system-ui` | `"~57.0.4"` |
| `expo-status-bar` | `"~57.0.1"` |
| `expo-navigation-bar` | `"~57.0.2"` |
| `typescript` (dev) | `"~6.0.3"` |

Framework: **Expo SDK 57 / React Native 0.86.3 / React 19.2.3**, file-based routing via Expo Router. No `pubspec.yaml` (not Flutter).

Local storage libraries installed:

- `"@react-native-async-storage/async-storage": "2.2.0"`
- `"expo-secure-store": "~57.0.4"` (used only for the session token in `src/api/tokens.ts`)
- **Not installed:** MMKV, zod, any color-picker, slider, or segmented-control package.

`app.json` already sets `"userInterfaceStyle": "automatic"` and lists the `expo-system-ui` and `expo-font` config plugins.

---

## 2. Audit

### 2.1 Where themes are defined and how they reach components

There are **two independent theming systems** today:

**A. Context palette (the real app theme).**

- `src/theme/colors.ts` — `palettes: Record<"light" | "dark", ColorTokens>`; 23 semantic-ish tokens (`bg`, `surface`, `surfaceMuted`, `ink`, `inkMuted`, `inkSubtle`, `line`, `controlBorder`, `cage`, `lotus`, `cta`, `onCta`, `ring`, `danger`, `dangerSoft`, `success`, `successSoft`, `disabledFill`, `disabledInk`).
- `src/theme/theme-preference.tsx` — `ThemePreferenceProvider` + `useThemePreference()` exposing `{ preference, setPreference, resolvedScheme, colors }`. `ThemePreference = "light" | "dark" | "system"`. Listens to `Appearance.addChangeListener`, calls `Appearance.setColorScheme`, and animates a cross-fade between palettes with `Animated.timing` + `lerpTokens` (`src/theme/interpolate-tokens.ts`), skipping animation when Reduce Motion is on.
- Mounted at the root in `src/app/_layout.tsx` (`<ThemePreferenceProvider>` wraps `SessionProvider` and the navigator). The root `Stack` reads `colors.bg` / `colors.ink` for header, content, status bar and navigation bar colors.
- UI switch: `src/components/auth/theme-toggle.tsx` (`ThemeToggle`) cycles light → dark → system. Rendered in `components/auth/auth-shell.tsx`, `screens/doctor/doctor-chrome.tsx`, `screens/fighter/me-screen.tsx`, `screens/coach/me.tsx`, `screens/admin/admin-page.tsx`.
- Consumption pattern: `const { colors } = useThemePreference()` then inline style arrays, e.g. `style={[type.title, { color: colors.ink }]}` alongside a static `StyleSheet.create` for layout. `useThemePreference` appears in **100 files**; `colors.(bg|surface|ink|inkMuted|cta|lotus)` alone matches **528 times in 101 files**.

**B. NativeWind / Tailwind "UI kit" palette (fixed dark, not user-switchable).**

- `tailwind.config.js` — hardcoded dark palette (`background #0B0B0D`, `surface #141417`, `text #F4F4F5`, `muted #9A9AA5`, `primary #F97316`, …), a fontSize scale (`label` … `display`), spacing and radius tokens.
- `src/components/ui/tokens.ts` — `uiColors` duplicates those hex values for props that can't take a className ("Keep in sync with tailwind.config.js").
- Used by the new untracked `src/components/ui/*` kit (Avatar, Badge, Button, Card, Chip, Input, ListRow, Screen, Skeleton, Text, DesignPreview) and `src/preview/*` (21 files use `className=`). `global.css` holds only the Tailwind directives. `darkMode: "class"`; on web `_layout.tsx` forces `colorScheme.set("dark")`.
- This palette **ignores** `ThemePreferenceProvider`: switching to light mode does not change these components. The kit is marked "REMOVE AFTER REVIEW" in `_layout.tsx` / mocks, so its future is an open question (see §13).

**Typography, spacing, radius are static module constants**, not theme values:

- `src/theme/typography.ts` — `fonts` (Barlow Condensed 600/700/800/900 for display, IBM Plex Sans 400/500/600 for UI) and `type` text styles (`title`, `body`, `label`, `link`, `caption`, `cta`, wordmark variants). `viLineHeight(fontSize) = ceil(fontSize × 1.35)` with the comment "Vietnamese diacritics need extra leading. Never set UI lineHeight below this."
- `src/theme/spacing.ts`, `src/theme/radius.ts`, `src/theme/shadows.ts`, `src/theme/motion.ts`.
- Call sites outside `src/theme/`: `type.*` **334 matches / 71 files**, `spacing.*` **233 / 45**, `radius.*` **56 / 25**, `fonts.*` **28 / 6**, `StyleSheet.create` in **49 files**. Because these are imported constants (and baked into `StyleSheet.create` at module load), **none of them can react to a runtime setting today**. This is the main migration cost.

Fonts are loaded with `useFonts(...)` in `src/app/_layout.tsx` from the two `@expo-google-fonts/*` packages (bundled, offline).

### 2.2 Hardcoded values that bypass the theme

**Methodology (be aware of limits):** ripgrep text search over `reactnative-mobile/src/**/*.{ts,tsx}`, excluding `*.test.*`. This is **not** an AST analysis; it misses values computed at runtime, values in template strings built dynamically, and it counts token *definitions* inside `src/theme/` and `components/ui/tokens.ts`. Patterns:

| Category | Pattern |
| --- | --- |
| Hex colors | `#[0-9A-Fa-f]{3,8}\b` |
| rgb/rgba | `rgba?\(` |
| Numeric font size | `fontSize:\s*\d` |
| Font family literal | `fontFamily:\s*["'\`]` (zero hits — all families go through `fonts.*`) |
| Numeric spacing | `(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical)?:\s*\d` and `(gap|rowGap|columnGap):\s*\d` |
| Numeric radius | `borderRadius:\s*\d` |
| Numeric line height | `lineHeight:\s*\d` |
| Tailwind arbitrary values | `(text|bg|border|p…|m…|gap|rounded)-\[…\]` |
| Fixed Tailwind palette classes | `(bg|text|border)-(background|surface|text|muted|primary|border|success|warning|danger|info)` |

**Totals (all of `src/`, tests excluded):** hex 118 matches / 14 files · rgb(a) 7 / 5 · numeric `fontSize` 34 / 11 · numeric `lineHeight` 42 / 22 · numeric spacing 28 / 21 · numeric `borderRadius` 9 / 8 · Tailwind arbitrary 5 / 3 · fixed Tailwind palette classes 92 / 15 · numeric icon `size={N}` 44 / 22 · `fontFamily` string literals 0.

**Per directory (hex, rgb, fontSize, spacing, radius, tw-arbitrary):**

| Directory | Total | Notes |
| --- | --- | --- |
| `theme/` | 65 | Token definitions — expected (hex 46, fontSize 14). |
| `components/launch/` | 52 | Splash/launch visuals, hex 51. Intentionally brand-fixed black splash. |
| `components/auth/` | 15 | rgb 3, fontSize 2, spacing 4, radius 6. |
| `screens/admin/` | 15 | fontSize 9, spacing 5, radius 1. |
| `components/ui/` | 12 | hex 11 (all in `tokens.ts`) + fixed Tailwind classes (see below). |
| `screens/fighter/` | 10 | spacing 8, radius 1, fontSize 1. |
| `components/admissions/` | 4 | |
| `components/visuals/` | 4 | fontSize 3. |
| `preview/` | 4 | Tailwind arbitrary values. |
| `components/medical/` | 3 | |
| `components/` (root) | 2 | `system-chrome.tsx` hex. |
| `screens/admissions/`, `screens/coach/`, `screens/doctor/` | 2 each | |
| `app/`, `app/(coach)` | 1 each | |

Numeric `lineHeight` overrides cluster in `screens/coach/*` (24 across 7 files) and `screens/fighter/*` (11 files, 1 each) — these will fight a user line-height setting.

Fixed Tailwind palette classes (don't follow light/dark or custom colors): `preview/visuals.tsx` 36, `components/ui/Badge.tsx` 10, `DesignPreview.tsx` 8, `Text.tsx` 8, `Button.tsx` 6, `Input.tsx` 5, `Chip.tsx` 4, `AdminScreenPreview.tsx` 4, `Card.tsx` 3, others 1–2.

**10 worst offending files (excluding `src/theme/*` token definitions):**

| # | File | Matches | What |
| --- | --- | --- | --- |
| 1 | `src/preview/visuals.tsx` | 39 | 36 fixed Tailwind palette classes + 3 arbitrary values |
| 2 | `src/components/launch/splash-hud-overlay.tsx` | 15 | hex |
| 3 | `src/components/launch/splash-glass-mesh.ts` | 14 | hex |
| 4 | `src/components/ui/tokens.ts` | 11 | hex (duplicate of `tailwind.config.js`) |
| 5 | `src/components/launch/splash-glass-shatter.tsx` | 11 | hex |
| 6 | `src/components/ui/Badge.tsx` | 10 | fixed Tailwind palette classes |
| 7 | `src/components/launch/mma-splash.tsx` | 10 | hex |
| 8 | `src/screens/admin/admin-page.tsx` | 10 | 9 numeric `fontSize`, 1 spacing |
| 9 | `src/components/ui/Text.tsx` | 8 | fixed Tailwind palette classes |
| 10 | `src/components/ui/DesignPreview.tsx` | 8 | fixed Tailwind palette classes |

Honorable mentions: `screens/coach/coach-ui.tsx` and `screens/coach/fighter-detail.tsx` (5 numeric `lineHeight` each), `components/admissions/country-select-field.tsx` (rgb + 2 fontSize + spacing).

**Contrast of existing palettes** (computed with the WCAG relative-luminance formula, not rounded):

| Pair | Light | Dark |
| --- | --- | --- |
| `ink` / `bg` | 14.89 | 17.55 |
| `inkMuted` / `bg` | 5.18 | 8.62 |
| `inkSubtle` / `bg` | **3.34 (fails 4.5)** | 5.08 |
| `lotus` / `bg` | **3.69 (fails 4.5)** | 8.77 |
| `danger` / `bg` | 4.503 (passes by 0.003) | 5.72 |
| `onCta` / `cta` | 16.30 | 8.23 |

`inkSubtle` is used for captions/helper text and placeholders; `lotus` for accents/icons. Both fail AA for normal text in light mode. Suggested fixes that pass: `inkSubtle #62646C` (4.73 on bg) and `lotus #735A30` (5.21 on bg) — needs design approval (see §13).

### 2.3 Existing persistence

- Key: **`THEME_PREFERENCE_KEY = "mma.ui.themePreference"`** (`src/theme/theme-preference.tsx`), value is a bare string `"light" | "dark" | "system"`.
- Written in `setPreference` via `AsyncStorage.setItem`; read in the provider's mount effect via `AsyncStorage.getItem`.
- Also read (but the value is **not passed to the provider**) in `src/bootstrap/load-core.ts` → `runSplashBootstrap()` as one of three splash storage tasks. The provider therefore does a second, independent read.
- Other keys in the same namespace: `"mma.session"`, `"mma.dashboard.cache"`.
- Flash risk today: the provider starts at `"system"` and hydrates asynchronously; the animated splash (`LaunchGate`) happens to cover the gap, and `skipLaunchMotion` avoids animating the first hydration. There is no explicit "wait for theme" gate.

---

## 3. Research summary (retrieved facts only)

- **Material Design 3 (via Android Compose docs):** an M3 theme has three subsystems — color scheme, typography, shapes — and customizing them updates all components. Color uses paired roles (`primary` / `onPrimary`, `primaryContainer` / `onPrimaryContainer`, `surface` / `onSurface`, `surfaceVariant`). The type scale has 15 styles: display / headline / title / body / label × large / medium / small (e.g. `displayLarge` 57/64, `bodyLarge` 16/24); products may use a reduced set. Shapes form a scale (small / medium / large …). The m3.material.io pages themselves were JavaScript-rendered and could not be fetched → role names come from the Android docs. [Material color role *descriptions* on m3.material.io: uncertain — not retrieved.]
- **Apple HIG typography:** iOS/iPadOS default body text 17 pt, minimum 11 pt. Text styles (Large Title 34/41, Title 1 28/34, Title 2 22/28, …, Caption 1 12/16, Caption 2 11) define weight, size and leading per Dynamic Type size, and scale proportionately when users change text size. WWDC24: 7 standard text sizes, plus 5 larger accessibility sizes when enabled. Custom fonts should still scale with Dynamic Type.
- **WCAG 2.2 SC 1.4.3 Contrast (Minimum), AA:** text ≥ 4.5:1; large-scale text ≥ 3:1. Large = at least 18 pt, or 14 pt bold. Thresholds are not to be rounded (4.499:1 fails). AAA (1.4.6) is 7:1.
- **React Native `Text` (0.86 docs on reactnative.dev):** `allowFontScaling` defaults to `true` (respects OS text size); `maxFontSizeMultiplier` caps scaling; `dynamicTypeRamp` (iOS) picks which Dynamic Type ramp a text follows. Styles do **not** inherit across `View`s — the recommended way to apply a consistent font app-wide is a shared `AppText` component.
- **Expo SDK 57 `expo-font`:** the config plugin embeds font files at build time (recommended for Android/iOS; more efficient than `useFonts`/`loadAsync`); `useFonts` loads at runtime from bundled `require()` assets. `getLoadedFonts()` / `isLoaded()` are synchronous. `loadAsync` can also load from a remote URI — **we will not use that** (offline requirement).
- **Expo SDK 57 `expo-system-ui`:** `setBackgroundColorAsync(color)` changes the root view background at runtime (useful for true-black and custom background so the area behind screens matches). `userInterfaceStyle` via config plugin is build-time only.
- **Expo SDK 57 AsyncStorage page:** async, **unencrypted**, persistent key-value store; fine for non-sensitive appearance settings.
- **Apple Books:** Themes & Settings → font size (A / A buttons), page theme (e.g. Original, Quiet, Paper, Bold, Calm, Focus), font choice, Bold Text toggle; "Customize" exposes sliders for line spacing, character spacing, word spacing and margins, plus Justify Text; a live preview reflects slider changes; "Reset Theme" reverts. Custom background colors are not offered.
- **Kindle:** Aa menu with Font / Layout / Themes tabs: font list (incl. **OpenDyslexic** in the apps), size slider, five bold levels; line / paragraph / word / character spacing, margins, alignment; page colors **white, sepia, light green, black**; follows device Dark Mode; save named custom themes; preset themes **Compact, Standard, Large, Low Vision**.
- **Notion:** per-page font style **Default / Serif / Mono**, "Small text" and "Full width" toggles; these styling options exist only on desktop/web, not mobile; no global default.
- **Pocket:** not researched (service status not verified) — omitted.

Design takeaways: (1) presets + fine-grained overrides is the common model (Kindle, Books); (2) spacing controls are sliders with a live preview; (3) a reset-to-preset action is expected; (4) page colors are limited, curated swatches rather than free color pickers in the mainstream readers — free pickers need a contrast guard.

### 3.1 Font candidates (offline, bundled)

All fonts below would be bundled in the binary (via `@expo-google-fonts/*` packages + `useFonts`, or the `expo-font` config plugin). No runtime downloads.

Because the app UI is Vietnamese (`src/i18n/vi.ts`, `viLineHeight`), **Vietnamese glyph coverage is a hard requirement**. License and subsets were read from each family's `METADATA.pb` in the `google/fonts` GitHub repo; npm versions from `npm view` on 2026-09-29.

| Family | Role | License | Vietnamese subset | npm package (version checked 2026-09-29) |
| --- | --- | --- | --- | --- |
| IBM Plex Sans | Current UI font (default) | OFL | Yes | `@expo-google-fonts/ibm-plex-sans` 0.4.1 (installed) |
| Barlow Condensed | Current display font (headings/brand) | OFL | Yes | `@expo-google-fonts/barlow-condensed` 0.4.1 (installed) |
| Inter | Neutral UI sans | OFL | Yes | `@expo-google-fonts/inter` 0.4.2 |
| Be Vietnam Pro | Sans designed with Vietnamese in mind | OFL | Yes | `@expo-google-fonts/be-vietnam-pro` 0.4.1 |
| Noto Sans | Wide-coverage fallback sans | OFL | Yes | `@expo-google-fonts/noto-sans` 0.4.2 |
| Literata | Reading serif | OFL | Yes | `@expo-google-fonts/literata` 0.4.3 |
| Source Serif 4 | Reading serif | OFL | Yes | `@expo-google-fonts/source-serif-4` 0.4.1 |
| Merriweather | Screen-oriented serif | OFL | Yes | `@expo-google-fonts/merriweather` 0.4.2 |
| **Lexend** | **Readability / dyslexia-friendly option** (designed around reading-fluency research by Dr. Bonnie Shaver-Troup, per lexend.com) | OFL | Yes | `@expo-google-fonts/lexend` 0.4.1 |
| OpenDyslexic | Dyslexia-specific typeface (offered by Kindle) | SIL OFL 1.1 (read from `OFL.txt` in the author's repo; sources have moved to forge.hackers.town) | **[uncertain]** — not verified | No `@expo-google-fonts` package (404). An npm package `open-dyslexic` 1.0.3 exists with license "SEE LICENSE IN README.md" — **[uncertain]**; prefer vendoring the OFL `.otf` files into `assets/fonts/`. |
| Atkinson Hyperlegible / Next | Low-vision legibility | OFL | **No** (latin, latin-ext only) | `@expo-google-fonts/atkinson-hyperlegible(-next)` 0.4.1 — **excluded** because Vietnamese diacritics are missing. |

The `@expo-google-fonts/*` packages are licensed `MIT AND OFL-1.1` (package code MIT, font files OFL) per the npm registry.

**Recommended shortlist (8):** IBM Plex Sans (default), Inter, Be Vietnam Pro, Noto Sans, Literata, Source Serif 4, Lexend (dyslexia-friendly), and a monospace option only if requested. OpenDyslexic can be added once its Vietnamese coverage is verified by rendering test strings. Barlow Condensed stays as the display/brand face, not a body option.

Bundle-size note: each family adds several weights (≈3 per family if we load 400/500/600 or 400/600/700). Limit to 3 weights per family.

---

## 4. Proposed customizable settings

Every setting is optional in storage; missing values fall back to the selected preset, then to built-in defaults.

| Setting | Key | Type | Allowed range / options | Default |
| --- | --- | --- | --- | --- |
| Brightness mode | `mode` | enum | `"light"` \| `"dark"` \| `"system"` \| `"trueBlack"` | `"system"` (matches today) |
| Dark variant when mode = system | `systemDarkVariant` | enum | `"dark"` \| `"trueBlack"` | `"dark"` |
| Font family (body/UI) | `fontFamily` | enum id | `ibmPlexSans`, `inter`, `beVietnamPro`, `notoSans`, `literata`, `sourceSerif4`, `lexend` (+ `openDyslexic` if approved) | `ibmPlexSans` |
| Display (heading) font | `displayFont` | enum | `"brand"` (Barlow Condensed) \| `"matchBody"` | `"brand"` |
| Font size scale | `fontScale` | number | 0.85 – 1.60, step 0.05 | 1.00 |
| Respect OS text size | `followSystemTextSize` | boolean | — | `true` (keeps `allowFontScaling`) |
| Font weight | `fontWeight` | enum | `"light"` (one step lighter where available) \| `"regular"` \| `"bold"` (one step heavier, like Kindle/Books bold) | `"regular"` |
| Line height | `lineHeight` | number (multiplier of font size) | 1.35 – 1.80, step 0.05 (floor 1.35 = existing Vietnamese rule) | 1.35 |
| Letter spacing | `letterSpacing` | number (em, multiplied by font size) | 0.00 – 0.12 em, step 0.01 | 0.00 (per-style defaults, e.g. titles, are added on top) |
| Text color | `textColor` | hex `#RRGGBB` \| `null` | swatch list + optional free hex; `null` = preset value | `null` |
| Background color | `backgroundColor` | hex \| `null` | swatches (white, paper/sepia, light green, grey, black, …) + optional free hex | `null` |
| Surface (card) color | `surfaceColor` | hex \| `null` | swatches + optional hex; if `null` but background is custom, derive by mixing background toward text by 4–6 % | `null` |
| Primary / accent color | `accentColor` | hex \| `null` | curated swatches (brand gold, blue, green, red, violet, orange) + optional hex; `onAccent` auto-picked (black or white, whichever has higher contrast) | `null` |
| Corner radius | `radiusScale` | enum | `"sharp"` (×0.5) \| `"default"` (×1) \| `"round"` (×1.5); `pill` stays 9999 | `"default"` |
| Spacing density | `density` | enum | `"compact"` (×0.85) \| `"comfortable"` (×1) \| `"spacious"` (×1.15); touch targets never below 44 pt | `"comfortable"` |
| Motion | `motion` | enum | `"system"` \| `"reduced"` | `"system"` (existing Reduce Motion check) |
| High-contrast boost | `highContrast` | boolean | forces text tokens to meet 7:1 where possible | `false` |

Derived, not user-set: `textSecondary`, `textTertiary`, `border`, `divider`, `disabled*`, `*Soft` status backgrounds — computed from the base colors so custom colors stay coherent.

---

## 5. Presets

Presets are named bundles of the settings above. Choosing a preset resets overrides; editing any setting afterward marks the preset as "Custom (based on X)".

**Existing themes (kept as presets, names from code):**

1. **Light** — `palettes.light` in `src/theme/colors.ts` (`ThemePreference "light"`).
2. **Dark** — `palettes.dark` (`ThemePreference "dark"`).
3. **System** — `ThemePreference "system"`: Light or Dark following the OS.
4. *(Question)* **UI Kit Dark** — the fixed palette in `tailwind.config.js` / `components/ui/tokens.ts` (orange `primary #F97316`). It is not user-selectable today and is marked "REMOVE AFTER REVIEW". Keep as a preset only if the product owner wants it (§13).

**New presets (grounded in research; all colors verified ≥ 4.5:1 for body text):**

| Preset | Source of idea | Key values | Measured contrast |
| --- | --- | --- | --- |
| **True Black (OLED)** | Kindle "black" page color; OLED dark | bg `#000000`, surface `#0E0F11`, text = Dark ink, accent `#C9A86C` | ink 18.60, muted 9.14, accent 9.30 |
| **Paper (Sepia)** | Kindle sepia, Apple Books "Paper" | bg `#F4ECD8`, surface `#FBF6EA`, ink `#3B2F20`, muted `#6B5A43`, accent `#8A5A1F`; font Literata | ink 11.06, muted 5.63, accent 5.01 |
| **Mint** | Kindle light green page color | bg `#E3EFE3`, surface `#F2F8F2`, ink `#13241A`, muted `#3F5446`, accent `#1F6B3A` | ink 13.69, muted 6.90, accent 5.50 |
| **High Contrast Light** | WCAG AAA 7:1 | bg/surface `#FFFFFF`, ink `#000000`, muted `#333333`, accent `#5E4520` | 21 / 12.64 / 8.94 |
| **High Contrast Dark** | WCAG AAA 7:1 | bg/surface `#000000`, ink `#FFFFFF`, muted `#D0D0D0`, accent `#F0D9A8` | 21 / 13.62 / 15.20 |
| **Large Text** | Kindle "Large" | Light/Dark colors, `fontScale 1.3`, `lineHeight 1.5`, `density spacious` | — |
| **Low Vision** | Kindle "Low Vision" | High Contrast colors, `fontScale 1.5`, `fontWeight bold`, `lineHeight 1.6` | — |
| **Compact** | Kindle "Compact" | Light/Dark colors, `fontScale 0.9`, `density compact` | — |
| **Readable (Dyslexia-friendly)** | Lexend research; Books/Kindle spacing sliders | font Lexend, `letterSpacing 0.05`, `lineHeight 1.6`, Paper colors | — |

---

## 6. Token architecture

Components must only read **semantic tokens**; raw hex values live only inside presets.

```ts
type ThemeTokens = {
  scheme: "light" | "dark";          // drives status bar icons, Appearance
  color: {
    background: string;              // was bg
    surface: string;                 // was surface
    surfaceMuted: string;
    textPrimary: string;             // was ink
    textSecondary: string;           // was inkMuted
    textTertiary: string;            // was inkSubtle
    accent: string;                  // was cta (dark) / lotus
    onAccent: string;                // was onCta
    accentSubtle: string;            // was lotus/ring usage for highlights
    border: string;                  // was line
    controlBorder: string;
    focusRing: string;               // was ring
    danger: string; dangerSurface: string;
    success: string; successSurface: string;
    warning: string; info: string;   // from tailwind palette, currently missing in context palette
    disabledSurface: string; disabledText: string;
    brandCage: string;               // was cage (brand-only)
  };
  type: Record<"display" | "title" | "body" | "label" | "link" | "caption" | "cta", TextStyle>;
  fonts: { regular: string; medium: string; bold: string; display: string };
  space: typeof spacing;             // scaled by density
  radius: typeof radius;             // scaled by radiusScale
};
```

Mapping plan:

- Keep the current `ColorTokens` names working through a thin alias layer during migration (`colors.ink` → `color.textPrimary`) so 100 files don't need to change at once.
- `type` becomes a function `buildType(settings)` that applies `fontFamily`, `fontScale`, `fontWeight`, `lineHeight` (never below `viLineHeight`), `letterSpacing`.
- `spacing` / `radius` become `buildSpace(density)` / `buildRadius(radiusScale)`.
- NativeWind: either (a) retire the UI kit palette, or (b) map Tailwind colors to CSS variables fed from `ThemeTokens` (NativeWind 4 supports `vars()`; **[uncertain]** exact API for 4.2.7 — must read the NativeWind docs before implementing). Decision needed (§13).
- Splash/launch visuals (`components/launch/*`) stay brand-fixed and are explicitly out of scope.

---

## 7. Persistence design

- **Storage:** existing `@react-native-async-storage/async-storage` 2.2.0 (no new dependency). Data is non-sensitive.
- **New key:** `mma.ui.appearance.v1` (JSON). The legacy key `mma.ui.themePreference` is read once for migration, then left in place for one release (for rollback) and deleted in a later release.
- **Schema (version 1):**

```json
{
  "version": 1,
  "presetId": "dark",
  "overrides": {
    "mode": "system",
    "systemDarkVariant": "dark",
    "fontFamily": "ibmPlexSans",
    "displayFont": "brand",
    "fontScale": 1.0,
    "followSystemTextSize": true,
    "fontWeight": "regular",
    "lineHeight": 1.35,
    "letterSpacing": 0,
    "textColor": null,
    "backgroundColor": null,
    "surfaceColor": null,
    "accentColor": null,
    "radiusScale": "default",
    "density": "comfortable",
    "motion": "system",
    "highContrast": false
  },
  "updatedAt": "2026-09-29T00:00:00.000Z"
}
```

Only keys the user actually changed are stored in `overrides`; everything else resolves from the preset.

- **Migration:**
  - No new key + legacy `"light" | "dark" | "system"` → `{ version: 1, presetId: legacy === "system" ? "system" : legacy, overrides: { mode: legacy } }`, then write the new key.
  - Neither key → defaults (`presetId: "system"`).
  - Future versions: a `migrations: Record<number, (old) => next>` chain applied in order until `version === CURRENT`. Unknown higher version (downgrade) → ignore and use defaults without overwriting the stored value.
- **Validation of corrupt / partial data** (hand-written validator, no zod needed):
  - `JSON.parse` failure → defaults; keep the raw string under `mma.ui.appearance.corrupt` for debugging, overwrite on next Apply.
  - Unknown `presetId` → `"system"`.
  - Each override validated independently: wrong type, out of range, unknown enum, or invalid hex (`/^#[0-9A-Fa-f]{6}$/`) → drop that field only (partial data keeps valid fields). Numbers are clamped to range and snapped to step.
  - Unknown font id, or font not loaded (`Font.isLoaded` false) → fall back to `ibmPlexSans`.
  - After validation, if the resolved text/background pair is below 4.5:1 (e.g. tampered storage), still load it but surface the contrast warning banner in Settings.
- **Loading before first render (no theme flash):**
  - Extend `runSplashBootstrap()` (already reads the theme key while the native splash / `LaunchGate` is showing) to read `mma.ui.appearance.v1` + legacy key, validate, and hand the resolved `applied` settings to the provider as `initialSettings`. This removes the duplicate AsyncStorage read in the provider.
  - The provider renders children only after `hydrated === true`; until then the splash stays visible (already the case via `SplashScreen.preventAutoHideAsync()` and `LaunchGate`).
  - On hydrate, call `SystemUI.setBackgroundColorAsync(color.background)` and `Appearance.setColorScheme(...)` so the root view and native chrome match before the splash hides.
  - First hydration never animates (keep existing `skipLaunchMotion` behaviour).

---

## 8. Contrast guard

- Utility `contrastRatio(fg, bg)` implementing WCAG relative luminance (sRGB linearization, `(L1 + 0.05) / (L2 + 0.05)`), **no rounding before comparison**.
- Checked pairs on every draft change: `textPrimary`/`background`, `textPrimary`/`surface`, `textSecondary`/`background` and `/surface`, `textTertiary`/`surface`, `onAccent`/`accent`, `accent`/`background` (links, icons).
- Thresholds: 4.5:1 for body text. 3:1 applies only to "large" text — ≥ 18 pt regular or ≥ 14 pt bold **after** `fontScale` is applied — and to non-text UI (borders, focus ring) per WCAG 1.4.11 **[uncertain: 1.4.11 page not fetched; stated from the 3:1 non-text convention]**.
- UX: inline warning under the color control ("Text may be hard to read — 3.2:1, needs 4.5:1") with a one-tap **"Fix"** that nudges lightness of the text color (keeping hue) until it passes. Apply is **allowed** with a confirmation dialog (user autonomy), except when `textPrimary`/`background` < 3:1, where Apply is blocked (unreadable UI including the settings screen itself).
- Derived colors (`textSecondary`, `textTertiary`, `onAccent`) are computed to satisfy AA automatically; if impossible, fall back to `textPrimary`.
- Unit-test the utility against known pairs (e.g. `#000`/`#FFF` = 21, the light `danger`/`bg` = 4.503).

---

## 9. Draft vs Applied state

- **`applied`**: the validated settings that drive the entire app; the only thing persisted.
- **`draft`**: in-memory copy created when the Appearance screen opens; drives only the preview pane inside that screen.

Transitions:

| Event | Effect |
| --- | --- |
| Open Appearance screen | `draft = clone(applied)` |
| Edit any control | `draft` updated; preview re-renders; contrast guard runs; `isDirty = !deepEqual(draft, applied)` |
| Pick preset | `draft = preset defaults` (overrides cleared) |
| **Apply** | validate → `applied = draft` → persist to `mma.ui.appearance.v1` → app re-themes (animated cross-fade unless reduced motion) → `isDirty = false` |
| **Cancel / Back** | `draft` discarded; app unchanged |
| Back / swipe / hardware back while `isDirty` | confirm dialog: "Discard changes?" → Discard / Keep editing (Expo Router `usePreventRemove`/`beforeRemove` listener — **[uncertain]** exact API name in Expo Router 57, verify in docs) |
| **Reset to preset** | `draft = preset defaults` (still needs Apply) |
| App backgrounded with dirty draft | draft kept in memory only; lost if the process dies (acceptable) |
| Persist failure on Apply | keep `applied` in memory for the session, show a toast "Couldn't save; will retry", retry on next Apply |

State ownership: `AppearanceProvider` holds `applied`; the Appearance screen owns `draft` via local `useReducer` and wraps its preview in a nested `ThemeScope` provider fed with `buildTokens(draft)`, so the rest of the app never sees the draft.

---

## 10. Real-time propagation (Expo SDK 57 / RN 0.86 / React 19)

- **Single source:** `AppearanceProvider` (replaces/extends `ThemePreferenceProvider`) stores `applied` and exposes memoized `tokens = useMemo(() => buildTokens(applied, systemScheme, systemFontScale), [...])`.
- **No remount:** changing tokens re-renders consumers through context; navigation state and screen state are preserved (no `key` change on the navigator).
- **Avoid broad re-renders:**
  - Split contexts: `ColorContext`, `TypeContext`, `LayoutContext` (space/radius), and a stable `AppearanceActionsContext` (setters never change identity). A screen that only reads colors does not re-render on font changes and vice versa.
  - Components subscribe via small hooks: `useColors()`, `useType()`, `useSpace()`. Optionally `useSyncExternalStore` with selector for fine-grained reads **(only if profiling shows need)**.
  - Replace module-level `StyleSheet.create` values that depend on theme with `useThemedStyles(factory)` → `useMemo(() => StyleSheet.create(factory(tokens)), [tokens])`, keeping purely structural styles static.
  - Wrap heavy list rows in `React.memo`; pass tokens through hooks inside rows instead of props so list data identity stays stable.
- **Color animation:** keep the existing `Animated` interpolation for color changes but stop calling `setColors` on every frame for the whole tree (current implementation re-renders all 100 consumers per animation frame). Options: (a) animate only a full-screen overlay cross-fade snapshot, or (b) run the interpolation with Reanimated shared values for the root background only and switch tokens instantly. Proposed: (b) — instant token switch + a 200 ms root-background fade; respects Reduce Motion.
- **Typography:** a shared `AppText` component (RN docs' recommended pattern) reads `useType()` so font family/size/weight/line height/letter spacing change everywhere without touching every `Text`. `allowFontScaling` stays on; `maxFontSizeMultiplier` caps combined in-app × OS scale (proposed cap 2.0) to avoid layout breakage.
- **Native chrome:** on applied change, update `Appearance.setColorScheme`, `SystemUI.setBackgroundColorAsync`, status bar style and navigation bar color (already driven from `colors.bg` in `_layout.tsx`).
- **Fonts:** all font files are loaded at startup (or embedded via the `expo-font` plugin), so switching family is synchronous. Guard with `Font.isLoaded(name)`; fall back to IBM Plex Sans.
- **NativeWind kit:** if kept, feed colors via NativeWind CSS variables at the root so className-based components update too **[uncertain: verify NativeWind 4.2.7 `vars()` API]**.

---

## 11. Preview / Appearance screen design

Route proposal: `src/app/(shared)/appearance.tsx` or per-role settings entry replacing/augmenting `ThemeToggle` (routing location is an open question). Layout: sticky **preview card** at top (≈40 % height), scrollable **controls** below, docked **Cancel / Apply** bar.

Preview renders, using only `draft` tokens:

| Sample element | Demonstrates |
| --- | --- |
| Heading ("Lịch tập hôm nay") | display font choice, font scale, weight, letter spacing, textPrimary |
| Body paragraph (2–3 lines, Vietnamese with diacritics, e.g. "Võ sĩ cần nghỉ ngơi đầy đủ trước buổi đấu.") | body font, line height (diacritic clipping check), textPrimary on background |
| Caption / helper text | textTertiary contrast, small size at current scale |
| List item (avatar, title, subtitle, chevron) | surface, border/divider, textSecondary, density (row height/padding) |
| Card (title + stat) | surface vs background, corner radius, shadow |
| Primary button + secondary/outline button + disabled button | accent, onAccent, radius, disabled tokens, touch-target size under density |
| Text input (label, placeholder, value, error state) | controlBorder, placeholder (textTertiary), danger, focus ring |
| Switch (on/off) | accent track, surfaceMuted track |
| Dialog (small modal mock inline, not a real modal) | elevated surface, scrim over background, radius |
| Tab bar (3 tabs, one active) | accent vs textSecondary, surface, border |
| Status chips (success / danger) | successSurface/dangerSurface pairs |

Controls (grouped like Kindle's tabs): **Theme** (preset grid, brightness mode segmented control), **Text** (font list rendered in its own face, size slider with A/A buttons, weight segmented, line height slider, letter spacing slider), **Colors** (swatch rows for text/background/surface/accent + optional hex field + contrast badge per pair), **Layout** (radius segmented, density segmented), **Accessibility** (follow system text size, high contrast, motion). Footer: "Reset to preset".

All controls must have accessibility labels, 44 pt targets, and be usable with the preview visible (Apple Books pattern).

---

## 12. Candidate dependencies (for later approval — NOT installed)

Versions from `npm view` on 2026-09-29. Expo SDK 57 third-party docs list `@react-native-community/slider` and `@react-native-segmented-control/segmented-control` as supported libraries (install with `npx expo install` to get the SDK-pinned version).

| Package | Latest checked 2026-09-29 | License | Why | Needed? |
| --- | --- | --- | --- | --- |
| `@react-native-community/slider` | 5.2.1 | MIT | Size / line-height / letter-spacing sliders | Optional — could use +/− steppers instead (zero deps) |
| `@react-native-segmented-control/segmented-control` | 2.5.7 | MIT | Mode / weight / density / radius | Optional — custom Pressable segmented control is easy |
| `@expo-google-fonts/inter` | 0.4.2 | MIT AND OFL-1.1 | Font option | If approved |
| `@expo-google-fonts/be-vietnam-pro` | 0.4.1 | MIT AND OFL-1.1 | Font option | If approved |
| `@expo-google-fonts/noto-sans` | 0.4.2 | MIT AND OFL-1.1 | Font option | If approved |
| `@expo-google-fonts/literata` | 0.4.3 | MIT AND OFL-1.1 | Reading serif | If approved |
| `@expo-google-fonts/source-serif-4` | 0.4.1 | MIT AND OFL-1.1 | Reading serif | If approved |
| `@expo-google-fonts/merriweather` | 0.4.2 | MIT AND OFL-1.1 | Alternative serif | Optional |
| `@expo-google-fonts/lexend` | 0.4.1 | MIT AND OFL-1.1 | Dyslexia-friendly option | Recommended |
| `reanimated-color-picker` | 5.1.3 | MIT | Free color picker | Only if free colors approved; compatibility with Reanimated 4.5.1 **[uncertain]** |
| `react-native-mmkv` | 4.3.2 | MIT | Synchronous storage (would remove async hydrate) | Not recommended now — AsyncStorage + splash gate is enough; adds native module |
| `zod` | 4.6.5 | MIT | Schema validation | Not needed — hand-written validator is small |

OpenDyslexic: vendor OFL font files into `assets/fonts/` (no package) if approved — Vietnamese coverage **[uncertain]**.

---

## 13. Open questions (need your decision)

1. **NativeWind UI kit** (`components/ui/*`, `preview/*`, `tailwind.config.js`): is it being kept? If yes, should it follow the user theme (CSS variables) or be deleted with `DesignPreview` ("REMOVE AFTER REVIEW")? Should "UI Kit Dark" become a preset?
2. **Free color pickers vs curated swatches**: Kindle/Books offer only curated page colors. Allow free hex/picker (needs `reanimated-color-picker` or a custom HSL control) or swatches only?
3. **Accessibility baseline fix**: approve changing light `inkSubtle` `#7A7C84` → `#62646C` and `lotus` `#8F7040` → `#735A30` (both currently fail 4.5:1)?
4. **Font list**: approve the 7-font shortlist? Include OpenDyslexic (vendored, Vietnamese unverified) or Lexend only as the dyslexia-friendly option?
5. **Scope of font change**: body/UI only, or also headings (Barlow Condensed brand face)? The `displayFont` setting assumes users may optionally match body.
6. **Font size scale range**: 0.85–1.60 in-app, multiplied by OS text size with a combined cap of 2.0 — OK? Or should in-app scale replace OS scaling?
7. **Where does the Appearance screen live** in each role (fighter/coach/doctor/admin "Me" screens, auth shell)? Keep the quick `ThemeToggle` cycler as a shortcut?
8. **Apply with low contrast**: allow with confirmation (proposed) or block entirely below 4.5:1?
9. **Settings sync**: settings are device-local only. Should they ever sync to the user account? That would need a backend endpoint that **does not exist** in `nestjs-api` — not proposed; confirm local-only.
10. **Runtime network**: nothing in this plan needs network at runtime (fonts bundled, no remote loadAsync). Confirm no remote font catalog is wanted.
11. **Sliders/segmented controls**: add the two Expo-listed community packages, or build zero-dependency steppers/segmented controls?
12. **Figma**: workspace rules require previewing UI in Figma before implementing. Is there a Figma frame for the Appearance screen, or should one be created first?
13. **Splash/launch visuals** stay brand-fixed (black) regardless of theme — confirm.

---

## 14. Suggested implementation phases (for steps 2–3, not started)

1. Token layer + `AppearanceProvider` with alias layer for existing `colors.*` names; schema, validator, migration, bootstrap hydration; contrast utility + tests.
2. `AppText` + `useThemedStyles`; migrate `type.*` / `spacing.*` / `radius.*` consumers (71 / 45 / 25 files) and remove hardcoded `fontSize`/`lineHeight` overrides (admin-page, coach screens).
3. Appearance screen with draft/apply, preview, presets, unsaved-changes guard.
4. Fonts (after approval) + NativeWind decision.
5. QA: Vietnamese diacritics at max scale, OS text size extremes, true-black on OLED, reduce motion, corrupt-storage cases.

---

## 15. Sources

1. Expo SDK 57 — `expo-font`: https://docs.expo.dev/versions/v57.0.0/sdk/font/
2. Expo SDK 57 — `expo-system-ui`: https://docs.expo.dev/versions/v57.0.0/sdk/system-ui/
3. Expo SDK 57 — AsyncStorage: https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/
4. React Native — `Text` (allowFontScaling, maxFontSizeMultiplier, dynamicTypeRamp, style inheritance): https://reactnative.dev/docs/text
5. W3C — Understanding WCAG 2.2 SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
6. Android Developers — Material Design 3 in Compose (color scheme roles, type scale, shapes): https://developer.android.com/develop/ui/compose/designsystems/material3
7. Material Design 3 — color roles (page JS-rendered, content not retrieved): https://m3.material.io/styles/color/roles
8. Apple HIG — Typography (default/minimum sizes, text styles, Dynamic Type): https://developer.apple.com/design/human-interface-guidelines/typography
9. Apple WWDC24 — Get started with Dynamic Type: https://developer.apple.com/videos/play/wwdc2024/10074/
10. Apple WWDC20 — The details of UI typography: https://developer.apple.com/videos/play/wwdc2020/10175/
11. Apple Support — Read books in the Books app on iPhone (Themes & Settings): https://support.apple.com/en-ae/guide/iphone/iphc1af7c57/ios
12. iDownloadBlog — Apple Books themes and customization: https://www.idownloadblog.com/2022/09/21/how-to-use-themes-in-books-app-on-ipad-iphone/
13. Amazon — Customize Your Kindle E-Reader Text Display: https://www.amazon.com/gp/help/customer/display.html?nodeId=T5Y94BzSCGwm0vd75W
14. Amazon — Accessible Reading Options for Kindle Reading Apps: https://www.amazon.com.au/gp/help/customer/display.html?nodeId=TABlJ4ot69emTO8jJG
15. Notion Help — Style & customize your Notion page: https://www.notion.com/help/customize-and-style-your-content
16. Lexend — project site (reading-proficiency research): https://www.lexend.com/
17. OpenDyslexic — OFL license file: https://raw.githubusercontent.com/antijingoist/opendyslexic/master/OFL.txt
18. Google Fonts metadata (license + subsets), e.g. https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/METADATA.pb (same path pattern for `inter`, `literata`, `sourceserif4`, `notosans`, `bevietnampro`, `ibmplexsans`, `barlowcondensed`, `merriweather`, `atkinsonhyperlegible`, `atkinsonhyperlegiblenext`)
19. npm registry (`npm view <pkg> version license`, 2026-09-29): https://www.npmjs.com/package/@react-native-community/slider, https://www.npmjs.com/package/@react-native-segmented-control/segmented-control, https://www.npmjs.com/package/reanimated-color-picker, https://www.npmjs.com/package/react-native-mmkv, https://www.npmjs.com/package/zod, https://www.npmjs.com/package/@expo-google-fonts/lexend
