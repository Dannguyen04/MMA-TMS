# Auth UX redesign — Cage-side auth

Date: 2026-09-22  
Scope: `reactnative-mobile` login, register, forgot-password. No splash rewrite. No new auth APIs.

Figma MCP was not available in this session. Visual source: splash cage/lotus atmosphere, `@/theme` palettes, `BrandWordmark`.

## Current UX problems

- **CTA hierarchy:** Dock put secondary links *above* the primary button. “Quên mật khẩu”, “Đăng ký”, and “Đăng nhập” read as three equal actions (same lotus `type.link`, same 44pt hits).
- **Keyboard:** Shell already avoids the dock and scrolls the focused field. Heading vanished entirely when the keyboard opened, so users lost *which* form they were on. Follow-up (screenshots): Android IME still overlapped password + CTA; compact title jammed under the status bar; four demo links stayed in the dock fighting the keyboard. Root cause: `KeyboardAvoidingView` `behavior="padding"` **on Android** stacked on `softwareKeyboardLayoutMode: "resize"`, plus overlay `translateY` defaulting on. Demo stack ate vertical space even with keyboard closed.
- **Tap targets / chrome:** Theme cluster is fine (44pt). Password eye is 44pt. Fields were hairline underlines (hard to tap). Footer “Quên mật khẩu” was caption-sized.
- **Errors:** Field shake + `mapApiMessage` exist, but no haptics and the banner did not feel like a strike/miss.
- **Forgot-password dead-end:** Honest pending copy, but the screen felt like a leftover login clone (tiny title, demo stack, no blocked-API treatment).
- **Register length:** Two steps exist, but step 1 is a flat tax form (name → email → DOB → weight → passwords) with no grouping. Step 2 is better (optional + limbs accordion) but still visually flat.
- **No signature:** Atmosphere was a faint octagon grid. No kicker, no strike energy, no difference between primary CTA and text links. Same generic auth chrome as any SaaS.

## Chosen direction — Cage-side auth

Same language as splash: dark/light lotus + cage ink, octagon mesh, wordmark, academy line. **Fast, keyboard-first form** — no video, no Skia, no GSAP. Splash cinematic *informs* color and geometry; it must never block sign-in.

- One large primary CTA (pill, 56pt min, cage/lotus fill from tokens).
- Secondary path: sentence + strong text link (Đăng ký / Đăng nhập).
- Tertiary: quieter inkMuted link (Quên mật khẩu).
- Memorable micro-motion: field/banner shake, press scale, success/error haptics. Honor `reduce-motion`.
- Vietnamese copy: short, fighter-gym tone, no slang gimmicks.

## Shared component map

| Piece | Role |
| --- | --- |
| `AuthShell` | Atmosphere, safe area, wordmark, kicker/title, keyboard avoiding, dock **CTA then footer**, theme toggle top-right, optional back |
| `AuthButton` | Primary / secondary. Loading spinner on primary |
| `AuthNavRow` | Prompt + emphasis link + optional quiet link |
| `AuthTextField` / date / select | Existing fields; show/hide password |
| `AuthFormError` | Live region + shake |
| `AuthSection` | Register grouping labels |
| `auth-haptics` | Success / error / light via `expo-haptics` |
| `BlockedApiNotice` | Forgot-password honesty (no invented reset endpoint) |
| `AuthDemoSwitch` | Temporary compact Demo chip → role sheet. Login only. Hidden when keyboard open. Delete file + login import to remove. |

## Login vs register (internal split)

- **Routes** stay Expo Router thin wrappers → `screens/auth/*`.
- **Shared:** shell, fields, buttons, nav row, error strip, haptics, `mapApiMessage`.
- **Login:** email + password only. `signIn` then `router.replace(homeHrefForGate)`. No extra `/users/me`.
- **Register:** two steps in one screen. Step 1 required identity + credentials. Step 2 optional camp/measures. `submitLock` + `applyRegisteredSession` + `persistSession` unchanged. Skip still sends required-only body via `toFighterRegisterBody`.
- **Forgot:** same shell; **no** reset API. Notice + local email validation + pending copy.

## Accessibility

- Contrast: lotus `#8F7040` on light `#E8E6E1` and lotus `#C9A86C` on dark `#090A0C` stay tokenized; primary CTA uses `cta` / `onCta`. Quiet links use `inkMuted` (not lotus-on-lotus).
- Hits ≥ 44pt on links, back, eye, theme, chips.
- `accessibilityRole` button/link, live regions on errors.
- Reduce motion: skip atmosphere pulse, shell fade, field shake, button press scale.
- Keyboard: compact title while open; dock sits above IME; `keyboardShouldPersistTaps="handled"`.
- Password toggle labels stay in `vi.a11y`.

## Out of scope

Splash, fighter home, new REST, GSAP/Three/Framer/Skia/FlashList, Gesture Handler swipes.

## Keyboard + demo (2026-09-22 follow-up)

- **Android IME:** Keep `expo.android.softwareKeyboardLayoutMode: "resize"` in `app.json` (native rebuild required if this flag changes). Do **not** use `pan` on auth — it slides the compact title under the status bar.
- **KAV:** iOS only (`behavior="padding"`). Android relies on resize; overlay `translateY` on the **dock** only if the window did not shrink.
- **Safe area:** Compact keyboard header still uses `insets.top`. Octagon glow (`Atmosphere`) is unmounted while the keyboard is open.
- **Demo:** One `AuthDemoSwitch` chip. Sheet lists võ sĩ / HLV / bác sĩ / quản trị. Hidden when `keyboardVisible`. Not on register. Easy removal: drop `src/components/auth/auth-demo-switch.tsx` and its login import.
- **Dock when IME open:** Primary CTA + register + forgot stay; demo does not. Password eye stays inside the outlined field, not on the CTA.
- Skill: `.agents/skills/auth-form-input/` (`SKILL.md` + Expo 57 `ADAPTER.md`).

## QA (keyboard + a11y)

1. Login: focus email → next to password → done submits. CTA stays visible above keyboard on iOS and Android. Compact title stays **below** the status bar (not overlapping 02:46). Rebuild Android after any `softwareKeyboardLayoutMode` change.
2. With IME open: demo chip gone; “Đăng ký” and “Quên mật khẩu” still visible if they fit; password eye does not sit on the gold button.
3. With IME closed: single **Demo** chip, not four stacked links. Chip opens a sheet of four roles (same `enterDemo` as before).
4. Show/hide password does not steal focus.
5. Invalid submit: field errors + haptic error + banner; TalkBack/VoiceOver reads alert.
6. Successful login/register: success haptic then navigate (or check-email state).
7. Register: same outlined fields and keyboard behavior; grouped sections; no demo chip.
8. Forgot: blocked notice visible without submitting; invalid email; valid email shows pending, not a fake “sent”.
9. Theme toggle light/dark/system; lotus accents remain.
10. Reduce motion: no pulse/shake; forms still usable.
11. Contrast: primary label on CTA, quiet link vs background (forgot is body + underline).
12. Do not wait on splash video to type credentials.
13. Remove demo: delete `auth-demo-switch.tsx` + login import; login still signs in.
