# Theme customization — progress

Plan: `docs/theme-customization-plan.md`. App: `reactnative-mobile/` (Expo SDK 57).

## Phase checklist

- [x] **Phase 0** — baseline, backup directory, plan check, font method (gate passed 2026-09-29)
- [ ] **Phase 1–2** — combined gap audit (plan vs existing uncommitted work). Status: **AUDIT RECORDED, REPAIRS NOT STARTED** (see "Phase 1–2 audit" below)
- [ ] **Phase 3** — visual QA
- [ ] **Phase 4** — presets

## Rules

- **The existing uncommitted theme work is the BASELINE. Do not redo it.** Later phases audit gaps against it and change only what is missing or wrong.
- **Git: no commits, stashes, resets, checkouts, rebases, merges, amends, pushes, or branch changes by agents.** Agents only run `git status` / `git diff` / `git log`. Suggested commit messages are written in this file; **the user commits**.
- Before a phase edits an existing file, copy it to `<backup-root>/phase-<N>/<relative path>` and record it in `phase-<N>/manifest.json` (see `RESTORE.md`).
- Secret/env files are never opened (paths listed below only).

## Backup directory

- Absolute path: `C:\Users\PHONG\Desktop\Coding_Proj\FPT\Semester_8\Mobile_WDP301\MMA-TMS-theme-backup\`
- **Outside the repo** (sibling of `MMA-TMS\`); `.gitignore` not touched.
- Writable: confirmed by writing `RESTORE.md` and reading it back (1,878 bytes, sha256 `F9DFF9151EB9AC9B7714F89C028691C5AB89984C029F74420CC1F5D1BF8BED2E`).
- Contents after Phase 0: `RESTORE.md` only. No `phase-0/` folder because Phase 0 changed no existing file.
- Contents after the Phase 1–2 audit: `RESTORE.md` + `phase-1-2/` (20 pre-edit snapshots + `manifest.json`).

## Baseline (captured 2026-09-29, before any phase edits)

- Branch: `feat/mobile-platform`. HEAD: `13e277c Merge pull request #14 from Dannguyen04/User_Feature`.
- State: **dirty**. `git status --porcelain -uall` = **110 entries**: 57 modified (all under `reactnative-mobile/`), 53 untracked files (all under `reactnative-mobile/`). The `nestjs-api/dist/*` untracked entries seen in an earlier snapshot are **no longer** reported (0 entries).
- `docs/` is gitignored (`.gitignore:78 docs`), so `docs/theme-customization-plan.md` and this file never show in `git status`.
- Env/secret files present (paths only, not opened): `.env`, `.env.example`, `nestjs-api/.env`, `nestjs-api/.env.example`, `nextjs-frontend/.env.local`, `nextjs-frontend/.env.local.example`, `python-worker/.env`, `python-worker/.env.example`, `reactnative-mobile/.env`, `reactnative-mobile/.env.local`, `reactnative-mobile/android/app/debug.keystore`, `reactnative-mobile/android/app/tms-upload.keystore` (plus vendored `cacert.pem` files inside `python-worker/.venv`).

### Theme-related paths (full)

Modified:

```
 M reactnative-mobile/package.json
 M reactnative-mobile/package-lock.json
 M reactnative-mobile/babel.config.js
 M reactnative-mobile/metro.config.js
 M reactnative-mobile/tsconfig.json
 M reactnative-mobile/src/app/_layout.tsx
 M reactnative-mobile/src/app/(admin)/quan-tri/cai-dat.tsx
 M reactnative-mobile/src/app/(fighter)/cai-dat.tsx
 M reactnative-mobile/src/components/auth/auth-shell.tsx
 M reactnative-mobile/src/screens/coach/me.tsx
 M reactnative-mobile/src/screens/doctor/me-screen.tsx
 M reactnative-mobile/src/theme/colors.ts
 M reactnative-mobile/src/theme/index.ts
 M reactnative-mobile/src/theme/theme-preference.tsx
 M reactnative-mobile/src/theme/typography.ts
```

Untracked:

```
?? reactnative-mobile/src/app/appearance.tsx
?? reactnative-mobile/src/components/appearance/appearance-link.tsx
?? reactnative-mobile/src/i18n/appearance.ts
?? reactnative-mobile/src/screens/appearance/appearance-preview.tsx
?? reactnative-mobile/src/screens/appearance/appearance-screen.tsx
?? reactnative-mobile/src/screens/appearance/controls.tsx
?? reactnative-mobile/src/theme/appearance/color-math.ts
?? reactnative-mobile/src/theme/appearance/fonts.ts
?? reactnative-mobile/src/theme/appearance/settings.ts
?? reactnative-mobile/src/theme/appearance/tokens.ts
?? reactnative-mobile/tailwind.config.js        (NativeWind UI kit — left untouched per plan §0.1)
?? reactnative-mobile/global.css                (NativeWind)
?? reactnative-mobile/nativewind-env.d.ts       (NativeWind)
?? reactnative-mobile/src/components/ui/*       (17 files, NativeWind UI kit — untouched per plan §0.1)
```

`package.json` diff: adds the six `@expo-google-fonts/*` packages (be-vietnam-pro, inter, lexend, literata, noto-sans, source-serif-4), plus non-theme additions `@expo/metro-runtime`, `moti`, `nativewind`, `tailwindcss` (dev), and moves `@types/react`.

### `git diff --stat` (full)

```
 reactnative-mobile/ANDROID-BUILD.md                |    2 +-
 reactnative-mobile/babel.config.js                 |    5 +-
 reactnative-mobile/metro.config.js                 |    3 +-
 reactnative-mobile/package-lock.json               | 1362 +++++++++++++++++++-
 reactnative-mobile/package.json                    |   12 +-
 reactnative-mobile/src/api/admissions.ts           |   11 +
 reactnative-mobile/src/api/dev-api-host.test.ts    |   12 +
 reactnative-mobile/src/api/dev-api-host.ts         |    9 +-
 .../src/app/(admin)/quan-tri/cai-dat.tsx           |    4 +-
 .../src/app/(admin)/quan-tri/mo-hinh.tsx           |    2 +-
 .../src/app/(admin)/quan-tri/nhat-ky.tsx           |    2 +-
 reactnative-mobile/src/app/(coach)/_layout.tsx     |   11 +-
 reactnative-mobile/src/app/(coach)/clearance.tsx   |    2 +-
 .../src/app/(doctor)/ai-alerts/index.tsx           |    4 +-
 .../src/app/(doctor)/clearance/index.tsx           |    2 +-
 .../src/app/(doctor)/examinations/new.tsx          |    2 +-
 .../src/app/(doctor)/injuries/new.tsx              |    2 +-
 reactnative-mobile/src/app/(fighter)/cai-dat.tsx   |    5 +
 .../src/app/(fighter)/hieu-suat/index.tsx          |    2 +-
 .../src/app/(fighter)/video/tai-len.tsx            |    4 +-
 .../src/app/(fighter)/video/truc-tiep.tsx          |    2 +-
 reactnative-mobile/src/app/_layout.tsx             |   45 +-
 .../src/auth/fighter-register-body.test.ts         |   23 +-
 .../src/auth/fighter-register-body.ts              |   22 +-
 reactnative-mobile/src/auth/register-steps.ts      |   48 +-
 .../src/components/auth/auth-shell.tsx             |    7 +
 .../src/components/auth/auth-text-field.tsx        |   89 +-
 .../src/components/medical/medical-format.ts       |    3 +
 reactnative-mobile/src/i18n/blocked.ts             |   44 +-
 reactnative-mobile/src/i18n/coach.ts               |    3 +-
 reactnative-mobile/src/i18n/doctor.ts              |    9 +-
 reactnative-mobile/src/i18n/fighter.ts             |    9 +-
 reactnative-mobile/src/i18n/medical.ts             |    2 +-
 reactnative-mobile/src/i18n/vi.ts                  |   43 +-
 .../src/screens/admin/admin-home.tsx               |  127 +-
 .../src/screens/admin/admin-page.tsx               |  129 +-
 .../src/screens/admissions/applicant-detail.tsx    |   90 +-
 .../src/screens/admissions/applicant-form.tsx      |  187 ++-
 .../src/screens/admissions/applicant-list.tsx      |  143 +-
 reactnative-mobile/src/screens/admissions/page.tsx |    9 +-
 .../src/screens/admissions/staff-detail.tsx        |  229 +++-
 .../src/screens/admissions/staff-list.tsx          |   15 +-
 .../src/screens/auth/register-steps.test.ts        |   53 +-
 .../src/screens/auth/register.test.tsx             |  274 +---
 reactnative-mobile/src/screens/auth/register.tsx   |  400 +-----
 .../src/screens/coach/fighter-detail.tsx           |  272 ++--
 reactnative-mobile/src/screens/coach/me.tsx        |    4 +
 .../src/screens/doctor/me-screen.tsx               |    2 +
 .../src/screens/doctor/medical-screen.tsx          |  226 +++-
 .../src/screens/fighter/home-screen.tsx            |  279 ++--
 .../src/screens/parity/blocked-workspace.tsx       |    2 +-
 reactnative-mobile/src/session/role-gate.tsx       |   10 +-
 reactnative-mobile/src/theme/colors.ts             |   11 +-
 reactnative-mobile/src/theme/index.ts              |   22 +-
 reactnative-mobile/src/theme/theme-preference.tsx  |  376 +++++-
 reactnative-mobile/src/theme/typography.ts         |  143 +-
 reactnative-mobile/tsconfig.json                   |   14 +-
 57 files changed, 3397 insertions(+), 1427 deletions(-)
```

The other 23 untracked non-theme files (admissions, visuals, mocks, preview, countries, admin-applications, coach `danh-gia/_layout.tsx`, `app/preview.tsx`) are omitted from the theme list above; they appear in the 53-file untracked count.

## Plan check — "Draft vs Applied"

- **Already present:** `docs/theme-customization-plan.md` has `## 9. Draft vs Applied state` (states + transition table) and `## 10. Real-time propagation`. §0.8 adds that the quick `ThemeToggle` writes `applied.mode` directly with no draft.
- **Plan was NOT edited.** No `phase-0/` backup was needed. Plan evidence: 49,755 bytes, sha256 `B0E55014E69F76C67D791554680A10DABAEC962B76C1746A3A8CF7B666B22C28` (unchanged).
- Wording differences vs the orchestrator rules, for the Phase 1–2 audit to check against code (not audited in Phase 0):
  - The plan calls the preview subtree provider `ThemeScope`; the orchestrator rules call it `ThemePreviewProvider`.
  - The plan does not name `setDraft` / `applyDraft` / `discardDraft`. It says the Appearance screen owns `draft` via a local `useReducer`, while the rules imply provider-level actions.
  - "System brightness follows OS" is stated in §2.1/§4 (`mode: "system"`, `Appearance` listener), not in §9.
  - §8 says Apply is blocked below 3:1, but §0.9 overrides this: Apply is allowed after one extra confirmation. §0 wins.

## Font method

- **Existing work uses:** `@expo-google-fonts/*` npm packages, imported through **per-weight subpaths** (e.g. `@expo-google-fonts/inter/400Regular`), whose TTFs are bundled via `require()`. They are loaded at runtime with `Font.loadAsync` in `reactnative-mobile/src/theme/appearance/fonts.ts`:
  - `loadCoreFonts()` loads Barlow Condensed 600/700/800/900 + IBM Plex Sans 400/500/600/700 before the splash hides.
  - `loadFamily(id)` loads a body family on demand, guarded by `Font.isLoaded`.
  - There are no vendored TTF/OTF files under `reactnative-mobile/assets/`.
- **Why:** it works with the already-installed `expo-font ~57.0.4` and needs no prebuild. It stays offline because only local `require` assets are used and the code comment forbids remote URIs. Per-weight subpaths avoid bundling every weight of each package.
- **Doc:** https://docs.expo.dev/versions/v57.0.0/sdk/font/ (fetched 2026-09-29). It describes two paths: the config plugin, which embeds fonts at build time and needs prebuild (the docs recommend it for Android/iOS), and runtime `useFonts`/`loadAsync`, which works on all platforms.
- **`app.json`:** lists `"expo-font"` in `plugins` with **no `fonts` option** (this entry already existed in HEAD; `app.json` is unmodified), so nothing is embedded at build time.
- **Native build required: NO.** The added `@expo-google-fonts/*` packages are JS + TTF assets only, and `expo-font` was already in the native build.
  - Unrelated to fonts: `nativewind`/`moti` were also added in the baseline. They are outside this phase's scope.
- **Measured bytes** (from `reactnative-mobile/node_modules/@expo-google-fonts/*/<weight>/*.ttf`, the 20 files referenced by `fonts.ts`):

| Family | Weights | Bytes |
| --- | --- | --- |
| Barlow Condensed | 600/700/800/900 | 418,332 |
| IBM Plex Sans | 400/500/600/700 | 872,964 |
| Inter | 400/700 | 686,480 |
| Be Vietnam Pro | 400/700 | 270,672 |
| Noto Sans | 400/700 | 1,259,992 |
| Literata | 400/700 | 516,136 |
| Source Serif 4 | 400/700 | 660,156 |
| Lexend | 400/700 | 156,984 |
| **Total** | 20 files | **4,841,716 B (≈ 4.84 MB)** |

This matches the plan's Gate B figure exactly and is under the 6 MB cap. No packages were installed and no fonts were changed.

## Files changed in Phase 0

- Created `docs/theme-progress.md` (this file; gitignored via `docs`).
- Created `C:\Users\PHONG\Desktop\Coding_Proj\FPT\Semester_8\Mobile_WDP301\MMA-TMS-theme-backup\RESTORE.md` (outside the repo).
- No source, config, dependency, or plan file was modified.

## Suggested commit message (user commits)

Phase 0 touched no tracked files (`docs/` is gitignored), so there is nothing to commit for this phase. If you un-ignore `docs/` later:

```
docs(mobile): add theme customization progress tracker (phase 0 baseline)
```

## Decisions

- The backup root is outside the repo, so no `.gitignore` change is needed.
- The plan already has Draft vs Applied (§9) and real-time propagation (§10), so it was left untouched.
- The font method stays as-is: runtime `loadAsync` from bundled `@expo-google-fonts` per-weight assets, with no native rebuild.

## Open questions

1. Should `docs/` stay gitignored? If so, the plan and this tracker live only on this machine.
2. Naming for the preview provider and draft actions: keep the plan's `ThemeScope` + screen-local reducer, or adopt `ThemePreviewProvider` + `setDraft`/`applyDraft`/`discardDraft`? The Phase 1–2 audit should report what the code actually uses before any rename.
3. The `app.json` `"expo-font"` plugin entry has no options. Keep it (harmless) or remove it? Removing it is a config change and is out of scope unless requested.

## Phase 1–2 audit (recorded 2026-09-29)

**Status: AUDIT RECORDED, REPAIRS NOT STARTED.** Phase 1–2 is not ticked.

Sources (read-only audits): `docs/theme-audit/engine.md` (01898f05), `docs/theme-audit/fonts.md` (dc61e3ed), `docs/theme-audit/screens.md` (a42ca524). Every FAIL citation was spot-checked against the current code. Paths below are relative to `reactnative-mobile/src/` unless they start with `docs/` or `reactnative-mobile/`.

Totals: engine 7 PASS / 3 FAIL / 1 UNVERIFIED; fonts 6 PASS / 4 FAIL; screens 10 PASS / 7 FAIL / 1 UNVERIFIED. Overall **23 PASS, 14 FAIL, 2 UNVERIFIED** (39 items).

Owner codes: **ORCH** = orchestrator (sole owner of `theme/theme-preference.tsx`, `theme/typography.ts`, `theme/index.ts`, `i18n/appearance.ts`, `app/_layout.tsx`, `app/appearance.tsx`, `reactnative-mobile/package.json`); **A** = repair agent A (fonts); **B** = repair agent B (Appearance editor); **C** = repair agent C (tokens + entry points); **MIG** = later migration round (not the first repair round); **QA** = device check (Phase 3); **—** = no repair.

| Area | # | Item | Result | Evidence | Repair owner |
| --- | --- | --- | --- | --- | --- |
| Engine | 1 | Draft/applied separation; editing the draft writes nothing | PASS | `screens/appearance/appearance-screen.tsx:86`, `:157-198`; `theme/appearance/settings.ts:312-314` | — |
| Engine | 2 | Preview provider isolation (`ThemeScope`), no remount | PASS | `theme/theme-preference.tsx:427-445`; `appearance-screen.tsx:129-144` | — |
| Engine | 3 | Apply reaches every mounted screen (density, radius, typography) | **FAIL** | Screens read module `spacing`/`radius` in `StyleSheet.create` (`appearance-screen.tsx:573-650`); typography via module global mutated during render (`theme/theme-preference.tsx:363-367`, `theme/typography.ts:118-120`) | ORCH (engine propagation) + MIG (fixed-value screens) |
| Engine | 4 | Undo snackbar (8 s) restores previous applied | **FAIL** | No snackbar/8 s timer; Undo is a header icon (`appearance-screen.tsx:182-193`, `:276-285`); `undoLastApply` swaps current/previous (`theme/theme-preference.tsx:273-278`) | ORCH (undo semantics, app-level mount) + B (snackbar UI, new file) |
| Engine | 5 | Brightness "system" follows the OS live | PASS | `theme/theme-preference.tsx:177-182`, `:163-166`; `theme/appearance/tokens.ts:30-38` | — (test suite blocked by `jest.setup.ts`) |
| Engine | 6 | Quick light/dark toggle writes applied directly | PASS | `components/auth/theme-toggle.tsx:35-42` → `theme/theme-preference.tsx:257-271`, `:280` | — |
| Engine | 7 | Memoized tokens and selective subscriptions | **FAIL** | `setColors` on every fade frame (`theme/theme-preference.tsx:329-331`); legacy context mixes colors + typography (`:401-404`); split hooks used only by the preview | ORCH |
| Engine | 8 | Font scale 0.85–1.6 × OS, total capped at 2.0 | PASS | `theme/appearance/settings.ts:60`, `:66`; `theme/appearance/tokens.ts:176-178` | — |
| Engine | 9 | Versioned schema, migration, per-field fallback, one key | PASS | `theme/appearance/settings.ts:5`, `:208-233`, `:247-290` | — |
| Engine | 10 | No theme flash on cold start | UNVERIFIED | Gating: `app/_layout.tsx:90-93`; `theme/theme-preference.tsx:198-206`, `:282-296`. Needs a device screen recording | QA |
| Engine | 11 | Splash gated on saved theme + applied font | PASS | `app/_layout.tsx:22`, `:90-97`; `theme/theme-preference.tsx:188-206` | — |
| Fonts | 1 | Lazy registration (only applied font + Barlow at start) | **FAIL** | Eager loop over every body family after splash: `theme/theme-preference.tsx:208-215` | ORCH (provider loop) + A (`fonts.ts` load API) |
| Fonts | 2 | Selection/apply awaits registration | **FAIL** | Draft set before load: `appearance-screen.tsx:375`, effect `:97-107`; Apply commits then loads: `theme/theme-preference.tsx:234`, `:240-244` | B (picker) + ORCH (`commit`) |
| Fonts | 3 | Fallback with non-blocking "font unavailable" flag | **FAIL** | Result dropped at `appearance-screen.tsx:101`, `theme/theme-preference.tsx:213`, `:241`; no font field in `AppearanceState` (`:380-391`); no string in `i18n/appearance.ts` | A (failure tracking in `fonts.ts`) + ORCH (state, i18n) + B (show flag) |
| Fonts | 4 | No synthesized weights | **FAIL** | `fontWeight: "700"` on the regular face: `components/visuals/charts.tsx:225` + `:378`; `components/visuals/sessions.tsx:174-180` + `:219` | A |
| Fonts | 5 | No network access for fonts | PASS | `theme/appearance/fonts.ts:1-20`, `:126`, `:135` | — |
| Fonts | 6 | OFL-1.1 for every bundled family | PASS | `node_modules/@expo-google-fonts/*/LICENSE_FONT` line 9 (per `docs/theme-audit/fonts.md` Item 6) | — |
| Fonts | 7 | ≤ 10 families (8 bundled) | PASS | `theme/appearance/settings.ts:13-20`, `:44-52`; `theme/appearance/fonts.ts:48-116` | — |
| Fonts | 8 | Total size ≤ 6 MB (4,841,716 B = 4.84 MB) | PASS | Byte table in `docs/theme-audit/fonts.md` Item 8 | — |
| Fonts | 9 | Vietnamese glyph coverage | PASS (cmap) | 134 code points, 0 missing in all 20 TTFs (`docs/theme-audit/fonts.md` Item 9). Rendered look still needs a screenshot | QA (screenshot) |
| Fonts | 10 | Headings stay Barlow Condensed | PASS | `theme/typography.ts:87-96`, `:123-179` | — |
| Screens | 1 | Preset picker | PASS | `appearance-screen.tsx:318-340`, `:177-180` | — |
| Screens | 2 | Brightness, family, size, weight, line height, letter spacing | PASS | `appearance-screen.tsx:341-435` | — |
| Screens | 3 | Color roles: swatches + hex + self-written picker | PASS | `appearance-screen.tsx:438-456`; `screens/appearance/controls.tsx:197-392` | — |
| Screens | 4 | Radius and density controls (editor) | PASS | `appearance-screen.tsx:460-473` (real screens ignore them: Engine 3) | — |
| Screens | 5 | Compact live preview pinned at top | PASS | `appearance-screen.tsx:297-309`, `:257` | — |
| Screens | 6 | Apply, Cancel, Reset to default + Reset this section, with confirmation | **FAIL** | Reset to default has no confirmation (`appearance-screen.tsx:286-294`, `:195-198`); no per-section reset (`Section` at `:517-527`) | B (+ ORCH for new strings) |
| Screens | 7 | Every color change goes through a contrast check | PASS | `appearance-screen.tsx:145-148`; `theme/appearance/tokens.ts:249-280` | — |
| Screens | 8 | Full Preview screen inside a draft provider | **FAIL** | No route or screen; routes at `app/_layout.tsx:70-79`; `screens/appearance/` has only 3 files | B (new screen file) + ORCH (route registration) |
| Screens | 9 | Everything outside the preview stays applied until Apply | PASS | `appearance-screen.tsx:78`; `theme/theme-preference.tsx:427-445` | — |
| Screens | 10 | "Back to edit" keeps draft; Cancel discards | **FAIL** | No Full Preview, so no "Back to edit" (Cancel part passes) | B |
| Screens | 11 | Preview-only light/dark toggle | **FAIL** | Only control writes `draft.settings.mode` (`appearance-screen.tsx:342-347`) | B |
| Screens | 12 | Unsaved dialog: Save / Discard / Keep editing on back, gesture, tab switch | **FAIL** | Only Keep editing + Discard (`appearance-screen.tsx:109-127`; `i18n/appearance.ts:105-110`); no tab-switch handler | B (+ ORCH for "Save" string) |
| Screens | 13 | Contrast warning, one-tap fix, extra confirmation below 3:1 | PASS | `appearance-screen.tsx:208-241`, `:534-571` | — |
| Screens | 14 | Undo and Reset always reachable | PASS | `appearance-screen.tsx:261-295` | — |
| Screens | 15 | Single Appearance entry point for every role | **FAIL** | Guest has none: `app/(guest)/_layout.tsx:1-11`; guest links live in `screens/admissions/applicant-list.tsx:105-121` (`showSubmit`) | C |
| Screens | 16 | Light-mode contrast fixes (`inkSubtle` #7A7C84 → #62646C, `lotus` #8F7040 → #735A30) | PASS | `theme/colors.ts:32`, `:36` (ring stays #8F7040 at `:39`) | — |
| Screens | 17 | Labels, 44 pt targets, usability at maximum text scale | UNVERIFIED | Labels and 44 pt minimums exist in code (`appearance-screen.tsx:584-643`; `screens/appearance/controls.tsx:405-463`); max text scale needs a device | QA |
| Screens | 18 | No remaining hardcoded colors / font sizes | **FAIL** | Splash files are brand-fixed on purpose; worst real screen `screens/admin/admin-page.tsx:15-29`, `:131` | MIG (not the first round) |

### Citation spot-check

All FAIL citations match the code except these two line drifts (neither changes a result):

- `docs/theme-audit/screens.md` places `<DesignPreview />` at `app/_layout.tsx:116`; it is on line **115** (116 is `</SessionProvider>`). `docs/theme-audit/engine.md` has it right.
- `docs/theme-audit/engine.md` item 1 cites `useThemePreference` at `appearance-screen.tsx:79`; it is on line **78**.

### Question for the user: `DesignPreview`

`components/ui/DesignPreview.tsx` is mounted for **every user** from `app/_layout.tsx:9` (import) and `:115` (render), with no `__DEV__` guard, and starts visible (`DesignPreview.tsx:335`, `useState(true)`). It is marked "REMOVE AFTER REVIEW". It was **not** removed in this step: Override 1 says to leave the NativeWind kit untouched. Should the root layout stop mounting it (or gate it behind `__DEV__`)? Only the orchestrator may touch `app/_layout.tsx`.

### Phase 1–2 backups

- 20 pre-edit snapshots in `MMA-TMS-theme-backup\phase-1-2\` (150,953 bytes), recorded in `phase-1-2\manifest.json`. All 20 re-hashed against the originals: match. No new source files created yet.
- `admin-page.tsx` and the mass-migration set are **not** backed up yet (later round).
- Guest entry file: `reactnative-mobile/src/screens/admissions/applicant-list.tsx` (guest-only header links under `showSubmit`), rendered by `reactnative-mobile/src/app/(guest)/ho-so/index.tsx`. The same screen is reused by the fighter route `app/(fighter)/ho-so-cua-toi/index.tsx` without `showSubmit`, so a guest-only link must stay inside the `showSubmit` branch.

### First repair round — exclusive file ownership

| Owner | Files (existing) |
| --- | --- |
| ORCH | `theme/theme-preference.tsx`, `theme/typography.ts`, `theme/index.ts`, `i18n/appearance.ts`, `app/_layout.tsx`, `app/appearance.tsx`, `reactnative-mobile/package.json` |
| A (fonts) | `theme/appearance/fonts.ts`, `components/visuals/charts.tsx`, `components/visuals/sessions.tsx` |
| B (editor) | `screens/appearance/appearance-screen.tsx`, `screens/appearance/appearance-preview.tsx`, `screens/appearance/controls.tsx` (+ any new files under `screens/appearance/`) |
| C (tokens + entry) | `theme/appearance/tokens.ts`, `theme/appearance/settings.ts`, `theme/appearance/color-math.ts`, `components/appearance/appearance-link.tsx`, `screens/admissions/applicant-list.tsx`, `app/(guest)/ho-so/index.tsx` |

## Suggested commit message (Phase 1–2 audit, user commits)

`docs/` is gitignored, so this step changes no tracked file. If you un-ignore `docs/` later:

```
Record theme gap audit and phase 1-2 backups.
```

## Phase 1–2 integration of repairs A/B/C (2026-09-29)

**Phase 1–2 is still NOT ticked.** The FAILs listed under "Still open" below remain.

Checks made before editing (read from code, not from the repair reports):

- `theme/theme-preference.tsx`: `registerFont(id): Promise<boolean>` sets `fontUnavailable` on failure and loads the default family as a fallback; `applyAppearance` / `undoLastApply` return `Promise<void>`; `undoLastApply` clears `previousRef` before committing, so a second press does nothing; colors are published once per palette change.
- `appearance-screen.tsx` matched the expected post-repair sha256 `BDEF8D7E…36371FE`, so it was edited.

Changes:

- `i18n/appearance.ts`: added the 19 keys from `appearance-strings.ts` at the top level of `appearance`, with the same names and Vietnamese copy.
- `screens/appearance/appearance-screen.tsx`:
  - Now reads every label from `@/i18n/appearance`.
  - Font selection, preset pick, full reset and "reset Text section" now await the provider's `registerFont`, not `loadFamily`, so a failure sets `fontUnavailable`. The font id enters the draft only when the load succeeds; on failure the previous font stays and the inline notice shows.
  - The Undo call sites (header undo when the draft history is empty, and the snackbar) call `undoLastApply` once each; the snackbar clears its ref first. They were already one-shot-safe; they are now marked `void` because the call returns a Promise. `applyAppearance` is marked the same way.
- `screens/appearance/appearance-strings.ts`: **not deleted**. `screens/appearance/full-preview.tsx` still imports `appearanceExtra`, and that import was outside this integration's edit scope. The file is now a single re-export (`appearance as appearanceExtra`), so the copy exists only in `i18n/appearance.ts`. To finish: switch `full-preview.tsx` to `appearance` from `@/i18n/appearance`, then delete `appearance-strings.ts`.
- Quick light/dark toggle (`setMode`) and the Full Preview's preview-only toggle were not touched.

Full Preview route: **skipped**. No layout edit would be needed, because the root `Stack` in `app/_layout.tsx` is file-based and auto-registers extra files. The blocker is data flow. The draft lives in `AppearanceScreen` local state, and `FullPreview` needs `draft`, `canApply`, `onApply` (with the severe-contrast confirmation), `onBackToEdit` and `onCancel`. A route file that only re-exports `FullPreview` would render with none of these. Making a real route work would need either the draft serialized into route params (plus validation and a copy of the apply/confirm path in the route) or a new shared draft store. Both go beyond a re-export plus a tiny prop change. The in-editor Full Preview (local `fullPreview` state; hardware back returns to the editor through `beforeRemove`) is unchanged and still works.

Tab-switch unsaved guard: **covered by the existing listener, so no role layout was edited.** `AppearanceLink` pushes `/appearance` onto the root `Stack`, above the `(fighter)` / `(coach)` / `(doctor)` / `(admin)` / `(guest)` groups, so no tab bar is visible or touchable while Appearance is open. Leaving by any route (back, gesture, Android back, or a programmatic navigate/replace to a tab) removes the Appearance route and fires the screen's existing `beforeRemove` handler, which shows Save / Discard / Keep editing. UNVERIFIED on device, including a forced session redirect while Appearance is open.

### Files changed in this integration

- `reactnative-mobile/src/i18n/appearance.ts` (manifest original matched; targeted insert)
- `reactnative-mobile/src/screens/appearance/appearance-screen.tsx` (rev2 copy taken)
- `reactnative-mobile/src/screens/appearance/appearance-strings.ts` (rev2 copy taken; reduced to a re-export, not removed)
- `docs/theme-progress.md` (rev2 copy taken; this section)
- Backup `phase-1-2/manifest.json`: new `rev2` array with 3 entries, plus backfilled `existed:false` entries for `full-preview.tsx` and `appearance-strings.ts` (created by repair B). `RESTORE.md` lives at the backup root and was not changed.
- Created then removed: none.

### Type check (`npx tsc --noEmit` in `reactnative-mobile/`, after the edits)

Exit code 2, **525 errors**, all pre-existing and none in files touched by the theme repairs (0 hits for `appearance`, `i18n`, `theme-preference.tsx`, `charts`, `sessions`, `applicant-list`).

- 480 in `*.test.ts(x)` files: missing Jest globals such as `describe`, `it` and `expect`.
- 19 in `jest.setup.ts`: `jest.Mock` not exported.
- 26 in non-test app files outside theme scope: `components/auth/auth-shell.tsx` (6, `measureInWindow`/ref typing), `components/auth/auth-text-field.tsx` (1), `components/launch/launch-gate.tsx` (1), `mma-splash.tsx` (10), `splash-glass-shatter.tsx` (5), `splash-hud-overlay.tsx` (1), `splash-video-player.tsx` (2). Most of the launch errors are `StyleSheet.absoluteFillObject`.

Jest was not run: the suite is blocked by the pre-existing `jest.setup.ts` NativeWind mock.

### Still open (Phase 1–2 FAIL / UNVERIFIED)

- FAIL: Full Preview as a separate route (skipped for the reason above; the in-editor Full Preview satisfies the draft `ThemeScope` behaviour).
- FAIL: density, radius and typography are still not applied on screens that use fixed `StyleSheet`s. Migration has not started; `screens/admin/admin-page.tsx` is the worst real file. Splash files stay brand-fixed on purpose.
- FAIL: `DesignPreview` is still mounted for every user from `app/_layout.tsx` (waiting on the user's decision).
- UNVERIFIED: cold-start theme flash, usability at maximum text scale, and rendered Vietnamese glyphs (cmap check passed; no screenshot yet).
- UNVERIFIED: tab-switch and redirect behaviour of the unsaved guard on a device.
- BLOCKED: the Jest suite, by the pre-existing `jest.setup.ts` NativeWind mock.
- Cleanup: switch `full-preview.tsx` to `@/i18n/appearance`, then delete `appearance-strings.ts`.

### Suggested commit message (user commits)

```
feat(mobile): integrate appearance repairs

Move Appearance editor strings into i18n/appearance, await the provider's
registerFont before a font enters the draft so failures set fontUnavailable,
and keep undo/apply call sites one-shot.
```

## Admin screens migration (2026-09-29, owner: admin-migration)

**Phase 1–2 is still NOT ticked.** Scope: `reactnative-mobile/src/screens/admin/` only.

Files changed (backups in `phase-1-2/`, all three re-hashed: match; manifest updated):

- `screens/admin/admin-page.tsx`: new `useAdminType()` hook. It returns the `adminType` roles under the applied typography from `useTypography()`: content roles use the applied body face (`faces[slot]`, or `bold` when bold is on), `sizeFactor`, line height (floored by `viLineHeight`) and letter spacing; `body` is `contentTextStyle("body")`. `screenTitle` and `status` keep Barlow Condensed (`fonts.display`) and follow only the scale, like `titleTextStyle`. `AdminShell`, `AdminBlockedNotice`, `AdminLink` use it. The back label's `fontSize: 16` override is gone; it now uses the live `body` size with the `metaStrong` face (this also fixes its line height, which was below `viLineHeight(16)`).
- `screens/admin/admin-home.tsx`, `screens/admin/admin-applications.tsx`: every `adminType.*` read (8 + 14) now comes from `useAdminType()` in the component that renders it.
- `docs/theme-progress.md`: this note (copy taken as `.rev3` because `.rev2` already existed).

Counts in `src/screens/admin/` (before → after):

- Hex/rgb colors: 0 → 0. All colors already came from `useThemePreference().colors`; nothing to migrate.
- Static `adminType.*` style reads in rendered text: 29 → 0.
- Raw `fontSize` literals: 9 → 8. The 8 left are the base scale inside the exported `adminType` constant (34/24/18/17/16/14/14/30); the hook scales them. The constant stays because `screens/admissions/staff-detail.tsx` (out of scope) imports it and so still renders fixed sizes.
- Fixed `fontFamily` values: 8 → 8, same constant. Admin screens no longer read them directly; only headings keep `fonts.display` through the hook.

Left on purpose (no existing token, none invented):

- Raw layout values: `gap: 6` (status mark), `gap: 2` (back button, fact, group head), `borderRadius: 2` (list status bar), `marginLeft: 38` (tool-list rule), plus fixed `minHeight`/`width` sizes and icon `size` props.
- Module `spacing.*` / `radius.*` inside `StyleSheet.create` are tokens but static snapshots, so density and radius settings still do not reach admin screens. Switching them to `useLayoutTokens()` is a layout restyle and was not done (Engine item 3 stays open).
- No fixed brand color in admin files.

Checks: `ReadLints` on `src/screens/admin`: no errors. `npx tsc --noEmit`: 0 errors in `screens/admin/*`, `staff-detail.tsx` or `app/(admin)/quan-tri/*` (the pre-existing errors elsewhere are unchanged in kind). Jest and the dev server were not run.

Follow-up: switch `staff-detail.tsx` to `useAdminType()`, then drop the `adminType` export's direct use.

### Suggested commit message (user commits)

```
feat(mobile): scale admin text with applied typography

Add useAdminType() so admin screens take the applied body font, size
factor, line height and letter spacing; headings keep Barlow Condensed.
```

Type migration: staff-detail.tsx now uses useAdminType() instead of the fixed adminType. fighter/tab-bar.tsx label size scales with useTypography() on an 11pt base, with no change at the default setting. Left open: the sessions-screen chip borderRadius 999 and fixed lineHeight 16, and the fixed radius.* in coach-ui, fighter/screen and exercise-screens. Backups: 2 files, both hashes verified. Suggested commit message: feat(mobile): follow applied type on staff detail and fighter tabs.

## Medical type migration
Changed: screens/doctor/doctor-chrome.tsx (wordmark stays Barlow Condensed, size 22 scales with useTypography, default still 22) and screens/doctor/medical-screen.tsx (weight field uses contentTextStyle body, default size still 16). Other doctor, medical, and components/medical text files already used live type styles and were not edited. Left fixed line heights in medical-ui.tsx and medical-dossier-view.tsx. Left fixed radius on doctor-chrome, medical-screen, and medical-ui. Backups matched. Lint clean on the two edited files. Type check, Jest, and the app were not run.

## Phase 1-2 repair loop STOP
Named screen directories (admin, admissions staff-detail, coach, fighter, doctor/medical) have been migrated for font family and font size, or already used live text styles. Phase 1-2 is NOT ticked.

Still FAIL, not accepted by the user:
- Density and corner radius do not update existing screens. Three passes refused to rewire StyleSheet radius/spacing onto layout tokens because that would change layout. Needs a user decision before another attempt.

Still UNVERIFIED (device):
- Cold start has no theme flash.
- Usable at maximum text scale.
- Vietnamese glyphs render (cmap check passed; no screenshot).
- Leaving Appearance via the tab bar shows Save / Discard / Keep editing (code says the screen sits above the tabs).

Blocked on pre-existing project errors, not this theme work:
- npx tsc --noEmit exit 2, 525 errors, none in the theme files touched by these repairs.
- Jest fails in jest.setup.ts before any test (NativeWind mock).

Waiting on the user, do not change:
- DesignPreview is still mounted for every user from app/_layout.tsx.

Do not start Phase 3.
