# Đề xuất thiết kế lại Auth (Login / Register / Forgot)

> Tài liệu này **thay thế** mọi bản `AUTH_UX_REDESIGN_PLAN.md` (nếu file đó xuất hiện lại: chỉ giữ pointer tới file này).

**Trạng thái (2026-09-22): implementing B** — cage cinematic + **image background** (`assets/splash/atmosphere.png` + scrim) + **no field frames** (underline grow on focus, not outlined/filled boxes). Gold CTA pill. IME: hide kicker / subtitle extras + Demo. Android resize only (no KAV padding). iOS KAV padding. SafeArea always. Overrides vs original B: no octagon hairline frame; fields are typographic, not filled `surfaceMuted` boxes.

---

## 1. Chẩn đoán — vì sao các bản gần đây ngày càng tệ

### 1.1 Bàn phím bị “đẩy đôi” (double KAV + resize)

- Android `app.json`: `softwareKeyboardLayoutMode: "resize"` → activity **đã** co chiều cao khi IME mở.
- Shell lại bọc `KeyboardAvoidingView` **padding/translate** + đôi khi dịch dock theo `keyboardHeight`.
- Hệ quả: title/wordmark bị **nhét dưới status bar**, CTA đè lên nút hiện mật khẩu, field “nhảy” hai lần.
- Expo 57: trên Android với resize, KAV phải `behavior={undefined}` / không cộng padding; **không** dùng `pan` cho auth (pan kéo cả header vào status bar).

### 1.2 Quá nhiều chrome

Octagon SVG, radial glow, kicker “Lotus Combat”, compact header, Reanimated pulse, haptic rải rác, underline hairline trên nền cage tối — tất cả chiếm chỗ **trước khi** user gõ được mật khẩu. Khi IME mở, chrome vẫn tranh chỗ với field + CTA.

### 1.3 Demo / QA chiếm dock

Bốn link demo xếp dọc (võ sĩ / HLV / bác sĩ / admin) + Quên mật khẩu + Đăng ký nằm **cùng cột với nút Đăng nhập**. Keyboard mở → user không thấy password eye / CTA. Chip + bottom sheet vẫn là “chrome tạm” nếu đặt dưới CTA.

### 1.4 Ô underline / outlined siêu mỏng

Hairline trên `bg` `#090A0C` khó tap, khó thấy focus. Skill `auth-form-input`: label **cố định phía trên**, ô filled/outlined 48pt, gap ≥ 16 (IME có thể 12, không dưới 12).

### 1.5 Scope lệch

Mỗi pass thêm motion (Lottie, sheet, shake, scale CTA) thay vì khóa **một** chiến lược IME + một visual language. Session (`signIn`, `applyRegisteredSession`, `submitLock`) thì ổn — đừng đụng API.

---

## 2. Ba hướng (chọn một chữ cái)

Màu **chỉ** từ `@/theme` (`palettes.light` / `palettes.dark`): `bg`, `surface`, `surfaceMuted`, `ink`, `inkMuted`, `inkSubtle`, `line`, `controlBorder`, `cage`, `lotus`, `cta`, `onCta`, `ring`, `danger` / `dangerSoft`, `success` / `successSoft`, `disabledFill` / `disabledInk`.

Typography có sẵn: wordmark Barlow Condensed; UI IBM Plex (`type.title`, `type.body`, `type.label`, `type.cta`, `type.caption`, `type.link`).

Keyboard **chung cho A/B/C** (Expo 57):

| Nền | Chiến lược |
| --- | --- |
| Android | Giữ `softwareKeyboardLayoutMode: "resize"`. KAV `behavior={undefined}`. Không pan. |
| iOS | KAV `behavior="padding"`. |
| Cả hai | `ScrollView` `keyboardShouldPersistTaps="handled"`. CTA **sibling dưới scroll**, không nhét demo vào cùng baseline password. |
| IME mở | Ẩn Demo. Ẩn atmosphere (nếu hướng có). Giữ CTA + Quên/Đăng ký nếu còn chỗ; nếu không: chỉ CTA + field đang focus. Header luôn dưới `useSafeAreaInsets().top`. |
| Không | `react-native-keyboard-controller` trừ khi user yêu cầu native module. |

Motion **chung**: không Lottie/GSAP/Skia trên login. Reduce-motion: tắt mọi translate/opacity. Tối đa: fade 150–200ms opacity theme, không spring CTA.

A11y **chung**: label luôn hiện; password toggle 44×44, `accessibilityLabel` hiện/ẩn; lỗi `accessibilityLiveRegion`; contrast `ink` trên `bg` / `onCta` trên `cta`; hit ≥ 44.

---

### A — Studio-minimal

**Cảm giác:** phòng tập sạch, form như giấy đăng ký — không “võ đài”.

- **Màu:** Light mặc định `bg` `#E8E6E1`, `surface` `#F6F5F2`, chữ `ink` `#121316`, CTA `cta` đen `#16181C` / `onCta`. Dark: cùng token, không dùng `cage` làm glow. Accent `lotus` **chỉ** cho link.
- **Chữ:** Title `type.title` (không kicker). Subtitle một dòng `type.body` + `inkMuted`. Field `type.label` + `type.body`. CTA `type.cta` không uppercase theatrical.
- **Layout (ASCII login):**

```
[ safe top ]  [theme]
  MMA Vision
  Đăng nhập
  Vào buổi tập…

  Email    [  filled box 48  ]
  Mật khẩu [  filled     👁  ]

  [  ĐĂNG NHẬP  cta 52  ]
  Chưa có tài khoản? Đăng ký
  Quên mật khẩu
  Demo                    ← ẩn khi IME
[ safe bottom ]
```

- **Nút:** Primary = full-width `radius.field` (không pill vàng phát sáng). Secondary = text `lotus`. Disabled = `disabledFill`.
- **Forgot:** Cùng shell; subtitle giải thích “chưa gửi mail trên server”; một field; CTA “Gửi hướng dẫn”; back text, không icon cage.
- **Register:** Hai bước như hiện tại. Nhóm bằng `AuthSection` title `inkMuted` (không rule vàng). Bước 2 skip secondary dưới primary.
- **IME:** Ẩn Demo + subtitle. Title thu nhỏ **chỉ fontSize**, không dịch Y âm. Android resize: dock dính đáy window (đã co).
- **Motion:** Không. Focus = `borderColor: ring`.
- **A11y:** Focus ring 2px `ring`; error text dưới field, không chỉ màu.

---

### B — Cage cinematic nhưng kỷ luật

**Cảm giác:** đêm thi đấu, **một** motif (lồng / góc vuông), không particle.

- **Màu:** Dark-first `bg` `#090A0C`, `surface` `#14161A`. CTA `cta` gold `#C9A86C` / `onCta` `#121316`. `cage` `#D4C4A0` chỉ 1 hairline khung 8pt inset **tắt khi IME**. Light: `cta` đen, `lotus` cho link, không fake octagon.
- **Chữ:** Wordmark display; title Barlow; kicker **tối đa 1** dòng uppercase `lotus` (Lotus Combat) — **ẩn khi IME**. Không slogan dài.
- **Layout:**

```
[ safe ]              [theme]
  ┌─────────────────┐
  │ MMA VISION      │  ← khung 1px line; IME: bỏ khung
  │ ĐĂNG NHẬP       │
  └─────────────────┘
  Email / Password filled surfaceMuted
  [ CTA gold pill ]
  Đăng ký · Quên     (một hàng)
  Demo               (caption, IME ẩn)
```

- **Nút:** Primary pill `radius.pill` + `cta`. Không boxShadow chồng khi IME. Secondary text.
- **Forgot:** Cùng khung; CTA gold; copy pending giữ nguyên (blocked API).
- **Register:** Khung chỉ header; form full width. Section title `lotus` nhỏ — **không** divider full-bleed.
- **IME:** Tắt khung + kicker + Demo. Không compact-title dịch lên status bar. CTA gold vẫn trên IME.
- **Motion:** Chỉ opacity 0→1 khung khi mount **nếu** reduce-motion off. Không Reanimated repeat.
- **A11y:** Không dựa vào gold-only; label + error text. Contrast CTA gold/`onCta` đã có trong palette.

---

### C — Card-on-dark (thẻ hội viên phòng gym)

**Cảm giác:** thẻ nhựa trên nền tối — form nằm trong một `surface` panel.

- **Màu:** Màn `bg` tối; card `surface`; input `surfaceMuted`; viền card `line`; CTA `cta` (dark = gold, light = đen trên card sáng). `lotus` links.
- **Chữ:** Title trong card. Wordmark **ngoài** card, nhỏ hơn A/B để card chiếm giữa.
- **Layout:**

```
[ safe ][theme]
   MMA Vision          (ngoài card)

   ┌──── surface card ────┐
   │ Đăng nhập            │
   │ subtitle             │
   │ [email] [password]   │
   │ [ CTA ]              │
   │ Đăng ký    Quên      │
   └──────────────────────┘
   Demo  (ngoài card, IME ẩn)
```

- **Nút:** Primary trong card, full width card padding 16. Forgot/register một hàng `space-between` trong card.
- **Forgot / Register:** Cùng card; register bước 2 card scroll bên trong, CTA **ngoài** card đáy màn (dock) để IME không nuốt nút Tạo tài khoản.
- **IME:** Card không scale. Window resize; scroll field trong card; Demo + wordmark có thể ẩn; CTA dock dưới card (sibling), không nằm trong ScrollView dài.
- **Motion:** Không. Card tĩnh. Modal hạng cân / ngày sinh giữ RN `Modal` (đã có).
- **A11y:** Card không phải chỉ màu; `accessibilityRole` form implicit via fields. Padding card ≥ 16.

---

## 3. Inventory — chỉ build SAU khi OK + A/B/C

Giữ logic: `signIn`, `register` + `persistSession` + `applyRegisteredSession` + `submitLock`, `BlockedApiNotice` forgot, `enterDemo` trong **một** file xóa được.

| Component | Việc sau approval |
| --- | --- |
| `AuthShell` | Layout đúng hướng; IME matrix; không double padding |
| `AuthTextField` | Filled/outlined theo hướng; label trên; eye 44 |
| `AuthButton` | Hierarchy A vs B vs C (field vs pill) |
| `FighterDemoLink` | Một control; IME ẩn; xóa 1 import login |
| `AuthDateField` / `AuthSelectField` | Chrome khớp field; Modal giữ |
| `AuthSection` | Grouping register theo hướng |
| `AuthFormError` | Static strip, không shake |
| `ThemeToggle` | Giữ góc; không haptic bắt buộc |
| i18n `vi.ts` | Copy theo hướng (kicker chỉ nếu B) |
| `app.json` | Giữ `resize` trừ khi test chứng minh ngược (không đổi trong plan này) |

Không thêm file motion / splash-on-login.

---

## 4. Sẽ KHÔNG làm

- Video splash / Lottie punch trên màn login
- GSAP, Skia, Framer, particle, octagon glow, mesh
- Bốn link demo xếp dọc
- Compact title dịch âm Y dưới status bar
- KAV padding **cộng** Android resize
- `softwareKeyboardLayoutMode: "pan"` cho auth
- Invent REST fields
- Bottom sheet demo (Alert hoặc 1 chip là đủ cho QA)

---

## 5. Gate

**Do not implement until the user replies OK + chosen letter A, B, or C.**

Một hướng duy nhất. Không hybrid “A layout + B glow”.

Approved: **B + overrides** (image bg, no field boxes). Implementation in progress.
