# Font audit (read-only gap audit)

Date: 2026-09-29. App: `reactnative-mobile/` (Expo SDK 57, `expo-font ~57.0.4`).
Scope: the font contract (Overrides 5 and 10) checked against the existing uncommitted theme work. No source files were changed. The only file written is this report.

Sources read: `docs/theme-customization-plan.md` (§0 Gates A–C and items 4, 5, 7, 10, 11; §3.1 shortlist), `docs/theme-progress.md` (Font method section), `src/theme/appearance/fonts.ts`, `src/theme/appearance/settings.ts`, `src/theme/appearance/tokens.ts`, `src/theme/typography.ts`, `src/theme/theme-preference.tsx`, `src/screens/appearance/appearance-screen.tsx`, and the `LICENSE` / `LICENSE_FONT` / `package.json` / `<weight>/index.js` files of each `@expo-google-fonts/*` package.

## Summary

| Result | Count | Items |
| --- | --- | --- |
| PASS | 6 | 5, 6, 7, 8, 9, 10 |
| FAIL | 4 | 1, 2, 3, 4 |
| UNVERIFIED | 0 | (item 9 has one unverified sub-check: on-device rendering, no screenshot) |

- **Bundled bytes:** 4,841,716 B = 4.842 MB (10^6) / 4.617 MiB. This is under the 6 MB cap.
- **Families (8 of max 10):** Barlow Condensed (headings/brand), IBM Plex Sans (default body), Inter, Be Vietnam Pro, Noto Sans, Literata, Source Serif 4, Lexend. OpenDyslexic is not included.
- **Method:** matches https://docs.expo.dev/versions/v57.0.0/sdk/font/. The code calls runtime `Font.loadAsync({ name: require(ttf) })` and `Font.isLoaded(name)` with local bundled `require()` assets only. The `expo-font` config plugin is listed in `app.json:53` with no `fonts` option, so nothing is embedded at build time and no prebuild is needed.

### FAIL list

1. **Item 1: all families are loaded eagerly.** `src/theme/theme-preference.tsx:208-215` loops over every `FONT_FAMILY_IDS` entry and calls `loadFamily` right after the splash gate, whether or not the picker was opened.
2. **Item 2: the draft changes before the font is registered.** `src/screens/appearance/appearance-screen.tsx:375` sets `update({ fontFamily: id })` synchronously. Registration starts afterward in the effect at `appearance-screen.tsx:97-107`. The same pattern applies to Apply: `theme-preference.tsx:234,240-244` commits first and loads the font second.
3. **Item 3: there is no "font unavailable" flag.** A `loadFamily` failure returns `false` and every caller drops it: `appearance-screen.tsx:101`, `theme-preference.tsx:213`, `theme-preference.tsx:241`. `AppearanceState` (`theme-preference.tsx:380-391`) has no font field, and no "unavailable" string exists in `src/i18n/appearance.ts`. The silent fallback itself works (`tokens.ts:176`).
4. **Item 4: two call sites synthesize a weight.** `src/components/visuals/charts.tsx:225` + `:378` and `src/components/visuals/sessions.tsx:175-179` + `:219` add `fontWeight: "700"` on top of `type.caption`, whose `fontFamily` is the **regular** face of the selected body family. The platform then fakes bold instead of using the bundled Bold face.

---

## Item 1 — Lazy registration: **FAIL**

Required: at start, only the applied font and Barlow are registered. Other fonts register when the picker opens or a font is selected.

- The startup part is correct. `theme-preference.tsx:192-196` awaits `Promise.all([loadCoreFonts(), loadFamily(next.settings.fontFamily)])` with a 4 s timeout. `CORE_FONT_SOURCES` (`fonts.ts:110-116`) is Barlow Condensed 600/700/800/900 plus IBM Plex Sans 400/500/600/700. IBM Plex is always loaded as well, because it is the fallback body font and is hard-wired in brand styles (`typography.ts:146,168,175` use `fonts.uiMedium`). That is reasonable, but the contract should say so.
- **Violation:** right after `setReady(true)`, the provider loads every remaining family:

```208:215:reactnative-mobile/src/theme/theme-preference.tsx
      // Remaining body families load after the splash gate; the Appearance
      // screen also loads a family on demand before previewing it.
      for (const id of FONT_FAMILY_IDS) {
        if (cancelled) return;
        if (isFamilyLoaded(id)) continue;
        const ok = await loadFamily(id);
        if (ok && !cancelled) setFontEpoch((n) => n + 1);
      }
```

- The on-demand path exists (`appearance-screen.tsx:97-107`), but the eager loop above makes it redundant. The picker also has no "load on open" behavior. It renders unloaded rows in the default face (`appearance-screen.tsx:368`), and those rows only switch after the eager loop reaches them.

## Item 2 — Selection awaits registration before applying to draft: **FAIL**

- `appearance-screen.tsx:375`: `onPress={() => update({ fontFamily: id })}` writes the draft immediately.
- `appearance-screen.tsx:97-107`: an effect keyed on `draft.settings.fontFamily` calls `loadFamily(family)` after the draft already changed and bumps `fontTick` when it resolves.
- While the load runs, `familyAvailable` is `false` (`appearance-screen.tsx:139`). `buildTypography` then renders the preview in IBM Plex Sans (`tokens.ts:176`). The radio shows the new family selected while the preview shows the old face, which flips once loading finishes.
- Applied path: `commit()` calls `setApplied(next)` (`theme-preference.tsx:234`) and only then starts `loadFamily` (`theme-preference.tsx:240-244`) without awaiting it.
- In practice the item 1 loop usually hides this, but the contract is still not met.

## Item 3 — Fallback to default body font with non-blocking flag: **FAIL**

- **Fallback works.** `tokens.ts:176`: `const family = familyAvailable ? settings.fontFamily : DEFAULT_FONT_FAMILY;` with `DEFAULT_FONT_FAMILY = "ibmPlexSans"` (`fonts.ts:107`). Both the provider (`theme-preference.tsx:358-362`) and the preview (`appearance-screen.tsx:139-143`) pass `isFamilyLoaded(...)` into `buildTypography`. `loadFamily` / `loadCoreFonts` catch errors and return `false` (`fonts.ts:123-140`), so the app never blocks.
- **Flag missing.** No state records a failed load:
  - `appearance-screen.tsx:101` ignores the resolved boolean.
  - `theme-preference.tsx:213` and `:241` only act on `ok === true`.
  - `AppearanceState` (`theme-preference.tsx:380-391`) exposes `persistError` but no font flag.
  - Searching `src/` for `unavailable|fontFail|fontError|fontMissing` finds no font-related hits. The only "unavailable" string is the auth message at `src/i18n/vi.ts:236`.
- Also, `isFamilyLoaded() === false` cannot tell "still loading" from "failed", so the UI could not show the flag even if it wanted to.

## Item 4 — Weight snapping, no synthesized weights: **FAIL**

Passing parts:

- **Only existing weights are offered.** `FontWeightSetting = "regular" | "bold"` (`settings.ts:21-22`), `FONT_WEIGHTS = ["regular", "bold"]` (`settings.ts:53`), and the picker renders exactly these (`appearance-screen.tsx:412-418`). All 7 body families bundle both 400 and 700 (`fonts.ts:1-20`, `fonts.ts:49-104`).
- **Snapping.** Changing family never needs a weight change, because both offered weights exist everywhere. The internal role slots snap to real faces for two-weight families: `medium` becomes 400 and `semibold` becomes 700 (`fonts.ts:41-46`), which is the nearest real weight in each case.
- **Content styles set only a real face name, with no `fontWeight`.** `contentTextStyle` returns `fontFamily: live.faces[slot]` (`typography.ts:75-85`), and `ContentTextStyle` has no `fontWeight` field (`typography.ts:62-67`).
- `ThemeSettings` stores only the font id: `fontFamily: FontFamilyId` (`settings.ts:29`), validated at `settings.ts:178`. Faces are derived at runtime (`tokens.ts:176-183`).

**Violation:** a hard-coded `fontWeight` is placed on top of a body face that has no such weight:

```225:225:reactnative-mobile/src/components/visuals/charts.tsx
      <Text style={[type.caption, styles.markerText, { color: outline ? t.fg : colors.surface }]}>{number}</Text>
```

```378:378:reactnative-mobile/src/components/visuals/charts.tsx
  markerText: { fontSize: 11, fontWeight: "700" },
```

```174:180:reactnative-mobile/src/components/visuals/sessions.tsx
              <Text
                style={[
                  type.caption,
                  styles.dayLabel,
                  { color: isToday ? colors.ink : colors.inkMuted },
                  isToday && styles.dayToday,
                ]}
```

```219:219:reactnative-mobile/src/components/visuals/sessions.tsx
  dayToday: { fontWeight: "700" },
```

`type.caption` uses the `regular` slot (`typography.ts:58`). For example, that is `Inter_400Regular` when Inter is selected. Adding `fontWeight: "700"` to a single-face custom family makes the platform synthesize bold. The fix is to switch to the body family's `bold` face.

Not a violation: `src/components/launch/splash-hud-overlay.tsx:493-494` (`BarlowCondensed_800ExtraBold` + `"800"`) and `:512-513` (`IBMPlexSans_600SemiBold` + `"600"`). Those weights match the bundled file, and the faces are fixed brand faces, not the user's body family.

## Item 5 — No network access for fonts: **PASS**

- Every font source is a `require()` asset number from a per-weight subpath (`fonts.ts:1-20`, `sources: Record<string, number>` at `fonts.ts:38`). Each subpath `index.js` requires one local TTF. For example, `@expo-google-fonts/inter/400Regular/index.js` contains `export const Inter_400Regular = require('./Inter_400Regular.ttf');`.
- `Font.loadAsync` is called only in `fonts.ts:126` and `fonts.ts:135`, both with those maps. A grep of `src/` for `@expo-google-fonts|from "expo-font"|Font.(loadAsync|isLoaded)` returns only `src/theme/appearance/fonts.ts` (24 matches).
- A grep of `src/theme/` for `https?://|uri:` returns no matches. `fonts.ts:26-29` documents the local-only rule.
- `app.json:53` lists `"expo-font"` with no options, so there is no manifest and no remote config. There are no `.ttf`/`.otf` files or other font `require()`s outside `node_modules`.
- Plan §0 item 10 states: "No sync, no API, no runtime font download."

## Item 6 — License of every bundled font: **PASS**

Each package declares `"license": "MIT AND OFL-1.1"` in its `package.json`. The package JavaScript is MIT (`LICENSE`, first line `MIT License`). The font files are under `LICENSE_FONT`, 93 lines each, and line 9 of every file reads **"SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007"**. Lines 20-22 permit fonts to be "redistributed freely as long as they are not sold by themselves" and to be "bundled, embedded, redistributed and/or sold with any software", which covers app bundling.

| Family | Package (installed version) | License file | Line 1 of `LICENSE_FONT` |
| --- | --- | --- | --- |
| Barlow Condensed | `@expo-google-fonts/barlow-condensed` 0.4.1 | `reactnative-mobile/node_modules/@expo-google-fonts/barlow-condensed/LICENSE_FONT` | Copyright 2017 The Barlow Project Authors |
| IBM Plex Sans | `@expo-google-fonts/ibm-plex-sans` 0.4.1 | `.../ibm-plex-sans/LICENSE_FONT` | Copyright © 2017 IBM Corp. with Reserved Font Name "Plex" |
| Inter | `@expo-google-fonts/inter` 0.4.2 | `.../inter/LICENSE_FONT` | Copyright 2020 The Inter Project Authors |
| Be Vietnam Pro | `@expo-google-fonts/be-vietnam-pro` 0.4.1 | `.../be-vietnam-pro/LICENSE_FONT` | Copyright 2021 The Be Vietnam Pro Project Authors |
| Noto Sans | `@expo-google-fonts/noto-sans` 0.4.2 | `.../noto-sans/LICENSE_FONT` | Copyright 2022 The Noto Project Authors |
| Literata | `@expo-google-fonts/literata` 0.4.3 | `.../literata/LICENSE_FONT` | Copyright 2017 The Literata Project Authors |
| Source Serif 4 | `@expo-google-fonts/source-serif-4` 0.4.1 | `.../source-serif-4/LICENSE_FONT` | Copyright 2014 The Source Serif 4 Project Authors |
| Lexend | `@expo-google-fonts/lexend` 0.4.1 | `.../lexend/LICENSE_FONT` | Copyright 2018 The Lexend Project Authors, with Reserved Font Name "RevReading Lexend" |

Note: the Reserved Font Names ("Plex", "RevReading Lexend") only restrict renaming of **modified** versions. The app bundles the files unmodified, so this has no effect. OFL also requires the copyright and license notice to ship with redistributed fonts. An in-app or store "open-source licenses" notice was not checked and is outside this audit.

## Item 7 — Font count (max 10) and list: **PASS**

8 families:

1. Barlow Condensed (headings/brand only, not selectable)
2. IBM Plex Sans (default body)
3. Inter
4. Be Vietnam Pro
5. Noto Sans
6. Literata
7. Source Serif 4
8. Lexend

Evidence: `FontFamilyId` union (`settings.ts:13-20`), `FONT_FAMILY_IDS` (`settings.ts:44-52`), `BODY_FONTS` (`fonts.ts:48-105`), and `CORE_FONT_SOURCES` (`fonts.ts:110-116`). This matches plan §0 item 4 (7 body fonts).

- **OpenDyslexic is absent.** It is not in the id union, not in `package.json:6-13`, and there is no `open-dyslexic` directory under `node_modules/@expo-google-fonts`.
- `node_modules/@expo-google-fonts/material-symbols` exists on disk, but it is not in `package.json` and nothing under `src/` imports it, so it is not bundled.
- **Extra weights are justified.** IBM Plex Sans 400/500/600/700 and Barlow Condensed 600/700/800/900 are the pre-existing brand/UI faces, referenced by `typography.ts:3-12` and the wordmark styles. The added families ship Regular and Bold only, per plan Gate B.

## Item 8 — Total bundled size vs 6 MB cap: **PASS**

Method: for each of the 20 subpaths imported in `fonts.ts:1-20`, I read `<package>/<weight>/index.js`, extracted the single `require('./X.ttf')`, and summed `(Get-Item X.ttf).Length`. Weights that are not imported are not counted.

| Subpath | File | Bytes |
| --- | --- | --- |
| barlow-condensed/600SemiBold | BarlowCondensed_600SemiBold.ttf | 103,856 |
| barlow-condensed/700Bold | BarlowCondensed_700Bold.ttf | 104,316 |
| barlow-condensed/800ExtraBold | BarlowCondensed_800ExtraBold.ttf | 104,812 |
| barlow-condensed/900Black | BarlowCondensed_900Black.ttf | 105,348 |
| ibm-plex-sans/400Regular | IBMPlexSans_400Regular.ttf | 218,236 |
| ibm-plex-sans/500Medium | IBMPlexSans_500Medium.ttf | 218,268 |
| ibm-plex-sans/600SemiBold | IBMPlexSans_600SemiBold.ttf | 218,248 |
| ibm-plex-sans/700Bold | IBMPlexSans_700Bold.ttf | 218,212 |
| inter/400Regular | Inter_400Regular.ttf | 342,408 |
| inter/700Bold | Inter_700Bold.ttf | 344,072 |
| be-vietnam-pro/400Regular | BeVietnamPro_400Regular.ttf | 131,660 |
| be-vietnam-pro/700Bold | BeVietnamPro_700Bold.ttf | 139,012 |
| noto-sans/400Regular | NotoSans_400Regular.ttf | 629,024 |
| noto-sans/700Bold | NotoSans_700Bold.ttf | 630,968 |
| literata/400Regular | Literata_400Regular.ttf | 255,252 |
| literata/700Bold | Literata_700Bold.ttf | 260,884 |
| source-serif-4/400Regular | SourceSerif4_400Regular.ttf | 329,948 |
| source-serif-4/700Bold | SourceSerif4_700Bold.ttf | 330,208 |
| lexend/400Regular | Lexend_400Regular.ttf | 78,356 |
| lexend/700Bold | Lexend_700Bold.ttf | 78,628 |
| **Total (20 files)** | | **4,841,716 B** |

- 4,841,716 / 1,000,000 = **4.842 MB**, and 4,841,716 / 1,048,576 = **4.617 MiB**. Both are under the 6 MB cap. The headroom is 1,158,284 B.
- Per family: Barlow 418,332 · IBM Plex 872,964 · Inter 686,480 · Be Vietnam Pro 270,672 · Noto Sans 1,259,992 · Literata 516,136 · Source Serif 4 660,156 · Lexend 156,984. These match plan Gate B and `theme-progress.md` exactly.
- The command (PowerShell, read-only) looped over the 20 subpaths, ran `[regex]::Match((Get-Content "$base/$s/index.js" -Raw), "require\(['""]([^'""]+\.ttf)['""]\)")`, and summed `(Get-Item $f).Length`. The output ended with `TOTAL 4841716`, `MB(10^6) 4.842`, `MiB 4.617`.
- Assumption (not measured): Metro includes only the TTFs reached through these `require()`s. The package root `index.js` files, which require every weight, are not imported anywhere in `src/`.

## Item 9 — Vietnamese glyph coverage: **PASS** (glyph presence). On-device rendering is **UNVERIFIED**.

- Code and doc evidence alone is weak. `typography.ts:14` is a comment about extra line height, `typography.test.ts:6` tests only line height, and plan §3.1 table (lines 213-221) claims "Yes" from Google Fonts `METADATA.pb`. None of these renders a glyph.
- **Direct evidence from the files.** A read-only Node script parsed the `cmap` table of all 20 bundled TTFs, using format 12 when present and format 4 otherwise. It checked 134 Vietnamese code points: the full precomposed block U+1EA0–U+1EF9 (`Ạ`…`ỹ`) plus `ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư`. Result: **`checked=134 missing=0` for every one of the 20 files** (Barlow ×4, IBM Plex ×4, and Regular/Bold of Inter, Be Vietnam Pro, Noto Sans, Literata, Source Serif 4, Lexend).
- **UNVERIFIED:** there are no screenshots under `docs/` (a glob for `docs/**/*.{png,jpg,jpeg,webp}` found 0 files). Actual on-device rendering and diacritic clipping at the `viLineHeight` floor have not been observed for any family.

## Item 10 — Headings stay Barlow Condensed; family setting is body-only: **PASS**

- The heading face is fixed. `titleTextStyle` always uses `fontFamily: fonts.displaySemi` (`BarlowCondensed_600SemiBold`) and ignores `live.faces`. Only its size follows `sizeFactor` (`typography.ts:87-96`).
- The wordmark styles use the fixed `fonts.display*` / `fonts.uiMedium` constants (`typography.ts:123-179`).
- The family setting reaches content roles only. `contentTextStyle` uses `live.faces[slot]` (`typography.ts:75-85`) for `body`, `label`, `link`, `caption`, and `cta` (`typography.ts:49-60`, `100-109`). `displayFont` was dropped from settings (`settings.ts:26-40`, plan §0 item 5).
- Observation, not scored: `typography.ts:113-117` notes that module-level `StyleSheet.create` snapshots of `type.*` do not update. Screens that copied `type.body` into a static stylesheet keep IBM Plex Sans after a family change. That is a propagation gap for the Phase 3 visual QA, not a heading/body separation issue.

## Validation

Not run: `tsc`, lint, and tests (not authorized). The only commands were the read-only directory listings, license reads, byte sums, and the in-memory `cmap` parse described above.
