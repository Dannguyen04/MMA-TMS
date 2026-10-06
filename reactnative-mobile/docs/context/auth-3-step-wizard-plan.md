# Auth 3-step wizard — implementable plan (Phase 0)

**Status:** planning only. Do not implement until this file is the handoff.  
**Date:** 2026-09-22  
**App:** `reactnative-mobile` (Expo SDK 57, `expo` ~57.0.22)  
**Docs read:** Expo v57 index, [keyboard handling](https://docs.expo.dev/guides/keyboard-handling/), [react-native-keyboard-controller](https://docs.expo.dev/versions/v57.0.0/sdk/keyboard-controller/), [Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), `AGENTS.override.md` skills `auth-form-input` + `ADAPTER.md`, `mma-mobile-navigation-motion`, `mma-mobile-visual-language`.  
**Figma:** MCP/namespace not available this session — do not invent a Figma file. Align to `@/theme` + existing auth chrome.  
**Related (do not treat as current truth):** `docs/AUTH_REDESIGN_PROPOSAL.md` still describes a **2-step** register and “implementing B”. Live code has **filled outlined fields** and a **2-pane** register. This document **supersedes** that register shape. Keep its IME diagnosis (double KAV + Android resize).

---

## A. Current-state audit

### Files (auth surface)

| Path | Role |
| --- | --- |
| `src/app/(auth)/_layout.tsx` | Expo Router `Stack`, `headerShown: false`, `animation: "fade"` 200ms |
| `src/app/(auth)/login.tsx` / `register.tsx` / `forgot-password.tsx` | Thin route wrappers |
| `src/screens/auth/login.tsx` | Email + password + demo stack |
| `src/screens/auth/register.tsx` | Local `step: 1 \| 2` (not 3). Conditional JSX, **no** pager |
| `src/screens/auth/forgot-password.tsx` | Blocked API + local pending notice |
| `src/components/auth/auth-shell.tsx` | Safe area, theme toggle, wordmark, **ScrollView + docked CTA**, RN `KeyboardAvoidingView` |
| `src/components/auth/auth-text-field.tsx` | Always-on label, outlined `surfaceMuted` box, 48 min, eye 44 |
| `src/components/auth/auth-date-field.tsx` | Custom year/month/day `Modal` (not Expo UI DateTimePicker) |
| `src/components/auth/auth-select-field.tsx` | Weight class modal list |
| `src/components/auth/auth-button.tsx` | Primary 52 / secondary 44, spinner |
| `src/components/auth/auth-form-error.tsx` | Live region strip in **dock** |
| `src/components/auth/auth-section.tsx` | Muted section titles |
| `src/components/auth/auth-step-pager.tsx` | **Exists, unused.** Reanimated enter/exit for `step: 1\|2\|3` |
| `src/components/auth/auth-step-rail.tsx` | **Exists, unused.** 3-tab progress rail |
| `src/components/auth/fighter-demo-link.tsx` | Four stacked demo roles (login only) |
| `src/components/auth/theme-toggle.tsx` | Light / dark / system, 44 hits, haptic |
| `src/auth/fighter-register-body.ts` | Nest-aligned mapper; **do not change contract** |
| `src/api/auth.ts` | `POST /auth/register` JSON body as-is |
| `src/i18n/vi.ts` | Copy already has **3-step** strings (`step1`–`step3`, `stepRail1`–`3`) **out of sync with UI** |
| `app.json` | `android.softwareKeyboardLayoutMode: "resize"` |

`ADAPTER.md` mentions `auth-demo-switch.tsx` and `useAuthFieldVisibility()` — **those files are not in the tree**. Live login still uses `FighterDemoLink`.

### Register fields vs Nest `registerBodySchema`

Required: `email`, `password`, `profile.firstName`, `lastName`, `dateOfBirth` (`YYYY-MM-DD`), `weightClass`.  
Optional: `nationality`, `heightCm` / `reachCm` (`>0` and `<300`), `dominantStance`, limb cm (`>0` `<150`), `gym`, `bio`, `profileImageUrl`.  
**Not sent:** `confirmPassword` (client-only).  
**In i18n + mapper, not on the current form:** `profileImageUrl` — keep **omitted** (default).

### What the 2-step screen actually does

- **Step 1 (too long):** last + first + DOB + weight + email + password + confirm (two `AuthSection`s, still one scroll).
- **Step 2:** nationality, gym, height, reach, stance chips, limbs accordion, bio. Skip CTA sends required-only body.
- Subtitle uses `vi.register.step1` (“bạn là ai”) then `vi.register.step2` (“email và mật khẩu”) — **wrong**: step 2 in UI is camp/measures, while copy’s step 2 is credentials.
- Email field has **no** `onSubmitEditing` → password (broken next-chain).
- `styles.fieldRow` / `halfCol` are **full-width columns**, not a 2-up row.
- Back on step 2 only; no Android `BackHandler`; no pager; **instant unmount** of step 1 fields (state kept in parent — good).

### Keyboard behavior (root cause of “keyboard covers fields”)

Verified in source, consistent with prior screenshot notes in `AUTH_UX_REDESIGN_PLAN.md`:

1. Android **resize** shrinks the window.
2. `AuthShell` wraps **everything** (header + scroll + **dock**) in `KeyboardAvoidingView` with `behavior={Platform.OS === "ios" ? "padding" : undefined}`.
3. Dock is a **sibling below** the `ScrollView` (correct idea) but:
   - No `keyboardVerticalOffset` (iOS notch / wordmark).
   - No `keyboardDidShow` compact mode — full wordmark + academy line + title + subtitle stay mounted.
   - No scroll-into-view of the focused input (`ScrollView` has no `ref` / `scrollTo`).
   - Banner + CTA + footer (login: register link + forgot + **four demo links**) all sit in the dock → IME + dock steal height; password and lower register fields sit under the keyboard or under the gold CTA.
4. Skill rule: **do not** add KAV padding **on Android** when resize is on (double shift: title under status bar). Current Android `behavior={undefined}` is correct; **iOS padding around a tall chrome + dock** still covers lower fields.

`BrandWordmark` already has `compact` — **AuthShell never passes it**.

### Visual language: login vs register

Shared: lotus/cage tokens, IBM Plex fields, Barlow wordmark, outlined filled inputs, docked primary CTA, theme cluster top-right.  
Gaps:

| | Login | Register |
| --- | --- | --- |
| Density | 2 fields — premium if chrome collapses | Step 1 is a tax form |
| Motion | Fade from auth stack only | Step change = hard swap, no `AuthStepPager` |
| Demo | Four caption links in dock | None |
| Progress | n/a | Subtitle line only; unused rail |
| Empty/error | Field + banner; no haptic | Same; `applyFieldErrors` generic banner |
| a11y | Labels + live region | Rail unused; back is text not chevron; no step announcement |

### Tests today

**None in `reactnative-mobile`.** `package.json` has no `test` / jest / RNTL / Maestro / Detox.  
Contract tests live in **`nestjs-api/src/auth/auth.model.spec.ts`** (`registerBodySchema` requires fighter profile required keys). Mobile must add its own tests in a later phase.

### UI look (this session)

Could not run the device/emulator or Figma. Catalog above is from **live source + prior IME screenshots documented in `AUTH_UX_REDESIGN_PLAN.md`**. Implementer **must** screenshot login/register light+dark, IME open on password and on register confirm, before coding (Phase 1). Evaluator agent later loops on those gates.

---

## B. Recommended 3-step field split

Match **existing** `vi.register.stepRail*` / `step1`–`step3` (already Vietnamese). Do not invent a fourth step.

| Step | Rail | Fields | Required to leave step | Keyboard notes |
| --- | --- | --- | --- | --- |
| **1 — Bạn** | `stepRail1` | `lastName`, `firstName`, `dateOfBirth`, `weightClass` | All four valid | DOB + select are **modals** (no IME). After name fields, IME can dismiss before opening date/weight. Focused name fields stay in scroll; dock = **Tiếp tục** only. |
| **2 — Tài khoản** | `stepRail2` | `email`, `password`, `confirm` | Email valid, password 8–128, match | Highest IME risk. **Exactly 3 fields.** Compact header. Dock = **Tiếp tục**. Password eye must never share baseline with CTA. |
| **3 — Góc tập** | `stepRail3` | `nationality`, `gym`, `heightCm`, `reachCm`, stance chips, limbs accordion, `bio` | Optional except invalid numbers if filled | Decimal pad + tall bio. Dock = **Tạo tài khoản** + secondary **Bỏ qua và tạo tài khoản**. Scroll focused numeric/bio above dock. |

**Rationale:** Nest required identity vs credentials vs optional camp already match copy. Mixing identity + passwords on one pane is why step 1 overflows the keyboard. Weight class is identity (required profile), not “account”.

**Stay above keyboard (always):** focused `TextInput` (label + box + error/helper), password eye, primary CTA.  
**Hide while IME open:** academy line, kicker/subtitle extras, demo (login), atmosphere if added, step rail **labels** may shrink to bars only.  
**May hide:** full wordmark → `BrandWordmark compact`. Theme toggle can stay (44) if there is width; if not, keep it (do not put it in the dock).

### Per-step keyboard strategy (Expo 57 only)

**Do not** use `softwareKeyboardLayoutMode: "pan"` for auth (title under status bar). Keep **`resize`**. Native rebuild only if that flag changes.

| Layer | Default (Phase 2) | Escalate (Phase 2b, only if IME still covers after 3-step + compact chrome) |
| --- | --- | --- |
| Android | Window **resize**. **No** KAV padding (`behavior={undefined}` / disable KAV). Dock is flex footer of the resized window. | `npx expo install react-native-keyboard-controller` (Expo 57 third-party; **dev build**, not Expo Go). `KeyboardProvider` in root `_layout.tsx`. |
| iOS | RN `KeyboardAvoidingView` `behavior="padding"` **or** (preferred if 2b) same Keyboard Controller as Android for one code path. `keyboardVerticalOffset` = status bar + top bar (~44). | Same library. |
| Scroll | `ScrollView` + `keyboardShouldPersistTaps="handled"` + `keyboardDismissMode="interactive"` (iOS) / `on-drag`. On focus: `scrollResponderScrollNativeHandleToKeyboard` / measure + `scrollTo` so the field sits **above dock** (`bottomOffset` ≈ dock height, ~72–120). | `KeyboardAwareScrollView` `bottomOffset={dockHeight}`. |
| Dock | Sibling of scroll, **not** inside it. | Wrap dock in **`KeyboardStickyView`** (moves footer with IME **without** resizing the header). Do **not** wrap the whole screen in both KAV and StickyView. |
| Toolbar | Return-key chain (`next` / `done`). | Optional `KeyboardToolbar` prev/next/dismiss on step 2–3 only. |

**Default implementer choice:** Phase 2 = fix shell (compact + scroll-into-view + correct KAV matrix) **without** a new native module. Phase 2b = Keyboard Controller + `KeyboardAwareScrollView` + `KeyboardStickyView` on the dock if QA fails the “focused field never covered” gate on a real Android IME.

Skill `auth-form-input` said “do not add keyboard-controller unless asked.” This task **explicitly** compares StickyView vs KAV; 2b is authorized **only** after the 3-step layout still fails.

Login uses the **same** shell strategy (two fields; compact on IME; hide demo).

---

## C. Navigation / animation spec

**Pattern:** **one register route**, local `step: 1 \| 2 \| 3` + `direction: 1 \| -1`. **Do not** push `/register/2` stack screens (form state would need a store; interactive-pop would fight IME).

**Pager vs cards vs shared-element**

| Option | Verdict |
| --- | --- |
| Expo Router stacked steps | Reject — state + Android back + IME |
| `react-native-pager-view` swipe | Reject as primary — horizontal swipe vs vertical scroll vs IME |
| Reanimated shared-element | Reject — overkill; no shared hero |
| **`AuthStepPager` (already in repo)** | **Default.** `FadeInRight` / `FadeOutLeft` forward; reverse incoming `FadeInLeft`. Duration `motion.base` 220 / `enter` 200. `useReducedMotion` → opacity only |

Wire `register.tsx` children through `AuthStepPager`. Keep field state in the parent so **going back restores values** (already true for 2-step). Do **not** remount TextInputs by putting state inside the animated pane if that resets focus incorrectly; lifting state is mandatory.

**Chrome:** `AuthStepRail` above the pager. Taps:

- Allowed **backward** to any completed step without re-validation.
- **Forward** only if current step validates (same as Continue).
- Announce `accessibilityLiveRegion` on step change (`Bước 2 / 3 — Tài khoản`).

**Buttons:** primary Continue / Create; text **Quay lại** (`vi.register.backStep`) in the top bar (already `onBack`). No swipe required. If a later polish adds swipe, it must be **disabled while `keyboardVisible`**.

**Android back:** `BackHandler` — step 2/3 → previous step; step 1 → default (leave register / `router.back()`). `app.json` `predictiveBackGestureEnabled: false` — do not enable for this task.

**iOS interactive pop:** applies to **login ↔ register** stack, not inner steps. Optional polish: change auth stack from `fade` to `slide_from_right` for register only (`animation` per screen). **Default:** keep fade between login/register to avoid fighting the in-screen pager; inner steps already slide via Reanimated.

**Preserve form:** single component state. Leaving to login **may** drop the draft (default). If user taps “Đã có tài khoản?” mid-wizard, no persistence required.

---

## D. Login polish (same visual system)

Login is not a wizard but must feel like the same product:

- Same `AuthShell` (compact wordmark on IME, docked CTA, outlined fields, lotus CTA on dark / ink CTA on light).
- Collapse **four** `FighterDemoLink` rows into **one** control (chip → `Modal` role list) **or** hide demo whenever keyboard is open (minimum). Prefer one chip; keep file deletable.
- Hierarchy: primary **Đăng nhập** → sentence + **Tạo tài khoản** → quieter **Quên mật khẩu**. Do not put three lotus links above the button.
- Return-key: email → password → submit (already).
- Forgot-password stays blocked-API honest; same shell + compact IME. No new REST.

---

## E. Motion, copy, validation, loading, demo, theme

**Motion:** pager slide; button press opacity only; **no** Lottie/Skia on auth; honor `useReducedMotion`. Optional `expo-haptics` error on failed Continue (light) — do not haptic every keystroke. Theme toggle already haptics — keep.

**Copy:** keep Vietnamese in `vi.ts`. After wiring 3 steps, **fix subtitle** to `step1` / `step2` / `step3` matching the pane. Rail: Bạn / Tài khoản / Góc tập. Skip: `extraHint` + `skipAndCreate`. Check-email screen unchanged.

**Validation timing**

- **Per-step on Continue** (not only final submit). Clear field errors on change (existing `clearError`).
- **Blur validate** optional on step 2 email/password — default **off** (less nagging); keep submit/continue.
- Final submit still re-runs step 1–2 validators if somehow skipped.
- Optional cm: empty = omit; invalid = block Create but **not** Skip (Skip ignores extras — existing `submitRegister(false)`).

**Loading:** lock `submitLock` + disable both Create and Skip (existing). Continue is local — no spinner. Disable rail forward while submitting.

**Demo:** login only; hide on IME; never on register.

**Theme:** keep cluster; test light/dark/system on both screens. Contrast: `lotus` `#8F7040` on light `bg` `#E8E6E1` for **links only**; body text uses `ink`. CTA uses `cta`/`onCta`.

---

## F. Test plan

### Infrastructure to add (mobile has none)

- Jest + `jest-expo` + `@testing-library/react-native` via Expo 57–compatible versions (`npx expo install` where possible). Script `"test": "jest"`.
- Do **not** add Detox/Maestro in the first coding PR unless time remains; IME coverage is **manual**.

### Unit / component tests to add

| File | Assert |
| --- | --- |
| `src/auth/fighter-register-body.test.ts` | `toFighterRegisterBody` omits empty optionals; rejects 0 / ≥300 height; email lowercased; **no** `confirmPassword` key; required-only body matches Nest happy path in `auth.model.spec.ts` |
| `src/screens/auth/register-steps.test.ts` (extract `validateStep1/2/3` to `src/auth/register-steps.ts`) | Step 1 fails without weight; step 2 mismatch; step 3 invalid cm; skip path does not require gym |
| `src/components/auth/auth-step-pager.test.tsx` | Renders children for current step; reduced-motion branch does not throw |
| `src/components/auth/auth-step-rail.test.tsx` | `onSelect` on press; a11y selected state |
| `src/screens/auth/register.test.tsx` | Continue 1→2→3; back 3→2→1; values persist; Create calls `register` mock with mapper output; Skip omits extras |
| `src/screens/auth/login.test.tsx` | Empty submit errors; invalid email; success navigates (mock `signIn`) |

Keyboard layout is **not** reliably unit-testable. Optional: snapshot that dock is a sibling (`testID="auth-dock"`) and scroll has `testID="auth-scroll"`.

### Manual visual checklist

1. Android + iOS: login password focused — field, eye, CTA above IME; title not under status bar.
2. Register step 2 confirm focused — same.
3. Register step 3 bio focused — scroll so caret/box above CTA; Skip still tappable or dismiss IME first without losing text.
4. Light/dark/system; reduce-motion: steps still change.
5. TalkBack/VoiceOver: labels, password toggle, step rail, errors.
6. Android system back through steps then off register.
7. Payload: Charles/log — matches `FighterRegisterBody`; skip omits optionals.
8. Demo hidden with keyboard; theme toggle still works.

---

## G. End-user evaluation rubric (later agent)

Score 1–5 each; **ship only if all gates Pass**.

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| **Professional** | Tax form, competing CTAs | Clear hierarchy, Vietnamese gym tone | Cage/lotus discipline, one primary action, honest errors |
| **Creative** | Generic SaaS | Token-correct but flat | Memorable without splash video (rail, pager, wordmark) |
| **Smooth** | Hard cuts, jank, lost state | Pager + back works | 220ms directional motion, no focus jump, IME sync |
| **Attractive** | Hairline/low contrast | Filled fields, CTA contrast | Light and dark both feel finished |

**Hard gates (fail = loop):**

- [ ] Focused field **never** covered by IME or dock (Android Gboard + iOS).
- [ ] Register is **three** distinct steps with bidirectional UI transition.
- [ ] Back preserves values; Android back matches in-wizard back.
- [ ] `POST /auth/register` body **unchanged** in shape (mapper only).
- [ ] Login and register share shell/fields/CTA; login demo does not steal IME space.
- [ ] Reduce-motion still completable.
- [ ] No invented endpoints (forgot stays pending).

Evaluator loops: screenshot + checklist until gates pass; do not “fix” by adding cyan splash colors to auth.

---

## H. Implementation phases (file list)

**Phase 0 — this plan** (`docs/context/auth-3-step-wizard-plan.md`). No feature code.

**Phase 1 — capture UI**  
Screenshot current login/register IME (do not code). Confirm 2-step vs copy mismatch.

**Phase 2 — shell + 3-step (no new native module)**  

- `src/components/auth/auth-shell.tsx` — compact wordmark, keyboard listeners, scroll-into-view, dock `testID`, Android no extra KAV padding  
- `src/screens/auth/register.tsx` — `step` 1\|2\|3, `AuthStepPager`, `AuthStepRail`, split sections, BackHandler, fix email→password chain  
- `src/auth/register-steps.ts` — extracted validators (testable)  
- `src/screens/auth/login.tsx` — demo collapse + same shell  
- `src/i18n/vi.ts` — only if a string is missing (most exist)  
- `src/components/auth/fighter-demo-link.tsx` or new `auth-demo-switch.tsx` (delete the other)

**Phase 2b — only if IME gate fails**  

- `npx expo install react-native-keyboard-controller`  
- `src/app/_layout.tsx` — `KeyboardProvider`  
- Auth shell: `KeyboardAwareScrollView` + `KeyboardStickyView` dock  

**Phase 3 — tests**  

- Jest config, files in §F  
- Do not change `nestjs-api` contracts  

**Phase 4 — evaluator loop** using §G.

**Must not change:** `toFighterRegisterBody` output keys/types; `POST /auth/login|register`; session hydrate; forgot = no reset API; splash cinematic tokens on auth; `softwareKeyboardLayoutMode` unless Phase 2b + rebuild is proven necessary (prefer **keep resize**).

---

## I. Open UX decisions (defaults so implementer is not blocked)

| Decision | Default |
| --- | --- |
| 3-step split | Bạn / Tài khoản / Góc tập as §B |
| Inner navigation | In-screen Reanimated pager + rail; not nested routes |
| Swipe between steps | **Off** |
| Login↔register stack animation | Keep **fade** |
| Keyboard library | **Off** until Phase 2b |
| `profileImageUrl` field | **Stay hidden** |
| Height/reach layout | **2-up row** on width ≥ 360; else stack (fix today’s fake `halfCol`) |
| Demo | One chip + modal; hide on IME |
| Draft persist if user leaves to login | **Discard** |
| Auth visual (A studio / B cage / C card) | **Keep current outlined filled fields** (live code). Do not switch to underline-only B from the proposal. Optional faint atmosphere **off while IME open**. |
| Figma | None; tokens only |

**API contract — never change without backend:** `registerBodySchema` / `FighterRegisterBody`. Confirm password is UI-only. Role is fighter-only on this screen.
