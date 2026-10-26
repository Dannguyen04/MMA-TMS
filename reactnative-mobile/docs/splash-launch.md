# Splash / Loading changelog — MMA-TMS

**Canonical file.** Metro app lives here:

`C:\Users\PHONG\Desktop\Coding_Proj\FPT\Semester_8\Mobile_WDP301\MMA-TMS\reactnative-mobile`

Cursor workspace (`Semester 8` **SPACE**) has **no** `reactnative-mobile`. Agents that edit `Semester 8\...` without this tree are editing the wrong project. JS on device comes from Metro **8081** on this underscore path, not from a “debug APK still has old JS” guess.

**MUST read this entire file before any splash / VideoView / LaunchGate change.**  
**NEVER re-apply a BANNED combo.** Append new work at the bottom; do not delete history.

Related files (typical):

- `src/components/launch/splash-video-player.tsx`
- `src/components/launch/mma-splash.tsx`
- `src/components/launch/launch-gate.tsx`
- `src/components/launch/splash-glass-shatter.tsx`
- `src/components/launch/splash-landing-marks.tsx`
- `src/components/launch/splash-glass-mesh.ts`
- `src/theme/splash.ts`
- `assets/splash/videothanhcong.mp4`

---

## BANNED — never re-apply (checklist)

Tick mentally before writing code. If the idea is on this list, stop.

- [ ] `**expo-av**` / `Video` from expo-av sample — native **JSI crash** (`libexpo-av.so` / RN 0.86). Use `**expo-video`** `VideoView` + `useVideoPlayer` only.
- [ ] Copy **expo-av sample** `Video` API (`resizeMode`, `isLooping` on that component) onto expo-video.
- [ ] Assume **debug APK** already contains the latest JS. Device still loads **Metro `localhost:8081`**. Wrong tree / stale bundler = same UI.
- [ ] Mount **Expo Router `Stack` / screens** while splash overlay is up — **TextureView blanks**. Keep Stack **unmounted** until overlay is gone.
- [ ] Wrap splash in React Native `**Modal**` — Android **TextureView** does not paint; decoder + haptic still run.
- [ ] “Fix” by raising `**z-index**` over a working fighter. Sibling order was not covering a painted video; **VideoView never painted**.
- [ ] Call `**SplashScreen.hideAsync()**` too early (layout-only / fake first frame) → native splash gone → **black gap** before fighter.
- [ ] Animate **SVG `strokeDashoffset` / CrackStroke** without Reanimated 4 `**jsProps`** — strokes **invisible**; shards still drew.
- [ ] Drive an **SVG fill prop (`fillOpacity` / `opacity` on `Polygon`/`Path`) through Reanimated `jsProps`** and expect it to survive. On **Fabric** `jsProps` lands via `setNativeProps`, an imperative shadow-tree override that the **next React commit of that node throws away**, and `PropsFilter.filterNonAnimatedProps` re-applies `animatedProps.initial.value` (captured when the clock was **0**) on **every** render — while `react-native-svg` `extractProps` builds fresh `fill` / `propList` / `matrix` objects each render, so the node is always re-cloned. Measured 2026-09-19: ice cells were opaque (`#aeb9c6`…`#c5d0dc` sampled on device) until the `sheetRelease` re-render, then **luma 202 → 0 in one 33ms frame**; the fly ran its full `shardBreakMs` on fully transparent polygons and the fighter was uncovered for **1.17s**. Cell opacity = `**useAnimatedStyle` on the wrapping `Animated.View`** (native props registry, survives commits); polygon `fill` / `fillOpacity` / `stroke` = **static** props. Also never leave `animatedProps` attached to a CrackStroke after `crackGrowMs` — the same `initial` re-apply would reset `strokeDashoffset` to `edge.length` (hidden).
- [ ] Pass a `**breaking` / `showFacets` React prop**, or unmount the stroke `Svg`, to start/stop the fly. Any of those re-renders the 24 shard hosts at the exact frame the burst begins. Fly = a **shared value** (`flyMs`, elapsed ms) read by `useAnimatedStyle`; shard hosts are `**React.memo`** on a pre-resolved plan; the stroke layer is a **sibling** that **fades** via `useAnimatedStyle`, never unmounts.
- [ ] Fly after an **EMPTY opaque floor** only (`floorPainted`) while real home children are still unmounted, gated to a **second commit**, or only appear on `liveHost` after overlay off. Holes stay `#090A0C`; the burst reads as a flash/jump when the overlay dies. **Also banned:** gate `sheetRelease` on children `onLayout` **without** an already-painted opaque floor — that starved `homeMiddle layout` and flew onto TextureView (home pixels 1.44s later). **Required:** at ice lock fire `onAppCovered` and mount children under ice; empty `homeMiddle` (`palettes.dark.bg`) stays as backup **under** children; wait **homeMiddle AND homeSlot** `onLayout` w/h > 0 + `paintExtraFrames`; **then** `sheetRelease` / fly. If the floor never paints (`floorWaitGiveUpMs`), crude leave — never fly. If children never paint (`homeContentGiveUpMs`), fly over the floor (never uncover TextureView). Never wait 12s. Never `cloneFallbackMs` as a fly trigger.
- [ ] Combo `**useExoShutter={false}` + `contentFit="cover"` + `surfaceType="textureView"**` — `FirstFrameEventGenerator` AR fail → **alpha 0 forever**.
- [ ] Combo `**useExoShutter={true}` + `cover` + `textureView**` — alpha 1 but **ExoPlayer BLACK SHUTTER** stays (no first frame).
- [ ] Put `**VideoView` under `Animated.View**` (even identity `transform` / `opacity: 1`) — **TextureView blanks**.
- [ ] **CASE C:** `**surfaceView` + parent/`VideoView` `backgroundColor: #000`** — SurfaceView draws **behind** the RN view tree → **covered black**; **haptic still runs**. Do not “fix” by putting SurfaceView under a black View.
- [ ] Crude **SVG zigzags**, **cyan placeholder**, unprofessional overlay pretending to be glass. User rejected **fake glass**. Do not invent new crack drawings.
- [ ] **BANNED stills for effects:** **PNG / WebP / JPEG** (and `Image` + `require(...)` of those) as **splash / kính / crack / shatter / loading** overlays. **CẤM PNG/ảnh tĩnh** cho hiệu ứng. Do **not** use `glass-shatter-overlay.png`. Effects = **Reanimated + SVG/vector** (or **motion video**). Fighter splash **VIDEO** (`videothanhcong` / `splash_loop`) is **not** this ban — that is motion video, **allowed**.
- [ ] Fake **1500ms** (or any hardcoded) stats / ready timer instead of real `**LaunchGate` `isDataReady`**.
- [ ] Show glass overlay **before punch** (before ~**1.0s** / `hapticAtMs`).
- [ ] **Zoom 6–8** through the crack / flying shards (`breakAway`) / scale-expand of a **full-screen opaque still**. User reverted to **stroke cracks only**.
- [ ] Edit splash in Cursor workspace **SPACE** path thinking it is Metro.
- [ ] Gate punch / SVG cracks / `onImpact` on `onFirstFrameRender` / `paintedFrame`. `FirstFrameEventGenerator` often never fires → 9s black, no cracks. Punch follows `timeUpdate >= 1000ms`.
- [ ] Gate intro **two-panel shutter wipe** on `timeUpdate > 0` then run `**introWipeMs` 180** with `Easing.out` — wipe starts late (video already showing) and finishes off-screen in ~180ms → **hard POP**, no visible split. Hold closed **120–150ms from overlay mount**, wipe **~400–450ms**.
- [ ] Treat JS `onFirstFrameRender` / `firstFrame` log as **visible pixels**, or call `onFinish` in the **same JS turn as punch** (`withTiming` to a value already reached → 0ms callback). Metro can log `firstFrame → punch → onFinish cinematic → launchGate` while the screen is empty.
- [ ] Delay `**SplashScreen.hideAsync()**` until punch / `onFirstFrameRender` while Expo native splash is opaque **black** (deleted image, plugin still `#000`). Overlay **covers VideoView + SVG**; JS logs still fire. Hide on **RootLayout / first RN frame**. Do **not** restore Expo logo splash.
- [ ] At punch, `**withTiming` overlay opacity 0→1** while the crack `Animated.View` is **not yet mounted** (`hasPunchFinished` after `setState`). Shared-value fade never paints; haptic still runs → **black hold, no cracks**. Set overlay **opacity 1 immediately**.
- [ ] Treat `**StatusBar.setHidden(true)**` (app bar slides up) as proof the **fighter video** is playing.
- [ ] **Layout crop** `VideoView`: scale > 1, negative `left`/`top`, parent `**overflow: hidden`** — Android **TextureView blanks** (decoder/haptic still run). Fill fullscreen until crop is proven without transforming/clipping the surface.
- [ ] `**player.loop = true**` on splash fighter — native loop restarts **the whole file at t=0** (intro seconds), not the punch-tracking tail. Tail loop = **seek** to `max(0, duration − videoTailLoopMs/1000)` on leave-window / EOF. `currentTime = 0` only if duration < tail.
- [ ] Android **`react-native-svg` `ClipPath` + animated `Circle` `r`** (`jsProps` / Reanimated) — clip often **stays 0** or never re-paints → **zero visible veins**. Not Mask/ClipPath r. Not PNG.
- [ ] **Circular overflow `View` / growing disc** as “field spread” (borderRadius hole clipping the SVG). Looks like a **blob/window**, not **individual rays**. Spread = **per-ray `strokeDashoffset`**. Not a ballooning `strokeWidth`.
- [ ] Unmount **VideoView in the same beat as fading the ice sheet** — TextureView teardown **blits the last fighter frame** then home. Sandwich: **pause**, keep VideoView **mounted under the opaque app**, unmount video only on `onFinish` (app already covering).
- [ ] Put **VideoView and ice in the same overlay ABOVE the app**. Clearing ice then reveals TextureView, not home. After ice opacity 1: **bottom** video, **middle** opaque app/skeleton (`onAppCovered`, Android **elevation**), **top** puzzle shards only.
- [ ] Keep a **full-screen ice sheet / SVG fill lock** during the fly — flying copies stay invisible; overlay then snaps off. Visible ice at break = **mesh face hosts** only (holes = app).
- [ ] Mount **~24 FacetShard `Animated.View`s at punch** as a fly-start burst (JS hitch ~2s). Fill hosts mount at **`showFacets`** (or punch with fillOpacity 0 if that hitchs) — **one** host set. Never a second clone at lock.
- [ ] Two-phase ice: cheap **FacetFill** SVG (+ fan-cover rect) then **unmount** and **`shardClone` / `shardsMounted`** a second FacetShard tree at cover — hitch + flash (two screens). Faces at ice lock **are** the fly hosts.
- [ ] Ice break via **three.js / expo-gl / R3F / WebView 3D**. Break = Reanimated `perspective` + `rotateX`/`rotateY` on SVG polygon hosts **not wrapping VideoView**. No `translateZ` (RN crash). `rotate*` as `` `${n}deg` ``.
- [ ] Drop the ice sheet / SVG fills in the **same tick as `onAppCovered`** (or 2 rAF later, before Stack/skeleton + FacetShards paint). Holes read **TextureView** → fighter flash at ~14.9s. Wait for opaque app in the tree, **keep the same fill hosts**, then drop sheet.
- [ ] Treat **2 rAF + `appLayer != null`** as a painted middle layer. Clip: ice lock ~15.5s then **fighter** at ~15.6 / ~16.7 through shard gaps. Need **onLayout w/h > 0** plus extra frames after skeleton is in the tree.
- [ ] Skip LaunchGate hang because **`appUnderGlass`**. Clip ~17s **black empty + Android status bar**, no dashboard, cannot enter app. Secondary timeout after lock must force **live**.
- [ ] `hideSvgIce` / drop sheet before FacetShard hosts cover the frame. Gaps must never read VideoView (pause + unmount TextureView **under opaque sheet** if z-order still loses).
- [ ] `**setCinematic(false)` while `keepVideo` is still true** — overlay gone, TextureView or black `SplashFallback` is the frame (naked fighter / ~0.7s black hole).
- [ ] Unmount **VideoView on the ice-lock beat** (before sandwich Bones `onLayout` w/h > 0). Pause only; video stays under opaque sheet then sandwich.
- [ ] Treat `**shardCoverSettleMs` / +180ms** as cover if FacetShard hosts have **not** laid out. Settle starts **after** real cover.
- [ ] `**StatusBar.setHidden(false)`** in `enterLive` / `lockLeaveTimeout` **before** Stack `onLayout` w/h > 0 — status bar on **black**, then dashboard.
- [ ] Same commit: **video die + overlay die + Stack not painted** with no covering sandwich. Keep Bones until live host lays out.
- [ ] Gate `shardClone` on LaunchGate **`livePainted`** / homeSlot `onLayout` of the live host. Under-ice home does **not** log livePainted; clone from **`homeMiddle` onLayout** (short fallback — not 12s).
- [ ] Reset FacetShard laid-out ids when fill hosts mount (clears onLayout that already ran → never `iceHostsReady`).
- [ ] `startShardFly` / hang-after-lock fly with **zero hosts** or before every host `onLayout`. Do not clone a second tree to “fix” empty fly.
- [ ] LaunchGate **hang `enterLive`** / unmount `MmaSplash` while ice-lock cinematic (`homeUnderIce` / overlay). `lockLeaveTimeout` must **not** start at `onAppCovered`.
- [ ] Treat **2 rAF** after `sheetRelease` as painted cover. Cover = shard hosts + `paintExtraFrames`.

---

## REQUIRED — current constraints (desired spec)

- Playback: fighter **visible 0–1.0s** of `videothanhcong.mp4` (intro punch). Do not skip to home on a black TextureView.
- Punch **origin = 80% × 40% of SCREEN** (`splash.punchScreenX` / `punchScreenY`), not a video-cover remap unless re-specified.
- At punch: **organic SVG crack LINES** (VEINS fan) at origin (`punchScreenOrigin` via `punchScreenX` / `punchScreenY`). Overlay **opacity = 1 immediately** (do **not** `withTiming` 0→1 on an overlay that is not mounted yet). High-contrast **white/light** strokes on black (never black-on-black), non-zero width, `pointerEvents="none"`, sibling **above** video and **above** black, not clipped, not scale 0, **not** gated on `onFirstFrameRender`. **No** flying shards, **no** zoom-6 through crack, **no** PNG/`Image` overlay.
- Spread = **từng tia**: each ray **grows from punch origin** via `strokeDashoffset` + Reanimated 4 `jsProps` over `**crackGrowMs**`. **Not** a circular overflow View. **Not** ClipPath `r`. **Not** strokeWidth balloon.
- After mesh **edges** have drawn (`crackGrowMs`): **the same mesh `FacetShard` hosts** fade in over `facetFillMs`. Each cell clips a **center-stack poster** (`SplashLandingMarks`: light ice-gray `#c5d0dc` `Rect` matching `splash.glassFillColor`, app icon `assets/splash/brand-mark.png` as **PAGE LOGO only** ~108px — **not** shatter overlay / **not** `glass-shatter-overlay.png`, `MMA VISION` Barlow 72 ink `#090A0C`, slogan `vi.brand.slogan` brown `#6B5428`, overlay W×H — **not** a Dashboard clone; **no** ThemeToggle/card/login/academy; **no** LogoMark lotus-octagon on glass) with a **static** `ClipPath` `Polygon` (`plan.points` — **never** `Circle` `r`). Rim `Polygon` is **outside** the clip (`fill="none"`, stroke `#eef4f8`). **`FACE_FILLS` ice greys are unused as ice paint** (sheet is the light gray Rect). Host **opacity lives on the wrapping `Animated.View` via `useAnimatedStyle`** driven by `fillClock`. **Never `jsProps` on an SVG fill prop** (Fabric re-render wipes `setNativeProps` and `PropsFilter` re-applies `initial` 0 — see BANNED). Not ViewShot, not a cheap `FacetFill` clone. CrackStroke SVG is **strokes only**, a **memo'd sibling** of the shard layer. **Then** a backup sheet **View** (`splash.glassFillColor` `#c5d0dc`, **same as poster Rect**, not `#090A0C`) may ramp (`glassCoverMs`) **under** those faces to opacity 1 and **lock**. Dashboard under ice stays `palettes.dark.bg`. **Do not pause** VideoView. Tail-loop (`duration − videoTailLoopMs`) until `onFinish`. At the lock, fire `onAppCovered` immediately so **LaunchGate children** mount under the ice (`isDataReady` does **not** delay). Empty `homeMiddle` (`palettes.dark.bg`) stays as backup **under** those children — never the fly reveal by itself. Wait **homeMiddle AND homeSlot** `onLayout` w/h > 0 + `paintExtraFrames` (`floorPainted` + `homePaint settle`) **and** `**glassHoldMs` 300** after `glassCovered` — fly = **max(hold elapsed, paint ready)**; do **not** fly the instant the floor paints if the hold is still running. **No first-launch AsyncStorage skip** — same cinematic every cold start. **Not** `DashboardSkeleton` sandwich / Bones. **No `shardClone` second tree.** Hosts exist from **punch**; wait **every** host `onLayout` w/h > 0 (`iceHostsReady`) **and** `floorPainted` **and** home children painted **and** the glass hold. **Then** `sheetRelease`: drop the sheet and **fade** the stroke layer via `strokeFade` (**never unmount it** — that re-render blanked the cells). **Then** **those same** hosts fly on the `**flyMs`** shared value (**never** a `breaking` React prop): ease-**out** (`shardEasePower`) so the piece moves on frame 1, radius stagger `shardStaggerMs`, Reanimated `perspective` + `rotateX`/`rotateY`/`rotate` as `` `${n}deg` `` + translate from punch + `scale`, fade from `shardFadeStartRatio` over `shardFadeMs`. `FacetShard` is `React.memo` over a pre-resolved plan so **nothing re-renders during the cinematic**. Overlay during fly is **transparent except shards** — **no** `glassFill` / SVG ice on top of flying pieces. Holes reveal **already-painted MMA Vision home**, never fighter, never empty `#090A0C` wait, never a later liveHost swap. If the floor never paints (`floorWaitGiveUpMs`), take the **crude leave** — never fly. If children never paint (`homeContentGiveUpMs`), fly over the floor (never uncover TextureView). Unmount VideoView only with the cinematic overlay on **`onFinish`** (video off first under the opaque floor, extra paint frames, **then** overlay off). **No** zoom-6, **no** overlay scale shatter, **no** three.js, **no** `translateZ`. **Do not** wait on `**isDataReady**`. **No** `crackLayer` scale 1.2.
- **P0:** Stack / home **unmounted** while rays+faces still show the fighter. Mount main **only after** the ice sheet is locked opaque — **between** VideoView and shards. Cover = **mesh faces + sheet**, not stroke density. Paint gates = `onLayout` w/h > 0 **AND** `paintExtraFrames` (not 2 rAF).
- **Haptic once** at **`hapticAtMs` 2000 video-timeline ms** (`player.currentTime * 1000 >= hapticAtMs`), wrapped in **try/catch**. Fighter `playbackRate` **2** (`splash.videoPlaybackRate`). Punch **frame** is still ~2.0s PTS in the MP4 (~**1.0s wall** at 2×). Do **not** treat `hapticAtMs` as wall clock.

- Architecture like sample LoadingScreen: **expo-video**, **not expo-av**; **do not wrap `VideoView` in `Animated.View`**; SVG overlay delayed until punch — **vector/Reanimated, never a still photo**.
- **Android current combo:** `surfaceType="textureView"` + `contentFit="fill"` + `**useExoShutter={true}`** (alpha 1 with FILL; **cover+true still BANNED**). Transparent `VideoView` / `videoLayer` / overlay host. `**#000` only on LaunchGate root** and a **sibling behind video while video is mounted**. After ice lock z-order: **(1)** FacetShards only on top (transparent overlay except pieces); **(2)** crude home children opaque, Android elevation above video; **(3)** fighter **still playing** tail loop until `onFinish`; **(4)** root `#000`. Stack **unmounted until glass cover** (`onAppCovered`); home lives **inside** `MmaSplash` between video and ice until P3 `onFinish`. Punch from `timeUpdate >= hapticAtMs` — **not** gated on firstFrame. **Do not treat `StatusBar.setHidden` (app-bar slide) as video success.** After punch: overlay **opacity 1 immediately**; vein grow `**crackGrowMs`** then faces `**facetFillMs`** then sheet `**glassCoverMs`** lock. `isDataReady` must **not** freeze cinematic. `onFirstFrameRender` is **not** a painted-frame leave signal. Hang **`splashHangMs`**. Glass overlay **after punch only**. VideoView **not** under `Animated.View`. Do not block mount on layout size (384×832 was already non-zero). `**SplashScreen.hideAsync()` on JS RootLayout / LaunchGate mount + first RN `onLayout` — do not wait for punch, firstFrame, or video.** Native/expo splash after splash images were deleted is still a full-screen overlay until `hideAsync`; Metro logs still run underneath. `AppTheme` / `Theme.App.SplashScreen` `windowBackground` is **transparent** (not a second black OS splash). JS fighter + SVG cracks remain the cinematic. Hang + `lockLeaveTimeoutMs` after lock **must force live** if overlay stuck. Do **not** skip hang for home-under-ice. `StatusBar` after live host painted + extra frames, not on black.
- `contentFit="cover"` remains **banned** with TextureView until proven on device (AR / first-frame generator).
- Do not implement speculative SurfaceView-under-black again. Another agent may iterate SurfaceView **only** without RN `#000` covering it — still log here first.

---

## HOW TO APPEND

After every splash change, add a dated block (do not rewrite old entries):

```
### YYYY-MM-DD — short title
- Files: path/to/file.tsx
- What: one paragraph
- Why: user / device evidence
- Result on device clip: PASS / FAIL + what was visible (fighter? black? haptic? shatter?)
- If FAIL: add a BANNED bullet if a new combo died
```

### 2026-09-19 — Shards had ZERO pixels: jsProps fill wiped at sheetRelease; opaque floor gates the fly
- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `docs/splash-launch.md`
- **Measured beats (device clip @30fps, recording clock):** punch **5.23s** (chest luma 104→230) · cracks grow **5.53–5.72** (dashoffset/jsProps works) · facet fill window **5.65–5.93** with corner patches still **luma 0–10** (cells contributed nothing; only the sheet ramp read) · single ramp 0→**202** over **5.93–6.10** · ice 100% and **13 pixel-identical frames** 6.10–6.50 (400ms frozen) · **6.53 one frame: luma 202→0**, all ice gone, **no intermediate displaced frame at all** · **6.53–7.70 = 1.17s of fully uncovered fighter** · 7.73–7.93 ≈200ms flat `#090A0C` · home header at **7.97** (first home pixels, 1.44s after the ice died). Facets *were* opaque before the cut — sampled `#AEB7C5` / `#B2BECB` / `#B9C1CD` / `#C1CAD4` / `#C5CEDB`, i.e. all five `FACE_FILLS`. `shardBreakMs` **did** fully elapse (sheetRelease→video-off 1.17s vs ~0.98s budget), so lifetime was never the bug — **visibility** was.
- **What (Metro JS only):** (1) **`jsProps` removed from the fill path.** `AnimatedPolygon` deleted; `Polygon` now has **static** `fill` / `fillOpacity={1}` / `stroke` / `strokeWidth`. Cell opacity + fly transform are **one `useAnimatedStyle`** on the wrapping `Animated.View` (native props registry survives React commits). `jsProps` kept **only** for `CrackStroke` `strokeDashoffset`, and that `animatedProps` is **detached** (same element, props change in place — no node churn) once the grow is done so a later commit cannot reset the dash to `edge.length`. New exported `shardCellOpacity()` is the single source of truth for the probe. (2) **No shard re-renders:** `FacetShard` is `React.memo` over a pre-resolved `ShardPlan` (bounds, viewBox, radius stagger, targets) built once per mesh; `breaking` / `showFacets` / `hideStrokeSvg` props are **gone**; fly is the shared value `**flyMs`** (elapsed ms, `Easing.linear` over `splashFlyClockMs`); ice-in is the shared value `**fillClock`**; strokes moved to a memo'd **sibling** `CrackStrokeLayer` that **fades** on `**strokeFade`** and is never unmounted. (3) **Per-shard static rim** `#eef4f8` @1.4 with hosts inflated by `SHARD_PAD` 3 so the rim is not clipped — every flying piece keeps its own outline. (4) **Opaque floor gates the fly:** `glassCovered` → `glassLockDelayMs` → mount `homeMiddle` **EMPTY** (`palettes.dark.bg`, no children) → its `onLayout` w/h > 0 → `paintExtraFrames` → `floorPainted` → `onAppCovered` (LaunchGate mounts children in a **second** commit) and `appPaintSettleMs` 48 + `shardCoverSettleMs` 64 → `sheetRelease`. `startShardFly` **refuses** to run without `floorPainted`; new `**floorWaitGiveUpMs` 900** watchdog takes the **crude leave** (sheet stays up → video off → overlay off) instead of an empty fly; `cloneFallbackMs` is now only the *partial ice host* net, never a fly trigger. (5) **Motion legibility:** `shardBreakMs` **520→820**, worklet ease-**out** `1-(1-t)^2.4` (`shardEasePower`) so the piece moves on frame 1, radius stagger `**shardStaggerMs` 180** (inner cells first), fade start `**shardFadeStartRatio` 0.82** + `**shardFadeMs` 190` (ends ~with the travel, not 140ms past it), dist `200 + len*0.52`, pitch 54 / yaw 64 / spin 26 / scale 1.26, `perspective` kept, **no `translateZ`**. Frozen hold trimmed from ~400ms to ~310ms and it is now deterministic (floor paint, not a timer). (6) **Chrome:** `darkenSystemChrome()` at `sheetRelease` (`SystemUI` + `NavigationBar.setStyle("dark")`) and again on `enterLive` — the nav bar no longer stays ice-light for 1.2s over black. (7) **Probe logs:** every beat logs `+Xms` from `punchAnchor`; `probe sheetRelease` / `probe shardBreak` / `probe shardBreak+160` / `probe flyEnd` print `fillClock`, `flyMs`, **`cellOpacity`**, `strokeFade`; `keepVideo off` prints `floorPainted` + `sheetUp`; LaunchGate prints `livePainted +Xms` / `liveReveal +Xms` from `onFinish`. Video untouched (no pause, tail wrap unchanged, `textureView` + `fill` + `useExoShutter true`). No Bones/DashboardSkeleton reveal, no PNG, no ClipPath r / disc, no zoom-6, no three.js/expo-gl, no CASE C, no `player.loop`, no VideoView in `Animated.View`, no 2 rAF as a painted gate, no unmount mid-fly.
- **Why:** User: “still NO visible glass cells bursting outward.” Frame-by-frame proved the hosts were flying with fully transparent content and that nothing was painted behind them.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Pixel acceptance criteria:** (a) ≥**8 consecutive 30fps frames** where 3 fixed screen points change colour frame-to-frame (pieces really moving); (b) ≥1 frame with a **dark hole** (luma < 30) surrounded by **ice grey** (luma > 170); (c) **zero** frames between `sheetRelease` and `onFinish` showing the fighter (cyan test `B − R > 40` in the fighter region); (d) no flat-`#090A0C` stretch longer than ~100ms between `overlay off` and home content; (e) the cell ice-in is **progressive** (corner luma rises over ≥5 frames), not a snap; (f) `probe shardBreak+160` logs `cellOpacity` **1.0**, not 0. **Expected log order:** `punch` → `punchAnchor +0` → `iceHostsLaidOut all 24/24` → `iceHostsReady ~+30` → `facetsFill +420` → `glassFillRamp +740` → `glassCovered +920` → `floorMount +984` → `floorLayout ~+1000` → `floorPainted ~+1135` → `onAppCovered ~+1140` → `sheetRelease ~+1250` (`probe cellOpacity 1.0`) → `shardBreak ~+1385` → `probe shardBreak+160 cellOpacity 1.0` → `probe flyEnd` → `keepVideo off cinematic ~+2610 floorPainted true` → `overlay off ~+2745` → `onFinish` → `livePainted +Xms` → `liveReveal +Xms`.
- **If FAIL:** do **not** put `fillOpacity` back on `jsProps`, do **not** reintroduce a `breaking` React prop, do **not** unmount the stroke layer at `sheetRelease`, do **not** fly without `floorPainted`, do **not** gate on the real home children's `onLayout`. If `cellOpacity` is 1 at `shardBreak+160` but the burst is still hard to read, tune **only** `shardBreakMs` / `shardStaggerMs` / `shardEasePower` / `dist` — the wiring is proven at that point. If the residual `#090A0C` gap is still > 100ms, the next lever is hoisting the home host **out of** the LaunchGate `overlay → live` phase switch (children currently remount from `homeSlot` into `liveHost`); do not attack it with skeletons.

### 2026-09-19 — Uncover shard fly: sheet under shards, overlay not dropped on video
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Fly was hidden by `glassFillLock` **elevation 20** above `crackLayer`, then `setOverlayAlive(false)` **while `keepVideo`** (fighter blit). Hang after ice lock called `finishCinematic` and tore overlay onto TextureView. **Fix:** sheet **below** crackLayer; lock **elevation 0**; shards `elevation 24` when mounted. `sheetRelease` then **2 frames** then `breaking`. `finishToApp`: **`keepVideo` false first**, extra paint frames, **then** overlay off, then `onFinish`. Hang after lock **forces shard fly**, does not drop overlay onto video. Shard fade starts at **72%** of `shardBreakMs` so pieces stay visible. `lockLeaveTimeoutMs` **8000**. Video **not paused**. No Bones sandwich. No `translateZ`. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User audit: first-update fly existed; UI fixes covered/deleted it and flashed fighter.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect ice lock → **pieces fly outward** over crude home → overlay gone → MMA Vision. No 0.1s ice vanish onto fighter.
- **If FAIL:** do not restore sheet elevation 20 above shards; do not `setOverlayAlive(false)` while VideoView is still mounted as the uncovered layer.

### 2026-09-19 — Clip 13–18s: pause then Bones then sheet-covered video teardown
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/dashboard-skeleton.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Clip FAIL 13–18s: ENTER APP ~17.2s MMA VISION **kept**. Cinematic FAIL: ~14.8 **full fighter** after ice lock, ~0.7s **black hole**, ice pop-back, shard gaps **#000** not Bones, status bar on black then dashboard. Cause: VideoView unmount + overlay/sandwich drop too early; TextureView blit; skeleton not painted under holes. **Leave order (JS only):** ice **plain View** opacity **1** stays → **pause** decoder (**do not** unmount VideoView on that beat) → middle **DashboardSkeleton** `variant=sandwich` (`sandwichFill` / `sandwichBone`, not Bone-less `#090A0C`; elevation above video, below sheet) → wait **onLayout w/h > 0 AND extra frames** + `appPaintSettleMs` → unmount VideoView **only while sheet still opacity 1** → wait `**videoTeardownMs` 220** (ice still visible, no black) → clone `FacetShard` `fly=false` until **every host** onLayout w/h > 0 (`shardCoverSettleMs` **after** real cover; **no** 64ms fallback-as-cover) → `hideSvgIce` + drop sheet (holes = Bones, not video, not `#000`) → fly (sandwich **stays**) → **always** `onFinish` → live. **Never** `setCinematic(false)` while `keepVideo`. Unmount VideoView only after overlay-covered teardown (under sheet) or, at hang, one frame under still-up ice then parent live. LaunchGate: **no Expo Stack** while overlay/cinematic; hang **never skipped** for `appUnderGlass`; `lockLeaveTimeoutMs` forces live but **does not** unhide StatusBar; sandwich cover until live host onLayout w/h > 0 + extra frames (`liveReveal`) **then** StatusBar. Keys: `videoTeardownMs`, `appPaintSettleMs`, `shardCoverSettleMs`, `leaveAfterBreakMs`, `lockLeaveTimeoutMs`, `sandwichFill`, `sandwichBone`. **No** PNG. **No** VideoView in `Animated.View`. **No** ClipPath r. **No** zoom-6. **No** `translateZ`. **No** three.js. **No** CASE C. **No** Stack while overlay. **No** `player.loop` / full-file `currentTime=0`. Combo: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User OK’d 13–18s clip plan. Prior 11–18s unmounted TextureView at lock (fighter blit + black) and unhid StatusBar on `enterLive` before Stack painted.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect ice lock → no fighter flash → Bones through flying shard holes → overlay gone → dashboard/Stack. Never stuck black at ~17s. ENTER APP ~17.2s MMA VISION unchanged in intent (always onFinish → live).
- **If FAIL:** do not drop sheet before shards cover; do not unmount video without sheet-on-surface; do not `setCinematic(false)` while `keepVideo`; do not mount Stack under overlay; do not skip hang on `appUnderGlass`; do not unhide StatusBar on black; do not wrap VideoView.

### 2026-09-19 — Clip 11–18s: skeleton-only holes, unmount video under sheet, always enter app
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Clip FAIL 11–18s: ice lock ~15.5 → **full fighter** ~15.6 and ~16.7; shard gaps showed fighter not app; ~17s **stuck black** + status bar, no dashboard. **Leave order (JS only):** ice opacity **1** and **keep sheet opaque** → pause VideoView → **unmount VideoView under the sheet** → wait `**videoTeardownMs` 220** → middle = opaque **DashboardSkeleton** + solid `#090A0C` View (**no Expo Stack** while overlay is up) → wait **onLayout w/h > 0** + extra frames + `**appPaintSettleMs` 80** (not 2 rAF + non-null layer) → clone `FacetShard` `fly=false` **under** the sheet until hosts cover → `hideSvgIce` + drop sheet → `overlayStack` `pointerEvents="none"` → fly (`shardBreakMs`; holes = skeleton) → `**leaveAfterBreakMs` 180** → **always** `onFinish`: overlay off **first**, then video. LaunchGate: Stack mounts **first time overlay is GONE**; `SplashLock` unlocks on `live`; hang **never skipped** for `appUnderGlass`; `**lockLeaveTimeoutMs` 2400** after `onAppCovered` forces live if still overlay. `glassLocked` does not block hang leave. Keys: `appPaintSettleMs`, `shardCoverSettleMs`, `leaveAfterBreakMs`, `lockLeaveTimeoutMs`. **No** PNG. **No** VideoView in `Animated.View`. **No** ClipPath r. **No** zoom-6. **No** `translateZ`. **No** three.js. **No** CASE C. **No** `player.loop` / full-file `currentTime=0`. Combo: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User OK’d 11–18s clip plan. Prior sandwich trusted 2 rAF + mounting Stack under overlay (blanks TextureView / never showed home) and skipped hang after lock.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect ice lock → no fighter flash → skeleton through flying shard holes → overlay gone → dashboard/Stack. Never stuck black at ~17s.
- **If FAIL:** do not drop sheet before shards cover; do not mount Stack under overlay; do not skip hang on `appUnderGlass`; do not leave TextureView readable through gaps; do not wrap VideoView.

### 2026-09-19 — Sandwich: app then shards then sheet drop (clip 14.9 fighter)
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Clip FAIL 14s–19s: ice opaque ~14.8 then gone in ~0.1s showing **fighter** (not app); almost no shards; one polygon stuck at punch; ~16.9 black to 19s. Cause: `cloneThenFly` ran in the **same timeout as pause + `onAppCovered`**, dropped sheet/`glassFill=0` after 2 rAF **before** Stack/skeleton painted, overlay ice sat **above** TextureView so holes = fighter. FacetShard used dual `translateX` (cx then −cx) on a fullscreen SVG host → leftover polygon at origin. **Fix (JS only):** lock ice at 1 (no fade). Pause VideoView; **do not unmount** TextureView at lock. `onAppCovered` mounts opaque Stack + **DashboardSkeleton** (elevation above TextureView; `isDataReady` does not hold or drop ice). Wait **2 frames** after `appLayer` exists. Clone mesh `FacetShard` hosts (`fly=false`) **under** the sheet. When puzzle is up: hide SVG fills + unmount sheet (overlay transparent except shards). Then fly: `perspective` + `rotateX`/`rotateY`/`rotate` as `` `${n}deg` `` + translate from punch + fade (bbox hosts, **no** dual translateX, **no** `translateZ`). `onFinish`: unmount overlay **then** video. LaunchGate hang does **not** cut after `appUnderGlass`. No PNG. No VideoView in `Animated.View`. No ClipPath r. No zoom-6. No three.js. No CASE C. Combo: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User OK’d clip-review plan. Device: ice vanished onto fighter; hang then black.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect ice lock → pause (fighter stays hidden) → opaque home/skeleton → shards under sheet → sheet off → shards fly over app, never fighter, no black 17–19s.
- **If FAIL:** do not drop sheet before shards cover; do not unmount TextureView at lock; do not put video+ice above the app; do not treat ice-gone as cinematic done.

### 2026-09-19 — Video teardown wait then Reanimated 3D ice break
- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/launch-gate.tsx`, `docs/splash-launch.md`
- **What:** Flash after sheet opacity 1 was last fighter frame then home: TextureView unmount / sheet fade in the same beat. **New order (JS only):** rays → faces → sheet lock opacity **1** → **pause** (`haltPlayback`) **then unmount VideoView** while sheet **stays opaque** → wait `**videoTeardownMs` 150** → `**onAppCovered`** (Stack / DashboardSkeleton under overlay; `isDataReady` does not hold) → `glassHoldMs` → mount shard `Animated.View`s **only at break** → Reanimated `perspective` + `rotateX`/`rotateY` + modest translate from punch + fade, sheet opacity 0 in sync → `onFinish`. Mesh faces unchanged. **No** VideoView in `Animated.View`. **No** PNG. **No** ClipPath r / disc. **No** zoom-6. **No** three.js / expo-gl / R3F / WebView 3D. **No** CASE C. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. Transparent VideoView; `#000` sibling behind video / LaunchGate root only. `shardBreakMs` **520** kept.
- **Why:** User: after ice 1, last fighter frame then home. Unmount and sheet fade must not share a beat; video must be gone before holes open.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect ice lock → no fighter flash → home/skeleton under glass → modest 3D shard break revealing app, never video.
- **If FAIL:** do not unmount VideoView while fading the sheet; do not leave VideoView under a transparent overlay during break; do not restore zoom-6 or three.js.

### 2026-09-19 — Post-crack stall: pre-mount ice fills, keep tail playing
- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** Cause of ~2s khựng + fighter loop stop: after last ray, `showFacets` **inserted** a burst of native overlay nodes in one JS commit (originally ~24 full-screen `Animated.View`+`Svg` shards; even in-Svg `FacetFill` mount-at-`showFacets` still hitchs TextureView so `timeUpdate`/tail wrap freeze). **Fix (Metro JS only):** ice polygons + backup cover **already in the stroke Svg from punch** at `fillOpacity` 0; `showFacets` only runs `fillClock` (no new hosts). Cover `delay` **0.88** so the full-rect ice does not hide the tail during cell fill; `fillClock` still forced to **1** after `facetFillMs` (sibling: all faces ice, never `#000`). Per-face `Animated.View` shards still **only at `breaking`** (video already unmounted). VideoView unmounts only on `glassLocked`. `playingChange` keep-alive wraps tail near EOF (**no** `player.loop`, **no** `currentTime=0` of the full clip). **Did not revert** origin-only spokes / ice `FACE_FILLS` in `splash-glass-mesh.ts`. No PNG. No VideoView in `Animated.View`. No ClipPath r. No zoom-6. No CASE C. `isDataReady` does not hold. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: after cracks finish, ~2s freeze until glass opacity 1; fighter tail loop also stops.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect last crack → ice cells fill while fighter **keeps looping** → sheet to opacity 1, no 2s still frame.
- **If FAIL:** do not remount FacetShard `Animated.View`s at `showFacets`; do not unmount VideoView before `glassLocked`; do not mount Stack to “fix” the hitch.

### 2026-09-19 — Origin-only crack grow + all ice faces opaque
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** (1) **Premature cracks:** mesh no longer dashoffset-animates inner-ring / outer-radial / perimeter segments on their own clocks (those started at inner vertices so a crack popped mid-screen before the punch wavefront). Visible strokes are **origin→rim** polylines (`radInner` chained with `radOuter`, 2–4 kinks kept). Shared `growClock`; `grow` ∝ path length so tips advance from the punch; delay-by-distance is unused except all rays **start at origin**. Ring edges still exist for **face vertices** but are **not stroked**. No ClipPath r / disc / PNG / zoom-6. (2) **Black cells:** per-face `Animated.View` SVG layers left most polygons at opacity 0 → LaunchGate `#000` through holes. Faces now fill in **one** SVG via Reanimated 4 `jsProps` `fillOpacity`; after `facetFillMs` **force every face (and a full-rect ice cover) to 1**. Outer faces use the **true rect edge** (not inward-jagged ring1) so the fan covers the frame. Fills = ice greys near `splash.glassFillColor` (`#b8c3d0`), never `#000`. Sheet sibling stays ice at lock. Sequence unchanged: rays → faces → sheet → mount → break. `crackGrowMs` **420**. `isDataReady` does not hold. VideoView **not** under `Animated.View`. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: cracks appear before the ray reaches that cell; only ~3 facets ice, rest black (not glass).
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect veins growing **out from the fist**, then **all** ice polygons opaque, then sheet lock — no mid-screen premature segments, no black holes.
- **If FAIL:** do not restore independent `ring0`/`r1` dashoffset clocks, per-face Animated.View fills, ClipPath r, PNG, or CASE C.

### 2026-09-19 — Jagged mesh + tail until glass lock + no bezel rim stroke
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** (1) Mesh edges are no longer one `L` (origin→inner→rim pizza). Each shared edge is a **polyline with 2–4 kinks** (sharp/flat/oblique); **faces use the same vertices** so fills do not leak. Outer ring still the **screen rect** (corners included). Dashoffset grow from punch origin, Reanimated 4 `jsProps`. **No PNG. No ClipPath r / overflow disc. No zoom-6.** (2) Fighter **keeps looping** through ray grow + facet fill; `VideoView` unmounts only after `glassLocked` (`glassFill` forced to **1** + lock View). Tail wrap: still **no** `player.loop`, **no** `currentTime=0` of the full clip. Wrap-early `**videoTailSeekLeadSec` 0.62** + anti-hammer `**videoTailSeekCooldownMs` 320** (playable wrap = `videoTailLoopMs` − lead). (3) Do **not stroke** `ring1-*` / rect-perimeter edges; no `#eef4f8` on the bezel. Faces still fill to the edge. Sequence unchanged: rays → faces → sheet lock → mount app under → shard break. `crackGrowMs` **420**. `isDataReady` does not hold. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. VideoView **not** under `Animated.View`.
- **Why:** User: straight radial rulers; loop hitch (seek/unmount too early); white glass frame on phone edge.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild unless baked `res/raw/splash_loop.mp4` must change). Expect jagged ice cracks, fighter motion until opaque sheet, no white rim on bezels.
- **If FAIL:** do not restore straight `L` mesh, ClipPath r, PNG, `player.loop=true`, or perimeter `#eef4f8` strokes. Tune `videoTailSeekLeadSec` / `videoTailSeekCooldownMs` only.

### 2026-09-19 — Pre-authored mesh: rays → faces → sheet → mount → shard break
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User: covering the fighter with more SVG **strokes** is not feasible (gaps + 1280ms too slow). New sequence: **mesh** from punch origin — **edges** = dashoffset rays (`crackGrowMs` **420**, ~×3 vs 1280), **faces** = SVG polygon fills after grow (`facetFillMs` **320**), **sheet** backup View (`glassCoverMs` **180**) then lock, unmount video **under** sheet, `onAppCovered`, hold, **then** faces explode (`shardBreakMs` **520**) + sheet opacity 0. Outer ring is the **screen rect** (triangle fan covers the frame). Shared vertices — no runtime intersection, **no PNG**, **no** ClipPath r, **no** overflow disc, **no** VideoView in Animated.View, **no** zoom-6. `isDataReady` still does not hold. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** Agreed plan: rays first, then facets, then opaque sheet, then mount app, then shards break.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect punch → fast mesh cracks → ice polygons fill → solid sheet hides fighter → home mounts under → shards fly / sheet gone.
- **If FAIL:** do not go back to “more veins fill the screen”; do not restore ClipPath r / disc / PNG.

### 2026-09-19 — Dense WAVE2 + opaque glass lock + no fade-unmount flash
- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** User: cracks **unchanged** / not covering fighter; leave is a **harsh flash/jump**. **No-change:** WAVE2 was 10 short mid-path twigs (delay 0.42–0.60) on `crackGrowMs` **560** — same look as old VEINS, second wave finished as glass started. Glass `#c5d0dc` ramped `glassCoverMs` **340** then `onAppCovered` without forcing opacity 1. **Flash:** `startOverlayLeave` **unmounted VideoView at fade start** (`setKeepVideo(false)` + `fadeMs` **280** `Easing.out`) while overlay was still fading; Stack could leak through cracks if fill never locked. **Fix (JS only):** `crackGrowMs` **1280**, `glassCoverMs` **560**, `glassHoldMs` **420**, `fadeMs` **480** inOut, `glassLockDelayMs` **64**, `glassFillColor` `#b8c3d0`, `splashHangMs` **12000**. WAVE2 replaced with **22 long origin rays to all edges** (delay 0.28–0.46). Lengthened right/up-left primaries. After ramp: **force `glassFill=1`**, mount **plain opaque View** lock, **then** unmount video, **then** `onAppCovered`, hold, fade. VideoView combo **unchanged** (`textureView` + `fill` + `useExoShutter true`). **Not** under `Animated.View`. No PNG / zoom-6 / CASE C / ClipPath r / overflow disc. `isDataReady` still does not hold. Tail loop until cover unmounts the player.
- **Why:** Device: same sparse pop-in cracks; giật chớp into home.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect punch → slow dense veins to all edges + obvious WAVE2 → solid ice covers fighter completely → home fades in ~480ms, no black flash.
- **If FAIL:** do **not** unmount overlay/video at punch; do not restore ClipPath r, circular disc, PNG, zoom-6, or mount Stack while glassFill < 1.

### 2026-09-19 — P0 mount-after-glass + ray cover + vector fill + JS tail wrap
- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** **P0:** Stack stays **unmounted** through P1–P2 (fighter + SVG veins + glass ramp). `onAppCovered` fires only when vector glass fill is opaque (`crackGrowMs` then `glassCoverMs`); LaunchGate then mounts main **under** the overlay (skeleton if prefetch still running). `isDataReady` does **not** hold cinematic. **P1:** lengthened edge veins + WAVE2 branches (`w2-*`, delay by distance); spread remains per-ray `strokeDashoffset` + Reanimated 4 `jsProps`. **No** ClipPath r / overflow disc / strokeWidth balloon / crackLayer scale 1.2. **P2:** sibling ice `Animated.View` fill `#c5d0dc` (not Image/PNG). **P3:** unmount VideoView, fade overlay (no zoom-6). **P4:** `player.loop` stays **false**; JS wraps to `duration − videoTailLoopMs` near EOF (never t=0 unless duration < tail), repeat until unmount, 400ms anti-hammer. Baked concat already in MP4 is backup — **no ffmpeg / native rebuild this pass**. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. VideoView **not** under `Animated.View`. `#000` sibling behind video only while video is mounted.
- **Why:** Agreed plan: rays cover screen, hide looping fighter with vector glass, mount dashboard only after cover, tail-loop until leave.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** `run:android` unless baked `res/raw/splash_loop.mp4` must change). Expect punch → veins to edges → opaque ice glass hides fighter → then home under fade (skeleton if data late); no dashboard leaking through cracks; intro does not restart.
- **If FAIL:** do **not** restore ClipPath r, circular overflow, `player.loop=true`, PNG glass, or mount Stack while fighter is still readable.

### 2026-09-19 — Revert circular field-spread (pre-clip per-ray)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User: cracks broken after circular experiments. **Removed** remaining A+B bits: `crackSpreadMs`, `shatterScale` 1.2, `shatterMs`, `crackLayer` `Animated.View` scale/fade about punch. Overlay is **plain View** + identity **SVG VEINS** (fan ids `p-left-n1`–`n20` already all-direction, not left pile). Spread = **per-ray `strokeDashoffset`** + Reanimated 4 `jsProps` over `**crackGrowMs`**. Leave after punch: `crackRevealMs` + `crackHoldMs` then `fadeMs` then `onFinish`. **Kept** `isDataReady` ungate (`LaunchGate` skeleton only; `mma-splash` does **not** wait on prefetch). **No** ClipPath `r`, **no** circular overflow `View`/`borderRadius` window, **no** Mask. Fighter video / TextureView combo / no PNG **unchanged**. No zoom-6 / CASE C. Combo: `textureView` + `fill` + `useExoShutter true`. Git: these files were **untracked** at MMA-TMS parent (no `git checkout` blob); restored to **pre-A+B working overlay** (post fan-20, pre clipPath) by surgical edit, not `reset --hard`.
- **Why:** Circular field (ClipPath r, then overflow disc, then leftover scale 1.2) is not “tản hướng / từng tia”.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — no native rebuild). Expect punch → ice rays grow from origin all around → hold → fade → home.
- **If FAIL:** do **not** restore ClipPath `r` or circular overflow mask.

### 2026-09-19 — Restore veins: overflow circle mask (not ClipPath r)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Plan A used SVG `ClipPath` + Reanimated `Circle` `r` 0→cover. Android `react-native-svg` does not re-clip that (r stays 0 / never paints) → **entire overlay gone**. Replaced with a **circular overflow `View`** (`borderRadius`, growing `width`/`height` from punch). Inner SVG stays **identity** (dashoffset grow + fan veins, **no strokeWidth balloon**). Shatter still `crackLayer` **1.0→1.2** + fade `shatterMs` then `onFinish`. **No** `isDataReady` hold. **VideoView not wrapped.** No PNG / zoom-6 / CASE C. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: after clip-spread, cracks fully disappeared. Need visible veins that still read as a field spreading from punch.
- **Result on device clip:** record PASS/FAIL after **Metro reload** on `Semester_8/reactnative-mobile` (JS only — no native rebuild). Expect punch → ice veins visible, field opening from origin → scale 1.2 + fade → home.

### 2026-09-19 — Restore per-ray dashoffset (remove circular overflow blob)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Removed the circular overflow `View` (`borderRadius` hole growing from punch) that made cracks look like a **disc/window**. Restored **identity SVG** + existing **VEINS** fan. Each ray still **grows from origin** via `strokeDashoffset` + Reanimated 4 `jsProps` over `**crackGrowMs`**. After grow: `crackLayer` scale **1.2** + fade `**shatterMs`** then `onFinish`. **No** `isDataReady` hold. `crackSpreadMs` unused (0). Punch origin mapping (`punchScreenX`/`Y`) kept. **VideoView not wrapped.** Grep: **no** PNG/`Image`/`require` glass overlay; **no** `glass-shatter-overlay.png`. No zoom-6 / CASE C / ClipPath `r`. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: spread must be **từng tia**, not a circular blob. They thought PNG was used — it was not (vector only); the blob was the overflow mask.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — no native rebuild). Expect punch → ice **rays** drawing out from origin → scale 1.2 + fade → home.
- **If FAIL:** do **not** restore circular overflow mask or ClipPath `r`. Tune `crackGrowMs` / vein `delay`/`grow`.

### 2026-09-19 — Shatter leave not gated on isDataReady

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Removed `triggerTransition` wait on `dataReadyRef` / `isDataReady`. After punch, grow+spread (`max(crackGrowMs, crackSpreadMs)`) **always** runs overlay shatter (`crackLayer` **1.0 → shatterScale 1.2** + fade `shatterMs` 300) then `onFinish`. Prefetch still runs in LaunchGate; `isDataReady` only drives **DashboardSkeleton** after overlay is gone. **Did not skip** cinematic if data is late. **VideoView not wrapped.** No PNG / zoom-6. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: do not freeze on fully drawn cracks waiting for data; break into the inner app as normal; skeleton if still loading.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect punch → grow/spread → shatter leave even if prefetch is still in flight.

### 2026-09-19 — Crack field clipPath spread + overlay shatter scale

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What:** (A) Shatter SVG veins clipped by a `clipPath` **circle at punch origin**; `r` animates **0 → cover screen** on the UI thread (`**crackSpreadMs` 420**, same default as `crackGrowMs`). Vein **`strokeWidth` unchanged** (no balloon). `strokeDashoffset` grow kept. Clip is on the **shatter overlay only**. (B) After `max(crackGrowMs, crackSpreadMs)`, **scale only `crackLayer`** (`Animated.View` wrapping SVG, **not VideoView**) **1.0 → `shatterScale` 1.2** about punch origin **and fade `shatterMs` 300**, then `onFinish`. **No PNG**, no zoom-6, no flying shards. Crop / haptic / video source **unchanged**. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. VideoView still in a plain View.
- **Why:** User: field should spread from punch; after grow, light shatter scale of cracks only.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Tune `**crackSpreadMs`**, `**crackGrowMs`**, `**shatterScale`**, `**shatterMs**`.

### 2026-09-19 — Intro shutter hold + long wipe (visible split)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Two-panel shutter was a **POP**. Bars now **cover from first RN paint** (static **52%** height, opacity 1, sibling above VideoView). **Hold closed `introHoldMs` 140** starting on **overlay mount** (not `timeUpdate` / firstFrame). Then **wipe `introWipeMs` 420** (`Easing.inOut`, not `out` which front-loads motion). Logs: `[splash] shutterHold` / `shutterWipe` / `shutterDone` with elapsed ms. Removed `onPlaybackStarted` race. **VideoView not under `Animated.View`.** No PNG, no full-frame fade. Punch / crop / cracks / `hapticAtMs` 450 unchanged.
- **Why:** 180ms wipe gated on decoder clock started after pixels were already up and completed too fast to see.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect black split ~140ms, then bars slide ~420ms, punch ~450ms.

### 2026-09-19 — Intro fade-in via sibling overlay (`introFadeMs`)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Opening appearance when fighter video starts: **sibling** black overlay (`Animated.View`) starts **opacity 1** and **fades out** on the UI thread (`withTiming` `**splash.introFadeMs` 320**). Trigger = earliest of `onFirstFrameRender`, `timeUpdate > 0`, or `VideoView` `onLayout` after `play()`. **VideoView stays in a plain View** — not wrapped in `Animated.View`. No PNG/`Image`. Video **not paused**. Punch origin / crop / `hapticAtMs` / `crackGrowMs` **unchanged**. Combo **unchanged:** `textureView` + `fill` + `useExoShutter true`. Stack unmounted until overlay gone. SVG cracks still after punch; clip keeps playing under veins.
- **Why:** User asked for an intro appearance without TextureView-blanking parent animation.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect black → fighter reveal over `introFadeMs`, then punch + growing cracks. Tune `**splash.introFadeMs`** (smaller = faster reveal).

### 2026-09-19 — Intro two-panel shutter (`introWipeMs`) replaces fade

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Replaced the full-frame **opacity fade** (`introFadeMs`) with a **two-panel shutter wipe**: sibling top/bottom black `Animated.View` bars (opacity **1**) cover VideoView from the first RN frame, then **translate** open (`withTiming` `**splash.introWipeMs` 180**, `Easing.out`). Hole reveals fighter by geometry, not dim→clear. Trigger = layout size > 0 **and** `timeUpdate > 0` (not onLayout / firstFrame alone). Overlay **unmounts** when wipe finishes so elevation does not sit on TextureView. Veil **above video, below cracks**. **VideoView stays in a plain View.** No PNG. Video **not paused**. Punch / crop / `hapticAtMs` / `crackGrowMs` **unchanged**. Combo **unchanged:** `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: fade-in from dim/blurry fights the fast clip and they miss the punch. Want a short connector (~120–220ms, under 450) instead of a hard pop or a long fade.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect black bars split open onto the fighter in `introWipeMs`, then punch + cracks. Tune `**splash.introWipeMs`**.

### 2026-09-19 — Crack veins draw over crackGrowMs (not pop-in)

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** User: cracks should **spread**, not appear all at once. `SplashGlassShatter` now animates `strokeDashoffset` on UI thread (`createAnimatedComponent` + Reanimated 4 `jsProps`). Duration `**splash.crackGrowMs` (520)**. Vein `delay`/`grow` stagger from origin. **Did not change** VideoView / crop / `hapticAtMs` (user’s 450). No PNG, overlay still a plain View sibling.
- **Why:** Static full Path at punch was a pop-in.
- **Result on device clip:** record PASS/FAIL after Metro reload. Expect veins growing out over ~0.5s. Tune `crackGrowMs` (smaller = faster).

### 2026-09-19 — Bias crack veins left; more quantity

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** Origin stays **right**. **VEINS only:** **32 → 65**. Long left-crossing paths (`x` ≈ **-0.5…-0.95**), extra left branches/hairlines; some up/down/right kept. Stagger delay/grow. Ice `dashoffset` + `jsProps`. No VideoView / crop / haptic / shutter edits. No PNG, no cyan, no shards.
- **Why:** User: origin near right edge; bias **left** so the whole screen cracks; more veins.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Split phone vibration vs crack start (`hapticAtMs` / `crackAtMs`) — REVERTED

- **Reverted:** user wants a **single** `hapticAtMs` that fires haptic + cracks together; no `crackAtMs`.

### 2026-09-19 — Loop last video frames until cracks finish (`videoTailLoopMs`)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** Clip used to **stop at EOF** while veins were still drawing. Player **does not pause at punch**. On `playToEnd` or `currentTime` near `duration`, **seek** `player.currentTime` to `duration − splash.videoTailLoopMs` (**500ms**, last frames) and `play()` until **MmaSplash unmounts** (`tailLoopAllowed` false + existing `pause()`). **VideoView not wrapped.** No PNG. `hapticAtMs` remains **one** punch+haptic key. Comments: crack **SPEED** = `crackGrowMs` (smaller=faster); **FREQUENCY** = more VEINS / lower `delay` in `splash-glass-shatter.tsx`, not `hapticAtMs`. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: video stops before cracks are fully drawn; need last-frames loop until overlay leave.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect punch, then last frames keep moving under growing veins until fade/`onFinish`.

### 2026-09-19 — Tail loop hitch: seek before EOF (`videoTailLoopMs` / `videoTailLoopRate`)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Tracking loop waited until `currentTime >= duration − 0.08` then seeked + `play()` → decoder **stall** (stop a beat, then play). Now arm at **punch** or when **remaining ≤ `videoTailLoopMs`**: `player.loop = true` (smoothness fallback, whole clip if a range-seek is late), seek to tail start **while still playing** with a lead (`~35%` of RANGE, min 120ms) — **not** EOF. Do **not** pause. Skip seek if already at tail start. **VideoView not wrapped.** No PNG. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: tail/tracking loop hitchs; continue immediately. Tune RANGE = `videoTailLoopMs`; SPEED = `videoTailLoopRate` (default **1**; leave 1 unless needed).
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect last frames to keep moving under veins with no freeze at clip end.

### 2026-09-19 — Tail loop last 1.25s only (`videoTailLoopMs` 1250; no whole-file loop)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User: punch-tracking loop must be the **last 1.2–1.3s**, not the first seconds. Removed `**player.loop = true`** (native loop = whole file from t=0). `**player.loop` stays false.** Seek start = `**max(0, duration − videoTailLoopMs/1000)`** whenever the playhead **leaves that window** (wrap to t=0 after entering tail) **or hits EOF** (`remaining ≤ 0.04` / `playToEnd`). `**videoTailLoopMs` 1250.** Never `currentTime = 0` unless duration < tail. Intro (`t < start`) is not a leave. `**hapticAtMs` remains one key.** **VideoView not wrapped.** No PNG. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** Whole-file loop restarted the intro instead of looping punch tracking at the end of the clip.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect intro once, then last ~1.25s repeating under veins until overlay leave.

### 2026-09-19 — Measure punch-tracking PTS; tail 1250ms; skip duplicate TextureView seeks

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** ffprobe `videothanhcong.mp4`: **720×1280 24fps, 97 frames**, stream duration **4.041667s**, format **4.064s**, last packet **PTS 4.000000** (DTS 3.958333). Punch **impact** first ring **PTS 2.250**. **Punch-tracking** (fist planted, rings hold, motion-blur gone) **start PTS 2.791667** (frame 68) → **end PTS 4.000 / duration 4.041667**. Window **1.250s**. Last **1.5s** of source still moves (frame MAD mean **3.63**, min **2.69** at 3.292s) — freeze is **not** in the MP4. Device clip `1789767575364_…mp4`: launcher until ~11.5s rec; splash t=0 ≈ extract 0; punch ~**2.20s** splash; last pose **PTS ~4.00 frozen** on screen from splash **4.0s through ≥4.7s** (MAD **0.1–0.9**) until home — seek-to-same-`currentTime` at EOF stalls TextureView. Set `**videoTailLoopMs` 1250** (start = duration − 1.250 = **2.792s**). Hitch: `**player.loop` stays false**; wrap **while playing** when remaining ≤ `**videoTailSeekLeadSec` 0.12** (not 0.04/EOF); **skip** if already in window or last seek target within **0.04s**; **cooldown 180ms**. **VideoView not wrapped.** No PNG.
- **Why:** Loop used last **1000ms** (too short vs tracking). Repeating `player.currentTime = start` every timeUpdate at EOF froze the last frame instead of wrapping tracking.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect intro once, tracking **2.792–4.042s** repeating under veins **without** a freeze at each wrap.

### 2026-09-19 — Seamless tail: concat last 1.25s ×3 (no TextureView seek)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User still saw a **short hitch** between original EOF and the JS tail wrap. `**player.currentTime` seek on TextureView always hitchs** — do not use it as the loop. Source GOP had **one IDR at t=0**, so `**-c copy` of last 1.25s is impossible**. Filter-concat **original + last 1.25s ×3** (trim start **2.791667**), one **libx264/aac** encode, IDR at joins **0 / ~2.83 / ~4.08 / ~5.33 / ~6.58**. Duration **7.859s**. `**videoTailLoopMs` stays 1250.** `**player.loop` stays false** (whole-file loop banned). JS seek is **last-resort only** if remaining ≤ `**videoTailSeekLeadSec` 0.40** (one seek, `**videoTailSeekCooldownMs` 0** — 180ms cooldown froze the last frame). Splash cinematic (~punch 2s + hold/fade) should **unmount before** concatenated EOF so the decoder **just keeps playing**. **VideoView not wrapped.** No PNG. File size **722,615 → 1,969,939 bytes** (~1.92 MB) both URIs; SHA256 `6BDFA4E855D70D831723D74ED091F51810FD427779A56875B729C3750DDC6ACB`. TextureView size still small; concat **yes**.
- **Why:** Wrap at original 4.04s (lead 0.12 + 180ms cooldown) froze then jumped. Need seamless continue of punch-tracking.
- **Reload:** Android `**res/raw/splash_loop.mp4` needs a native rebuild**; Metro-only reload will not replace `R.raw.splash_loop`. Last-resort JS seek (0.40s lead, once) covers a stale 4s APK until rebuild.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect intro once, then tracking repeats **in-file** with **no seek hitch** at original EOF; overlay leave before ~7.86s.

### 2026-09-19 — Tail loop last 1100ms (nudge start later)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** Tracking window was **2.792–4.042s** (1250ms); unused motion at the **start** of that window. Rebuilt concat from `Downloads\videothanhcong2.mp4` (stream **4.041667s**): **original + last 1100ms ×3** (trim start **2.941667**), libx264/aac. `**videoTailLoopMs` 1100.** JS last-resort seek start = **max(0, duration − 1.100)** (source **~2.942s**; concat video duration **7.375s** → last-copy start **~6.275s**). `**player.loop` false.** VideoView **not wrapped.** No PNG. File **2,045,752 bytes**; SHA256 `A840BFB8CDC7BAE4A35108990903A231BE78C53E0F49EAD678888C0093D24270`. Both URIs identical.
- **Why:** User: slightly reduce loop RANGE toward the later part of the clip.
- **Reload:** Android `**res/raw/splash_loop.mp4` needs a native rebuild**; Metro-only reload will not replace `R.raw.splash_loop`.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect intro once, then tracking **2.942–4.042s** repeating in-file under veins.

### 2026-09-19 — Tail loop last 500ms (rebuild baked concat; JS 500 did nothing)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User lowered `**videoTailLoopMs` to 500** and the loop **still started at the same earlier segment**. **Why:** splash MP4 is a **baked concat** (original + last **1100ms** ×3). JS `videoTailLoopMs` only drives **last-resort seek** (`max(0, duration − 0.5)`). Playback just continues through the baked 1100ms copies. Rebuilt from `Downloads\videothanhcong2.mp4` (stream **4.041667s**): **original + last 500ms ×3** (trim start **3.541667**), libx264/aac. `**videoTailLoopMs` stays 500.** JS seek = **duration − 0.5**, last-resort only. `**player.loop` false.** VideoView **not wrapped.** No PNG. File **1,308,100 bytes**; SHA256 `2FD1ED842D3408FC68020EBAA00CD407C03BF3B6116012774421B01F9F831AC3`. Both URIs identical. Concat video duration **5.583333s** (format **5.609s**). **Changing `videoTailLoopMs` does not change baked concat until ffmpeg + native rebuild.**
- **Why:** JS range does not rewrite in-file tail copies.
- **Reload:** Android `**res/raw/splash_loop.mp4` needs a native rebuild**; Metro-only reload will not replace `R.raw.splash_loop`.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect intro once, then tracking **3.542–4.042s** repeating in-file under veins.

### 2026-09-19 — Tail loop last 1000ms (interrupt 500ms rebake)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User: **tăng 1000** = baked loop RANGE **1000ms** (not 500). Interrupted the 500ms rebake. Rebuilt from `Downloads\videothanhcong2.mp4` (stream **4.041667s**): **original + last 1000ms ×3** (trim start **3.041667**), libx264/aac. `**videoTailLoopMs` 1000.** JS last-resort seek = **max(0, duration − 1.0)** (source **3.041667s**; concat video **7.083333s**). `**player.loop` false.** VideoView **not wrapped.** No PNG. File **1,604,163 bytes**; SHA256 `C145D3314D90182D6E17D6F168F7AADD526D931B11258D650744429132620CCE`. Both URIs identical. Format duration **7.109s**. `**videoTailLoopMs` does not change baked concat until ffmpeg + native rebuild.**
- **Why:** User asked to increase RANGE to 1000ms after the 500ms concat was too short.
- **Reload:** Android `**res/raw/splash_loop.mp4` needs a native rebuild**; Metro-only reload will not replace `R.raw.splash_loop`.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect intro once, then tracking **3.042–4.042s** repeating in-file under veins.

### 2026-09-19 — Tail loop last 900ms (rebuild baked concat)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User: baked loop RANGE **900ms**. Rebuilt from `Downloads\videothanhcong2.mp4` (stream **4.041667s**): **original + last 900ms ×3** (trim start **3.141667**), libx264/aac. **`videoTailLoopMs` 900.** JS last-resort seek = **max(0, duration − 0.9)** (source **3.141667s**; concat video **6.791667s**). **`player.loop` false.** VideoView **not wrapped.** No PNG. File **1,505,458 bytes**; SHA256 `D6130E3056C3A694F58D03E9E727192F36F32FA3877B1C9E7D007AF8A168CEE0`. Both URIs identical. Format duration **6.832s**. **`videoTailLoopMs` does not change baked concat until ffmpeg + native rebuild.**
- **Why:** User asked RANGE 900ms; JS alone cannot rewrite in-file tail copies.
- **Reload:** Android **`res/raw/splash_loop.mp4` needs a native rebuild**; Metro-only reload will not replace `R.raw.splash_loop`.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect intro once, then tracking **3.142–4.042s** repeating in-file under veins.

### 2026-09-19 — Add 20 leftward crack veins

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** **VEINS only.** Count **65 → 85**. Appended **20** new leftward paths (`p-left-n1`–`p-left-n12`, `t-left-n13`–`t-left-n17`, `h-left-n18`–`h-left-n20`); `x` negative, spanning **−0.4…−0.95**. Existing 65 veins **kept**. Delay stagger **0.08–0.50**. Same ice strokes / `dashoffset` + `jsProps`. **Did not change** VideoView. No PNG.
- **Why:** User: tăng lên 20 tia leftward across the screen.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

---

## Chronological log

### 2026-09-18 — `expo-av` JSI crash → `expo-video` only

- **Files:** splash player, `package.json` (removed expo-av).
- **What:** User asked `expo-av` `Video` `resizeMode="cover"`. Installed / used expo-av.
- **Why failed:** Native crash on open (`libexpo-av.so` / JSI), not missing MP4. App never showed loading.
- **Result:** FAIL crash. **Gỡ expo-av.** Only `**expo-video`**.

### 2026-09-18 — Metro 8081 vs baked JS

- **What:** Agents “fixed” source; device UI unchanged.
- **Why:** Debug still **Loading from localhost:8081**. Stale Metro or **wrong folder** (`Semester 8` SPACE vs `Semester_8` + `reactnative-mobile`).
- **Result:** FAIL — same JS. Always restart Metro on **underscore** Metro tree.

### 2026-09-18 — Stack / screens blank TextureView

- **Files:** `launch-gate.tsx`, `_layout.tsx`.
- **What:** Mount navigator / home under overlay during intro.
- **Why failed:** Android **TextureView** blanks if screens mounted during splash.
- **Result:** FAIL black. **Keep Stack unmounted until overlay gone.**

### 2026-09-18 — Modal hid TextureView

- **Files:** `mma-splash` / `LaunchGate`.
- **What:** Full-screen `Modal` for splash.
- **Why failed:** Decoder ran (haptic / shatter timing); **TextureView did not paint** → cracks on black.
- **Result:** FAIL. **No Modal.**

### 2026-09-18 — z-index was NOT the bug

- **What:** Raise overlay / video `zIndex` assuming a sibling covered the fighter.
- **Why failed:** **VideoView never painted.** z-index cannot uncover a blank surface.
- **Result:** FAIL. Do not spend cycles on z-index as the fighter fix.

### 2026-09-18 — `hideAsync` too early vs native splash black gap

- **Files:** `launch-gate.tsx`, `splash-video-player.tsx`.
- **What:** Hide native splash on layout / `onFirstFrameRender` that can be a **black** decoder frame.
- **Why failed:** Native splash off → **black gap** ~seconds → then shards or home. `onFirstFrameRender` ≠ eyes see fighter.
- **Result:** FAIL. Hide native splash only after a **real playing** frame policy (still do not trust first-frame alone with cover/shutter bugs).

### 2026-09-18 — CrackStroke `dashoffset` without Reanimated 4 `jsProps`

- **Files:** glass / crack SVG overlay.
- **What:** Animate stroke dashoffset on UI thread without `jsProps`.
- **Why failed:** **Strokes invisible**; shards still drew → “one shard then home”.
- **Result:** FAIL for stroke animation path.

### 2026-09-18 — Fake glass / cyan / unprofessional PNG

- **What:** Crude SVG zigzags, cyan HUD, placeholder PNG as “glass”.
- **Why failed:** User: **fake glass**, unprofessional. Do not invent new zigzags.
- **Result:** REJECTED.

### 2026-09-19 — `useExoShutter false` + `cover` + `textureView`

- **Files:** `splash-video-player.tsx`.
- **What:** Avoid black shutter; crop with `contentFit="cover"`.
- **Why failed:** `FirstFrameEventGenerator` aspect-ratio / fill check **fails** → `**videoSurfaceView.alpha = 0` forever**.
- **Result:** FAIL black forever (audio/haptic may still run). **BANNED combo.**

### 2026-09-19 — `useExoShutter true` + `cover` + `textureView`

- **What:** Let first-frame set alpha 1, keep cover.
- **Why failed:** Alpha 1 but **Exo BLACK SHUTTER** stays; no visible first frame of fighter.
- **Result:** FAIL black shutter. **BANNED combo.**

### 2026-09-19 — `VideoView` under `Animated.View`

- **Files:** `mma-splash.tsx`.
- **What:** Zoom/fade the whole splash including video via Reanimated parent (even identity transform / opacity 1).
- **Why failed:** **TextureView blanks** under `Animated.View`.
- **Result:** FAIL. Animate **overlay only**; leave `VideoView` in a plain `View`.

### 2026-09-19 — CASE C (live device): `surfaceView` + fill + `useExoShutter true` + `#000` on VideoView/parents

- **Files:** `splash-video-player.tsx`, `mma-splash.tsx`, `launch-gate.tsx`.
- **What:** Switch to `**surfaceView`** hoping it composites; keep `**contentFit="fill"**`, `**useExoShutter={true}**`, `**backgroundColor: #000**` on `VideoView` and/or parents (`videoLayer` / overlay).
- **Why failed:** **Not CASE A/B** (cover + shutter/alpha). **SurfaceView draws behind the RN view tree.** Black RN views **cover the fighter**. Decoder + **haptic still ran** → “black screen but punch vibrates”.
- **Result:** FAIL on device. **BANNED:** SurfaceView **under** black `View` / black `VideoView` background.

### 2026-09-19 — CASE C fix landed (Metro `Semester_8/reactnative-mobile`)

- **Files:** `splash-video-player.tsx`, `mma-splash.tsx`, `launch-gate.tsx`.
- **What:**
  - Android: `**textureView` + `contentFit="fill"` + `useExoShutter={false}**`
  - `**backgroundColor: "transparent"**` on `VideoView`, `mma-splash` `videoLayer` / root, `LaunchGate` `overlayFill`
  - **Black only** on `LaunchGate` `styles.root` (`splash.canvas` / `#000`) and fail fallbacks
  - Glass **PNG overlay mounts only after 1.0s punch** (`hasPunchFinished`)
  - `**VideoView` not under `Animated.View**`
- **Why:** Uncover TextureView compositing; keep first-frame fill path; do not cover Surface/Texture with RN black; do not fake glass before punch.
- **Result on device clip:** record PASS/FAIL after install. Do not revert to CASE C banned combo if this fails — append a new entry instead.

### 2026-09-19 — BANNED: PNG / static images for splash effects

- **Files:** `docs/splash-launch.md`; workspace + Metro `.cursor/rules/splash-launch.mdc`; `.cursor/rules/no-static-effect-images.mdc`. No splash TSX rewrite this entry.
- **What:** User: **đéo/cấm xài PNG/ảnh tĩnh** khi làm hiệu ứng (kính, crack, shatter, splash overlay). Ban **PNG, WebP, JPEG**, and `**Image` `require()`** overlays for those effects. `**glass-shatter-overlay.png` must not be used.** Effects must be **Reanimated + SVG/vector** or **video**. Fighter splash **VIDEO** (`videothanhcong` / `splash_loop`) remains **allowed** (motion, not a still).
- **Why:** Static photo overlays are fake glass / unprofessional; user forbids them for effects.
- **Result on device clip:** policy only this entry (no TSX change).

### 2026-09-19 — Revert kính vỡ: fighter + SVG cracks at 80/40, no PNG, no zoom-6

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `assets/splash/glass-shatter-overlay.png` (deleted), `docs/splash-launch.md`
- **What:** Removed photoreal PNG overlay, flying shards/breakAway, zoom-6 through crack, and scale-expand of a full-screen opaque still. Restored organic **VEINS Path geometry** as SVG strokes. Origin is `**punchScreenOrigin(w,h)` = `w*0.8`, `h*0.4`** (not cover-mapped 0.84). Overlay sibling fades in at punch then fades out (no zoom). VideoView CASE C combo **unchanged**.
- **Why:** User wants clip-1789748057 look (fighter punch + vết nứt) with correct origin; CẤM PNG/ảnh tĩnh for effects; drop kính vỡ / zoom-through.
- **Result on device clip:** record PASS/FAIL after Metro reload. Expect fighter 0s→punch, haptic at 1.0s, grey glass strokes from 80/40, then fade to app.

### 2026-09-19 — Defer VideoView until splash root layout (0-size surface)

- **Files:** `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What:** Mount `SplashVideoPlayer` only after `onRootLayout` reports `width/height > 0` (`videoSurfaceReady`). Keeps `textureView` + `fill` + `useExoShutter={false}` + transparent layers unchanged.
- **Why:** Device clip: **cracks + haptic, no fighter** — decoder/timeUpdate ran but TextureView stayed invisible. expo-video `FirstFrameEventGenerator` / `shouldHideSurfaceView` leaves `videoSurfaceView.alpha = 0` when surface layout is 0×0 or first frame races layout; punch overlay still drew on black.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect fighter visible 0→1.0s, then cracks at 80/40.

### 2026-09-19 — MMA Vision home chrome leaked under splash (transparent overlay)

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `docs/splash-launch.md`
- **What:** Device: **MMA Vision** text **behind / covered by the app bar**, then SVG cracks, **still no fighter**. CASE C fix left `overlayFill` / VideoView **transparent**. `MmaSplash` `SplashFallback` and `LaunchSplashFallback` rendered `vi.brand.wordmark` ("MMA Vision") while waiting for layout / on error (`mma-splash.tsx` fallback; `launch-gate.tsx` fallback). Dashboard `vi.brand.wordmark` (`dashboard.tsx`) is the same string if Stack were visible through the hole. `app.json` `name` is also "MMA Vision" (native/stack title leak). Fix: keep Stack **unmounted** until `phase === "live"` / `onFinish`; `overlayFill` `**absoluteFill` + opaque `#000`** (covers full window including status inset; TextureView child still paints — not SurfaceView+#000); hide Android status bar / translucent during overlay; empty black fallbacks (**no wordmark**); Stack `headerShown: false` + empty `title` / `headerTitle`. VideoView combo **unchanged** (`textureView` + `fill` + `useExoShutter false` + transparent VideoView, not under `Animated.View`, collapsable false, mount after layout size>0).
- **Why:** User clip: home wordmark during 0–1s then cracks, no punch MP4. Black LaunchGate root alone cannot show "MMA Vision" — the wordmark was splash fallback text and/or home chrome through a transparent overlay that did not cover the top bar.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect **no MMA Vision / header** during 0–1s; fighter on black; cracks after punch.

### 2026-09-19 — Hang: wait-for-layout + onFinish AND-gate never proceeded

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** After “Defer VideoView until splash root layout”, `MmaSplash` mounted `SplashVideoPlayer` only when `shatterBox` from `onRootLayout` had `width/height > 0` (`videoSurfaceReady`, `mma-splash.tsx` ~113–127). Initial box was `{0,0}`; if `onLayout` never fired or stayed 0, video never mounted, punch never ran, `triggerTransition` waited forever on `punchDoneRef && isDataReady && crackDoneRef` (~49–51), `hideAsync` never ran (player `revealNative` + `onLayoutReady` only on fail), Stack stayed unmounted, `overlayFill` `#000` + hidden status bar = **infinite black**. Unblocked: seed size from `Dimensions.get("window")` (fallback 360×640), apply explicit px on `videoLayer`, `videoMountFallbackMs` (250) still mounts video, `splashHangMs` (5000) calls `onFinish` + `hideAsync` if punch/ready/crack never complete; LaunchGate hang at 5400ms as last resort. CASE C VideoView combo **unchanged** (`textureView` + `fill` + `useExoShutter false`, not under `Animated.View`, no `#000` on VideoView). Stack still unmounted until `onFinish` or hang timeout.
- **Why:** User: app hangs black after last change; wait-until-ready never proceeds. Prefer home over infinite black.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect fighter or, if punch never comes, home within ~5s — never stuck black.

### 2026-09-19 — Hang-fix hid fighter + cracks (parent `#000` + 5s skip)

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Hang-fix got users into the app but **no fighter 0–1s and no SVG cracks**. Causes: (1) `overlayFill` opaque `#000` as **parent** of TextureView (home-chrome leak entry) — black wins z-order / compositing, video painted under it; (2) `splashHangMs` **5000** + LaunchGate **5400** called `onFinish` and **unmounted** splash before punch/cracks if decode/punch lagged, so AND-gate never showed overlay; (3) `videoMountFallbackMs` **250** + sized `videoLayer` remount could destroy TextureView; (4) player **2500ms** `missPaint` `fail()` tore down video → home with no cinematic. Fix: LaunchGate overlay host **transparent**; `#000` **sibling behind** video (`blackBehind`) + root canvas; video `absoluteFill` sibling on top, cracks sibling after `hasPunchFinished`; mount VideoView immediately (no 250ms remount gate); hang **9000ms** last resort (LaunchGate **9800ms**); remove 2.5s missPaint fail. Combo **unchanged:** `textureView` + `fill` + `useExoShutter false`, transparent VideoView, not under `Animated.View`, no SurfaceView+#000, no PNG, Stack unmounted until `onFinish`.
- **Why:** User: hang timeout was **correct** (they reach home) but splash is skipped/painted over — must **see** fighter then cracks at 80/40, then enter app. No infinite black; no 5s skip that eats the intro.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect fighter 0→1.0s, haptic + SVG cracks at 80/40, fade to app; home only if punch never comes (~9s), not a 5s jump.

### 2026-09-19 — onFinish gated on paintedFrame (SM-S928B pid 21572)

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Do **not** `onFinish` / unmount splash / mount Stack until `VideoView` `onFirstFrameRender` **and** punch+SVG cracks can run, or last-resort hang **~9s**. **Gate:** `paintedFrame && (cinematic done OR hang timeout)`. `isDataReady` only fades after that gate — it must **not** skip the fighter. Decoder `timeUpdate` / `playingChange` no longer count as a painted frame. Punch waits for `onFirstFrameRender`. Breadcrumbs: `console.log("[splash] …")` at mount, firstFrame, punch, onFinish. Combo **unchanged:** `textureView` + `fill` + `useExoShutter false`, **transparent** VideoView, **black sibling behind** video (not parent `#000`), VideoView **not** under `Animated.View`, Stack unmounted until `onFinish`, no PNG, no expo-av, no SurfaceView+#000, no cover+false shutter.
- **Why:** Logcat SM-S928B pid 21572: ExoPlayer decoded **720×1280 ~1.9s** then **Release** as ScreenStack drew home. Decoder ran, VideoView never composited, `onFinish` unmounted splash ~**2s** because data was ready. No crash.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Next logcat should show `[splash] mount` → `[splash] firstFrame` → `[splash] punch` → `[splash] onFinish cinematic` (not home at ~2s with no firstFrame). Hang path: `[splash] onFinish hang` ~9s.

### 2026-09-19 — Gating punch on onFirstFrameRender hid cracks (9s black hang)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Previous paintedFrame patch required `onFirstFrameRender` before punch/haptic/SVG. Device: **9s hang**, still **black**, **no fighter**, **no cracks**; decoder still ran **720×1280**. Ungate: punch + cracks from `timeUpdate >= 1000ms` (and punch-hold / playToEnd) **without** `paintedFrame`. `hideAsync` on punch so native splash cannot cover cracks. Hang still **~9s** to home if no pixels (`[splash] hang`). Cinematic fade still wants firstFrame; `isDataReady` still cannot skip intro. Play **after** VideoView `onLayout` w/h > 0 (explicit px size); **do not** `play()` in `useVideoPlayer` setup. `contentFit="fill"` verified → `ContentFit.FILL("fill")` → `RESIZE_MODE_FILL` (`ContentFit.kt`); TextureVideoView uses the same `VideoViewComponent` prop. Combo **unchanged** otherwise: `textureView` + `fill` + `useExoShutter false`, transparent VideoView, black **sibling** behind video, not under `Animated.View`, Stack unmounted until `onFinish`, no PNG / expo-av / SurfaceView+#000 / cover.
- **Why:** `FirstFrameEventGenerator` often **never** emits. `VideoView.kt` `applySurfaceViewVisibility`: `useExoShutter false` + `shouldHideSurfaceView` → **alpha 0** until `onRenderedFirstFrame`; `useExoShutter true` → alpha 1 but **black Exo shutter** until that same event. `FirstFrameEventGenerator.kt` `isPlayerSurfaceLayoutValid()` returns **false** when `currentVideoView` is null or `surfaceSize` is 0×0 (`~91–105`); then `hasPendingOnFirstFrame = true` (`onRenderedFirstFrame` `~54–59`) and **only** `onSurfaceSizeChanged` retries (`~67–70`). `onTargetViewChanged` clears the view flag but **does not retry**. Playing in the player setup callback races attach/layout → pending first-frame **never** lifts alpha **and** JS `onFirstFrameRender` never runs → punch never started → 9s black. FILL is **not** ignored: `VideoModule.kt` `Prop("contentFit")` + `ContentFit.FILL("fill")`. **Do not repeat:** hide cracks behind `onFirstFrameRender`.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect `[splash] mount` → (`[splash] videoLayout` / maybe `[splash] firstFrame`) → `**[splash] punch` at ~1s** → cracks even if firstFrame missing → `[splash] hang` only if still no leave ~9s. **BANNED:** gating punch/cinematic overlay on `onFirstFrameRender`.

### 2026-09-19 — JS firstFrame+onFinish burst ≠ visible frames

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User Metro logs: `mount → videoLayout 384 832 → firstFrame → punch → onFinish cinematic → onFinish launchGate` in one burst; **screen empty** (no fighter, no cracks). Cause: `overlayFade` already **1**, so `withTiming(1, crackSpreadMs)` **completed in the punch JS turn**, `isDataReady` was already true, cinematic `onFinish` unmounted splash before compositor / crack overlay could show. `onFirstFrameRender` is **not** proof of pixels (`useExoShutter false` can still lag). Fix: punch still **not** gated on firstFrame. After punch keep splash mounted: crack **reveal 800ms** + **hold 1000ms** (`crackHold` 0→1 `withTiming` **and** `setTimeout` floor) → fade **280ms** → `runOnJS` `onFinish`. `isDataReady` only after that hold. Android: `**textureView` + `fill` + `useExoShutter true`** (alpha 1; cover+true still banned). Play on player setup again (layout 384×832 was not the hang). No SurfaceView+#000, expo-av, PNG, or `Animated.View` wrapping VideoView. Logs: `punch` → `crackHoldDone` → `fadeAfterCracks` → `onFinish cinematic` (not the same tick).
- **Why:** JS pipeline succeeding is not a composited frame. Same-turn unmount + treating `firstFrame` as painted left a blank screen.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect punch at ~1s, cracks visible ≥1000ms, then fade to app. **BANNED:** `onFinish` in the same JS turn as punch; treating `firstFrame` log as visible pixels.

### 2026-09-19 — OS/expo splash covering RN (JS logs ≠ visible)

- **Files:** `src/app/_layout.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `index.js`, `app.json`, `plugins/with-black-splash.js`, `android/.../styles.xml`, `android/.../MainActivity.kt`, `docs/splash-launch.md`
- **What:** User: **only black**, no fighter, no cracks; splash images already deleted. Confirmed leftover native splash: `expo-splash-screen` plugin still `**backgroundColor: #000000`** (`app.json`); `preventAutoHideAsync()` in `index.js` + `_layout.tsx`; `Theme.App.SplashScreen` + Android 12 splash API (`windowSplashScreenBackground` `#000`, empty icon); MainActivity still `setTheme(AppTheme)` for expo-splash-screen. `hideAsync` previously waited for punch / firstFrame / hang — **MmaSplash `onRootLayout` never called `onLayoutReady`**, so the OS overlay never dismissed. JS decoder + logs still ran **under** that overlay. Fix: `**hideAsync` on RootLayout mount, LaunchGate mount, LaunchGate root `onLayout`, MmaSplash mount + root layout, VideoView player mount.** Do **not** wait for punch, firstFrame, or video. Android `windowBackground` stays `#000` **behind** video (not a never-dismissing splash overlay). Cinematic unchanged: fighter video + SVG cracks, no PNG, no expo-av, no SurfaceView+#000, VideoView not under `Animated.View`, punch not gated on firstFrame, post-punch hold so `onFinish` is not the punch tick.
- **Why:** Deleted splash **image** ≠ no splash. Plugin + `preventAutoHideAsync` still paints solid black until `hideAsync`. Metro `[splash]` logs ≠ pixels on screen.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect native black overlay gone as soon as RN layouts; fighter 0→1.0s; SVG cracks after punch; then fade to app.

### 2026-09-19 — delayed hideAsync = black covering cinematic

- **Files:** `src/app/_layout.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `app.json`, `plugins/with-black-splash.js`, `android/app/src/main/res/values/styles.xml`, `android/app/src/main/res/values/colors.xml`, `android/app/src/main/res/drawable/splash_empty.xml`, `docs/splash-launch.md`
- **What:** User yelling: **only black**, no video, no cracks; asked if leftover splash still covers everything after they deleted splash images. **Yes.** `preventAutoHideAsync` kept the Expo/Android 12 splash (solid black `windowBackground` / `windowSplashScreenBackground`) until `hideAsync`, which had been delayed to punch / firstFrame. Decoder + Metro logs ran **under** that overlay. Fix: `**hideAsync` as soon as RootLayout mounts** (and LaunchGate mount / first `onLayout` / MmaSplash mount) — **not** punch, **not** firstFrame. Native `windowBackground` / splash API colors set to **transparent** so the leftover black OS splash cannot sit on top of `MmaSplash` (fighter video + SVG). **Do not restore Expo logo splash.** Punch / crack reveal 800ms / hold 1000ms / fade 280ms unchanged. Banned combos unchanged (no PNG, no expo-av, no SurfaceView+#000, no VideoView in `Animated.View`).
- **Why:** Delayed `hideAsync` with a black native splash is a full-screen cover, not a “wait for a real frame” safeguard. User wants the **video** as the intro.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile` (theme XML needs a native rebuild if the overlay still looks like the old `#000` window). Expect `[splash] hideAsync rootLayout mount` immediately, then fighter 0→1.0s, cracks after punch.

### 2026-09-19 — SVG cracks invisible for post-punch hold (opacity 0 + TextureView cover)

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Device: open → **app bar slides up** (`StatusBar.setHidden`, not fighter) → **light haptic** (punch fired) → **only solid black** until home. Video still not compositing (known). **New:** organic SVG cracks also **never visible** for the whole post-punch hold. Cause: `onImpact` set `crackOpacity = 0` then `withTiming(1, crackRevealMs)` **before** the overlay existed (`hasPunchFinished` mounts it next render) — Reanimated 0→1 on an unmounted view **does not paint**, so `overlayStyle` stayed **opacity 0**. Strokes were also mid-grey `strokeOpacity` 0.25–0.55 (`#e8edf2`) easy to lose on `#000`. Overlay had no elevation vs Android TextureView (shutter alpha 1 can cover later RN siblings). Fix: at punch `**overlayFade = 1` immediately** (hold still 1000ms via timer + `crackHold`; fade 280ms after). White/high-opacity strokes, min width ≥1.8, `pointerEvents="none"`, crack sibling **zIndex 20 / elevation 12** above video + black, `overflow: visible`, scale 1, **not** gated on firstFrame. Video: `**textureView` + `fill` + `useExoShutter true`**, not under `Animated.View`, `#000` sibling behind. `hideAsync` still on mount. **Do not** treat status-bar hide as video success. No PNG.
- **Why:** User: haptic = punch; status-bar motion ≠ video; cracks **must** show on black even if VideoView is blank.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect haptic **and** visible white cracks on black at ~1s, then hold, then fade to app. Fighter may still be blank.

### 2026-09-19 — Bar moves, content black: Animated crack host + elevation + hold skip

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** User: bar slides up then down, then haptic, then home; **never** video or cracks; solid black. Splash JS was running (`setHidden` + punch haptic). Cracks still lived under `Animated.View` + `overlayFade` (`mma-splash` overlayStyle) so UI-thread opacity could stay 0 after punch mount; `crackRevealMs` was unused so hold was only 1000ms and `withTiming` fade-to-0 could complete immediately if overlay never hit 1. `videoLayer`/`crackLayer` `**elevation`** (previous entry) forces an Android hardware layer that blanks TextureView. Fix: `SplashGlassShatter` in a **plain `View` at punch**, `strokeOpacity={1}`, min stroke **5.5**; JS hold **800+1000ms** then 280ms then `onFinish`; ignore `videoFail` after punch; VideoView `textureView`+`fill`+`useExoShutter true`, explicit layout px, `collapsable={false}` `needsOffscreenAlphaCompositing={false}` `renderToHardwareTextureAndroid={false}`, **no elevation**, not under `Animated.View`, `#000` sibling behind only. `setHidden(false)` only after that hold (`onFinish`). No PNG, no expo-av, no SurfaceView+#000.
- **Why:** Status-bar motion is a side effect, not painted frames. Elevation/Animated parents hide TextureView + SVG while haptic still fires.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect fighter 0→1.0s, obvious white cracks from punch for ≥1.8s, then home.

### 2026-09-19 — Layout pan/zoom, mapped fist origin, earlier punch, ice-glass strokes

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** Fighter + cracks already visible. (1) **Layout-only** crop: overflow-hidden stage at screen size; `VideoView` **scale 1.12** (`width/height * 1.12`), `left = -(scale-1)*W` (`videoLeftCrop` 1), `top = -0.4*(scale-1)*H`. No `Animated.View` around VideoView, no Reanimated transform. (2) Origin remapped: video-space **80% × 40%** through the same scale+translate → screen **~77.6% × 40.0%** (`punchScreenOrigin` uses `splashVideoLayout`). (3) Punch/cracks/haptic together at `**hapticAtMs` 940** (was 1000). (4) Strokes `**#b7c4d2` / `#d7e2ec`**, opacity **0.35–0.85** from vein alpha, min width **2.7** (not `#FFFFFF` / 5.5). Combo **unchanged:** `textureView` + `fill` + `useExoShutter true`, plain View cracks, **no elevation**, transparent VideoView, `#000` sibling behind only, no PNG / expo-av / SurfaceView+#000.
- **Why:** Hide top-left AI watermark; fist origin followed the old un-panned 80/40; overlay lagged punch by a few frames; pure white looked fake.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect cropped fighter (no AI mark), cracks on glove at punch ~940ms, ice-gray veins, then hold/fade.

### 2026-09-19 — Layout crop blanked TextureView; reverted

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Pan/zoom crop (`videoLayoutScale` 1.12, negative `left`/`top` on `VideoView`, parent `overflow: hidden`) restored **black screen**. Reverted VideoView to **fullscreen fill** (screen px, no offset, no overflow clip on video parent). Kept **ice stroke** colors (`#b7c4d2` / `#d7e2ec`) and punch `**hapticAtMs` 940**. Origin back to **screen 80% × 40%** (mapping only existed for the dropped crop). Combo restored: `textureView` + `fill` + `useExoShutter true`, not under `Animated.View`, **no elevation**, `#000` sibling behind only, cracks in **plain View** at punch, `hideAsync` on mount. No PNG / expo-av / SurfaceView+#000.
- **Why:** Android TextureView blanks when the surface is scaled past the parent and clipped (`overflow: hidden` + size/transform-like layout). Crop is dropped until video is stable.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect fighter 0→punch, ice cracks at 80/40, then hold/fade. **BANNED:** scale/offset `VideoView` + overflow-hidden stage as a watermark crop.

### 2026-09-19 — Mild watermark crop without overflow:hidden

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** User still wants a slight zoom + left shift to hide top-left **AI** text. Previous crop used `**overflow: hidden`** + scale 1.12 and **blanked TextureView**. This pass: `**videoLayoutScale` 1.08**, all extra width on the **left**, **45%** of extra height above the top; `VideoView` `position:absolute` `left`/`top`; parents `**overflow: "visible"`** (LaunchGate `overlayHost` already visible). **No** `overflow: hidden` on the video stage. Punch origin mapped through the same layout (video 80%×40% → screen). Combo unchanged: `textureView` + `fill` + `useExoShutter true`, not under `Animated.View`, no elevation. Ice strokes / `hapticAtMs` 940 kept.
- **Why:** Hide AI watermark without the banned overflow-hidden clip.
- **Result on device clip:** record PASS/FAIL after Metro reload. If **black screen**, revert this crop immediately (treat even overflow-visible offset as BANNED).

### 2026-09-19 — Keep fighter video playing under SVG cracks

- **Files:** `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** Removed `player.pause()` from `fireImpact` (was ~line 82). Punch still fires haptic + `onImpact` (SVG cracks). Clip **keeps playing** under the overlay. Unmount `pause()` unchanged. Did **not** wrap `VideoView` in `Animated.View`. Crop / `hapticAtMs` / `crackGrowMs` unchanged. No PNG, no expo-av.
- **Why:** User wants the fighter VIDEO to keep PLAYING while glass cracks appear, not freeze on the punch frame.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect motion under veins after punch.

### 2026-09-19 — Intro fade-in via sibling overlay (`introFadeMs`)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Opening appearance when fighter video starts: **sibling** black overlay (`Animated.View`) starts **opacity 1** and **fades out** on the UI thread (`withTiming` `**splash.introFadeMs` 320**). Trigger = earliest of `onFirstFrameRender`, `timeUpdate > 0`, or `VideoView` `onLayout` after `play()`. **VideoView stays in a plain View** — not wrapped in `Animated.View`. No PNG/`Image`. Video **not paused**. Punch origin / crop / `hapticAtMs` / `crackGrowMs` **unchanged**. Combo **unchanged:** `textureView` + `fill` + `useExoShutter true`. Stack unmounted until overlay gone. SVG cracks still after punch; clip keeps playing under veins.
- **Why:** User asked for an intro appearance without TextureView-blanking parent animation.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect black → fighter reveal over `introFadeMs`, then punch + growing cracks. Tune `**splash.introFadeMs`** (smaller = faster reveal).

### 2026-09-19 — Intro two-panel shutter (`introWipeMs`) replaces fade

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** User rejected opacity fade (too slow / dim→clear; they miss the punch). Replaced `introFadeMs` overlay with a **two-panel shutter**: top/bottom black bars stay **opacity 1** and **translate** open over `**splash.introWipeMs` 180**. Starts when layout has size **and** `timeUpdate > 0`. Overlay unmounts after wipe. Sibling **above video, below cracks**. VideoView **not** under `Animated.View`. No PNG, no pause, punch/crop/cracks unchanged.
- **Why:** Need a short geometric connector (~120–220ms, under `hapticAtMs` 450), not a hard pop and not a full-frame fade.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect shutter split onto fighter, then punch at 450ms.

### 2026-09-19 — Intro shutter hold + long wipe (visible split)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `docs/splash-launch.md`
- **What:** Device: **no two-panel shutter**, still a **POP**. Previous wipe was `**introWipeMs` 180** + `Easing.out`, and it **waited for `timeUpdate > 0` + layout** (`onPlaybackStarted`). Decoder already showing fighter → wipe ran **off-screen / too fast**. Fix: bars **fully cover from first RN paint** (stylesheet height **52%**, not Reanimated height). **Hold closed `introHoldMs` 140** from overlay **mount**. Then wipe `**introWipeMs` 420** `Easing.inOut`. Unmount after wipe. Logs `[splash] shutterHold` / `shutterWipe` / `shutterDone` with timestamps. Dropped playback-start gate. **Do not wrap VideoView.** No PNG / full-frame fade. Punch/crop/cracks/`hapticAtMs` 450 unchanged.
- **Why:** User never saw the split. 180ms is invisible; timeUpdate gate started the wipe too late.
- **Result on device clip:** record PASS/FAIL after Metro reload. Expect closed black split ~140ms, obvious slide ~420ms, punch near 450ms.

### 2026-09-19 — Bias crack veins left; more quantity

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** Origin stays **right** (80%×40%). **VEINS only:** count **32 → 65**. Added long left-crossing primaries (`x` to about **-0.88…-0.95**), extra left branches (`t8–t18`) and left hairlines (`h7–h17`). Kept some **up / down / right** so it is not a one-way broom. Stagger: cores delay **0–0.03**, long left grow **~0.93–0.98**, far-left hair **~0.44–0.52**. Same ice strokes, `dashoffset` + Reanimated 4 `**jsProps`**. **Did not change** VideoView, crop, `mma-splash` video layer, `hapticAtMs`, intro shutter. No PNG, no cyan zigzags, no shards.
- **Why:** User: crack origin near the **right** edge, so bias direction **left** so the whole screen feels cracked; more veins.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect ice veins growing from the right across to the left edge.

### 2026-09-19 — Replace fighter clip (`videothanhcong2.mp4`)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `docs/splash-launch.md`
- **What:** Overwrote both splash videos with `C:\Users\PHONG\Downloads\videothanhcong2.mp4`. Kept the same URIs / names so JS does not change: Metro asset still `videothanhcong.mp4`; Android raw still `splash_loop` (no hyphens/caps). Valid MP4 (`ftyp` `isom`). **722,615 bytes** each (was **744,929**). SHA256 `3E15C243FC09229DB0610262334EE7BC5C8C78F019CD5AFC6615F94ED0AABD3F`. **Did not change** VideoView props, crop, cracks, shutter, or `splash-video-source.ts`.
- **Why:** User asked to swap the fighter clip.
- **Reload:** `assets/splash/videothanhcong.mp4` may hot-reload via Metro depending on URI / `require` vs packed raw. Android `**res/raw/splash_loop.mp4` is what `loadBundledSplashVideo()` uses** (`uri: "splash_loop"`) — replacing raw **needs a native rebuild** (debug APK / `npx expo run:android`) before the device plays the new clip. Metro-only reload will not update `R.raw.splash_loop`.
- **Result on device clip:** record PASS/FAIL after **native rebuild** + Metro on `Semester_8/reactnative-mobile`. Expect new fighter footage; cracks/shutter unchanged.

### 2026-09-19 — Split phone vibration vs crack start (`hapticAtMs` / `crackAtMs`) — REVERTED

- **Reverted:** single `hapticAtMs` again (haptic + cracks together); `crackAtMs` removed.

### 2026-09-19 — Tail loop hitch: seek before EOF (`videoTailLoopMs` / `videoTailLoopRate`)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Stopped waiting for `duration − 0.08` / EOF before seeking the last frames. Arm tail at punch or remaining ≤ RANGE; seek while playing; `player.loop = true` after arm as smoothness fallback. **Do not wrap VideoView.** No PNG.
- **Why:** User: loop hitchs (stops a beat then plays); want immediate continue. RANGE = `videoTailLoopMs`; SPEED = `videoTailLoopRate` default 1.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Tail loop last 1.25s only (`videoTailLoopMs` 1250; no whole-file loop)

- **Files:** `src/components/launch/splash-video-player.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Removed `**player.loop = true`**. Seek to `**max(0, duration − videoTailLoopMs/1000)**` on leave-window (after entering tail) or EOF. `**videoTailLoopMs` 1250.** Never t=0 unless duration < tail. One `hapticAtMs`. VideoView not wrapped. No PNG.
- **Why:** Native whole-file loop restarted the first seconds instead of punch tracking.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Measure punch-tracking PTS; tail 1250ms; skip duplicate TextureView seeks

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** Source **PTS tracking 2.791667–4.000** (duration **4.041667**, `**videoTailLoopMs` 1250**). Device freeze at last frame from splash **4.0s+**. No `player.loop`; wrap with lead **0.12s** while playing; skip same-frame / in-window seeks; cooldown **180ms**. VideoView not wrapped. No PNG.
- **Why:** 1000ms tail was short; EOF `currentTime` assign froze TextureView.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Seamless tail: concat last 1.25s ×3 (no TextureView seek)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `splash-video-player.tsx`, `src/theme/splash.ts`
- **What:** Baked **original + last 1.25s ×3** (re-encode; copy cut impossible — single IDR at 0). JS seek last-resort **0.40s** remaining, **one** seek, **no 180ms cooldown**. `player.loop` false. VideoView not wrapped. No PNG. **1,969,939 bytes**, duration **7.859s**.
- **Why:** Seek hitch between full video and loop.
- **Result on device clip:** record PASS/FAIL after native rebuild + Metro.

### 2026-09-19 — Tail loop last 1100ms (nudge start later)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`, `splash-video-player.tsx`
- **What:** Rebuilt from original 4.04s source: **last 1100ms ×3**. `**videoTailLoopMs` 1100.** Source seek start **2.941667s**. VideoView not wrapped. No PNG. **2,045,752 bytes**.
- **Why:** Drop leftover unused frames at the start of the 1250ms tracking window.
- **Result on device clip:** record PASS/FAIL after native rebuild + Metro.

### 2026-09-19 — Tail loop last 500ms (rebuild baked concat; JS 500 did nothing)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`
- **What:** `**videoTailLoopMs` 500 does not change baked concat** until ffmpeg rewrite. Rebuilt **original + last 500ms ×3**. Source seek start **3.541667s**. Concat video **5.583333s**. JS last-resort seek **duration − 0.5**. VideoView not wrapped. No PNG.
- **Why:** Loop still used baked 1100ms copies; JS seek is last-resort only.
- **Result on device clip:** record PASS/FAIL after native rebuild + Metro.

### 2026-09-19 — Tail loop last 1000ms (interrupt 500ms rebake)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`
- **What:** User **tăng 1000** → RANGE **1000ms**. Rebuilt **original + last 1000ms ×3**. Source seek start **3.041667s**. Concat video **7.083333s**. `**videoTailLoopMs` 1000.** JS last-resort **duration − 1.0**. VideoView not wrapped. No PNG.
- **Why:** 500ms baked window was too short; JS alone cannot change in-file copies.
- **Result on device clip:** record PASS/FAIL after native rebuild + Metro.

### 2026-09-19 — Tail loop last 900ms (rebuild baked concat)

- **Files:** `assets/splash/videothanhcong.mp4`, `android/app/src/main/res/raw/splash_loop.mp4`, `src/theme/splash.ts`
- **What:** RANGE **900ms**. Rebuilt **original + last 900ms ×3**. Source seek start **3.141667s**. Concat video **6.791667s**. **`videoTailLoopMs` 900.** JS last-resort **duration − 0.9**. VideoView not wrapped. No PNG.
- **Why:** User asked 900ms baked RANGE.
- **Result on device clip:** record PASS/FAIL after native rebuild + Metro.

### 2026-09-19 — Add 20 leftward crack veins

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** **VEINS only.** Count **65 → 85**. Appended **20** new leftward paths; `x` negative, spanning **−0.4…−0.95**. Existing veins kept. Ice `dashoffset` + `jsProps`. VideoView unchanged. No PNG.
- **Why:** User: tăng lên 20 tia leftward.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Fan the 20 new veins (stop left pile)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** **VEINS pts only** for ids **p-left-n1–n12**, **t-left-n13–n17**, **h-left-n18–n20**. Count stays **85**. Repointed those 20 off the left-horizontal stack into a fan: up, up-left, up-right, right, down, down-left, down-right. Organic ice zigzags, unique paths, mixed lengths (long down/up-left vs short right). Existing 65 unchanged. Ice `dashoffset` + `jsProps`. **VideoView not touched.** No PNG.
- **Why:** User: the 20 new veins piled LEFT horizontally; must fan some diagonal up/down-left, some down, some RIGHT, some up.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`. Expect 20 extra cracks spreading around punch origin, not a left-only band.

### 2026-09-19 — Crack field clipPath spread + overlay shatter scale

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What:** SVG `clipPath` circle at punch origin, `r` 0→cover (`**crackSpreadMs`**). Dashoffset grow kept; strokeWidth not inflated. After grow/spread, `crackLayer` only scales **1→`shatterScale` 1.2** about origin + fade `**shatterMs` 300** then `onFinish`. **VideoView not wrapped.** No PNG / zoom-6 / shards. Crop / haptic / video source unchanged.
- **Why:** Field spread from punch; light overlay shatter after veins finish.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Shatter leave not gated on isDataReady

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Leave no longer waits for prefetch. Grow+spread complete → shatter scale/fade → `onFinish`. `isDataReady` remains LaunchGate skeleton only.
- **Why:** User does not want cracks frozen until data is ready.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Restore veins: overflow circle mask (not ClipPath r)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Dropped Android-broken SVG `ClipPath` animated `r`. Field spread is a circular overflow View from punch; SVG identity. Dashoffset + fan kept. Shatter scale/fade + no `isDataReady` hold kept. VideoView not wrapped. No PNG.
- **Why:** Clip-spread made the whole crack overlay invisible.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.
- **If FAIL:** do not restore animated SVG `ClipPath` `r`. **BANNED.**

### 2026-09-19 — Restore per-ray dashoffset (remove circular overflow blob)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Removed circular overflow disc. Spread = per-ray `strokeDashoffset`. Shatter after `crackGrowMs`. No PNG. VideoView not wrapped.
- **Why:** User rejected blob/window; wanted individual rays; suspected PNG (not used).
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.
- **If FAIL:** do **not** restore circular overflow mask or ClipPath `r`.

### 2026-09-19 — Revert circular field-spread (pre-clip per-ray)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Dropped leftover circular A+B keys (`crackSpreadMs`, `shatterScale`/`shatterMs`, overlay scale). Restored pre-clip **per-ray** SVG + dashoffset fan. Leave = `crackRevealMs`+`crackHoldMs`+`fadeMs`. **Kept** `isDataReady` ungate. No PNG. VideoView not wrapped.
- **Why:** User asked to revert to tản hướng / từng tia before field-clip experiments.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.
- **If FAIL:** do **not** restore ClipPath `r` or circular overflow mask.

---

### 2026-09-19 — P0 mount-after-glass + ray cover + vector fill + JS tail wrap

- **Files:** launch-gate, mma-splash, splash-glass-shatter, splash-video-player, theme/splash.ts, docs/splash-launch.md
- **What:** P0 mount Stack only after opaque vector glass; P1 edge veins + WAVE2; P2 sibling fill; P3 fade/unmount video; P4 JS tail wrap (no player.loop). No PNG / zoom-6 / CASE C / ClipPath r. Metro JS only.
- **Why:** Agreed cinematic plan.
- **Result on device clip:** record PASS/FAIL after Metro reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Dense WAVE2 + opaque glass lock + no fade-unmount flash

- **Files:** `src/theme/splash.ts`, `mma-splash.tsx`, `splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** WAVE2 was too short/late (`crackGrowMs` 560); glass never locked to opacity 1; VideoView unmounted at P3 fade start (`fadeMs` 280) → flash. Locked opaque ice View, unmount video under it, then mount Stack, then 480ms fade. 22 long WAVE2 rays from origin to edges. Metro JS only.
- **Why:** User: cracks unchanged; giật chớp to main.
- **Result on device clip:** record PASS/FAIL after Metro-only reload.

### 2026-09-19 — Jagged mesh + tail until glass lock + no bezel rim stroke

- **Files:** `splash-glass-mesh.ts`, `splash-glass-shatter.tsx`, `splash-video-player.tsx`, `mma-splash.tsx`, `theme/splash.ts`, `docs/splash-launch.md`
- **What:** Jagged 2–4-kink polylines (shared with faces); VideoView stays until sheet opacity 1; no perimeter/ring1/`#eef4f8` bezel strokes. Tail keys: `videoTailSeekLeadSec` 0.62, `videoTailSeekCooldownMs` 320. No PNG / ClipPath r / zoom-6 / `player.loop`. Metro JS only.
- **Why:** User: pizza cracks; loop hitch; white rim on screen edge.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Origin-only crack grow + all ice faces opaque

- **Files:** `splash-glass-mesh.ts`, `splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What:** Strokes = origin-starting spokes only (no independent ring/outer dashoffset). Faces fill in one SVG (`fillOpacity` + jsProps), forced to 1 after `facetFillMs`; outer fan uses rect edges; ice fills not `#000`. Metro JS only.
- **Why:** Premature mid-screen cracks; ~3 ice cells, rest black.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Post-crack stall: pre-mount ice fills, keep tail playing

- **Files:** `splash-glass-shatter.tsx`, `mma-splash.tsx`, `splash-video-player.tsx`, `docs/splash-launch.md`
- **What:** Do not insert overlay hosts at `showFacets` (that froze JS + TextureView tail). Ice fills pre-mounted in the stroke Svg; shard Views only after glass lock; video until `glassLocked`. Metro JS only.
- **Why:** User: 2s khựng after last crack; fighter loop stopped until glass opacity 1.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — Video teardown wait then Reanimated 3D ice break

- **Files:** theme/splash.ts, mma-splash, splash-video-player, splash-video-types, splash-glass-shatter, launch-gate, docs/splash-launch.md
- **What:** Pause + unmount VideoView under opaque sheet; wait `videoTeardownMs` 150; then onAppCovered; then Reanimated 3D face break (`shardBreakMs` 520). No fighter-frame flash. Metro JS only.
- **Why:** Last fighter frame then home after ice opacity 1.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`.

### 2026-09-19 — FacetShard RN transform + lock-then-break (no fighter flash)

- **Files:** `splash-glass-shatter.tsx`, `mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Removed invalid `translateZ` (RN Invariant Violation at FacetShard). Transforms are only `perspective` (first), `translateX/Y`, `rotate` / `rotateX` / `rotateY` as `` `${n}deg` ``, per-shard `scale` ~1.22 (not overlay zoom-6). Ice lock View stays opaque until video unmount + `onAppCovered` (app/skeleton under sheet) + shards mounted; sheet fade starts 80ms after `setBreaking(true)`. `onFinish` after `shardBreakMs` + 160 (not same tick as break). `videoTeardownMs` 220. OverlayHost stays until cinematic finish. No PNG, no VideoView in Animated.View, no ClipPath r, no three.js, no CASE C.
- **Why:** Crash killed shatter before pieces could fly; lock unmount + glassFill fade on the break tick flashed the TextureView last frame / app.
- **Result on device clip:** record PASS/FAIL after Metro-only reload on `Semester_8/reactnative-mobile`. Expect ice pieces fly from punch (~520ms) then home, no fighter-frame pop.

### 2026-09-19 — Sandwich puzzle: video under app, shards only on top

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Old plan failed: full-screen ice + SVG fill stayed during “break” (flying copies invisible, then snap); video and ice both lived in `overlayHost` **above** the app so clearing ice showed TextureView; unmounting TextureView blit last fighter frame on top of RN. **New sandwich (Metro JS only):** after ice opacity 1 — **(1) bottom** `VideoView` stays mounted (pause OK, not unmounted at transition); **(2) middle** `onAppCovered` mounts opaque Stack / `DashboardSkeleton` with Android **elevation 14** above TextureView (`isDataReady` does not hold cinematic); **(3) top** puzzle **mesh faces** only. Cheap one-SVG strokes+fills until cover (cracks unchanged). At lock: clone `FacetShard`s (pixel-match, `fly=false`) **under the sheet** 1–2 rAF, hide SVG fills + drop full-screen `glassFill` lock, **then** fly those same hosts (`perspective`, `rotateX/Y` / `rotate` as `` `${n}deg` ``, translate from punch, fade). No 24 shard hosts at punch. Unmount VideoView only on `onFinish` with cinematic overlay (app already opaque on top of it). LaunchGate no longer stacks the whole splash overlay above the app; `MmaSplash` owns z-order and keeps `appLayer` mounted across finish. **No** VideoView in `Animated.View`. **No** PNG. **No** ClipPath r/disc. **No** zoom-6. **No** `translateZ`. **No** three.js. **No** CASE C. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. Transparent VideoView; `#000` on LaunchGate root + video sibling only.
- **Why:** User OK’d sandwich/puzzle after lock-then-unmount-video still flashed fighter / hid shards.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect ice lock → home/skeleton visible through flying puzzle holes (never fighter) → shards fade → home. No 2s hitch at punch.
- **If FAIL:** do not restore full-screen ice during fly; do not put video+ice in one overlay above the app; do not unmount TextureView in the same beat as dropping ice; do not mount FacetShards at punch.

### 2026-09-19 — Shatter z-order: shards on top, crude home in holes (no Bones sandwich)

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Device never showed opaque ice **breaking apart**. Covering layers: (1) full-screen `glassFill` lock View **after** `crackLayer` (sheet stayed on top of `FacetShard`s); (2) cheap SVG `FacetFill` + `fan-cover` rect drawn **after** shard hosts; (3) `DashboardSkeleton` sandwich `elevation` 14–20 as fake “app”; (4) LaunchGate **unmounted Stack until `onFinish`**, so holes had no crude home. **Fix (Metro JS only):** after ice opacity 1 — pause + **unmount VideoView under still-opaque sheet** → `onAppCovered` mounts **real LaunchGate children** (MMA Vision dashboard) **under** the overlay → clone shards → **drop sheet + hide SVG ice in the same tick as fly**. Overlay stack order: sheet **behind**, shard hosts **front**. Full-screen overlay hosts `elevation` **0** (elevated full-screen Views paint an opaque Android card and hide holes). Per-shard `elevation` 12 only. No `DashboardSkeleton` in the splash sandwich. `onFinish` only after `shardBreakMs` + `leaveAfterBreakMs` of visible fly. `lockLeaveTimeout` starts after home `onLayout`, 3200ms. No PNG, no VideoView in `Animated.View`, no ClipPath `r`, no zoom-6, no `translateZ`, no three.js, no CASE C.
- **Why:** User: shatter hidden/overlapped; app has no real backend — holes = crude home, not Bones.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect ice lock → puzzle pieces fly (perspective / rotateX/Y / translate, no translateZ) → MMA Vision through holes → overlay off. Not fighter, not Bone skeleton.
- **If FAIL:** do not put `glassFill` above shards during fly; do not remount splash `DashboardSkeleton`; do not mount Stack while VideoView is still in the tree.

### 2026-09-19 — Keep fighter playing under crude home (no pause, no Bones sandwich)

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/dashboard-skeleton.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** User OK’d consolidated leave: splash **is** the work; under glass = crude **LaunchGate children** (MMA Vision), **not** `DashboardSkeleton` sandwich / Bones. **Do not pause** the fighter; tail-loop seek `duration − videoTailLoopMs` near EOF until `onFinish` (**never** `player.loop`, **never** full-clip `currentTime=0`). Unmount `VideoView` only with overlay on `onFinish` (overlay **off first**, then video). **Z-order after ice lock:** (1) FacetShards only on top; (2) opaque home, Android **elevation 14** above video; (3) fighter still playing tail under home; (4) LaunchGate root `#000`. During rays+faces, home **unmounted**. Punch overlay opacity **1** immediately (`timeUpdate >= hapticAtMs`). Sheet lock `glassCoverMs` force opacity 1 **HOLD**, then `onAppCovered`. Paint gates = `onLayout` w/h > 0 **AND** `paintExtraFrames` **8** (not 2 rAF). Clone shards `fly=false` **under** the sheet until every host lays out; `shardCoverSettleMs` after **real** cover (removed 480ms fallback-as-cover). Then `hideSvgIce` + drop sheet (no `glassFill` / SVG ice **on top** of flying shards). Fly `shardBreakMs` (perspective, `rotateX/Y` as `` `${n}deg` ``, translate from punch, fade; **no** `translateZ`). Hang + `lockLeaveTimeoutMs` **always** force live if overlay stuck. `StatusBar` after live host painted + extra frames. Keys: `hapticAtMs`, `crackGrowMs`, `facetFillMs`, `glassCoverMs`, `glassLockDelayMs`, `appPaintSettleMs`, `shardCoverSettleMs`, `paintExtraFrames`, `leaveAfterBreakMs`, `lockLeaveTimeoutMs`, `videoTailLoopMs`, `videoTailSeekLeadSec`, `videoTailSeekCooldownMs`, `shardBreakMs`. Combo: `textureView` + `fill` + `useExoShutter true`. Transparent VideoView; `#000` only root / sibling behind video while mounted. **No** PNG. **No** VideoView in `Animated.View`. **No** ClipPath r. **No** zoom-6. **No** `translateZ`. **No** three.js. **No** CASE C.
- **Why:** User insisted keep playing; Bones sandwich was not the product; video in the overlay above home made shard holes read fighter unless paused/unmounted.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect punch → rays → faces → ice lock → MMA Vision under ice → shards fly over **home** (fighter still looping **under** home, not in holes) → overlay off → video off → live. Never stuck black. Never pause at lock.
- **If FAIL:** do not pause at lock; do not put VideoView in the overlay above home; do not drop sheet before shard hosts cover; do not restore Bones sandwich / `glassFill` on top of fly; do not `setCinematic(false)` while fighter is still composited above home.

### 2026-09-19 — Clone shards on homeMiddle layout; never hang-unmount cinematic

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Device logs: `onAppCovered` then **nothing** until `hang after ice lock — force shard fly` / `sheetRelease` / `shardBreak` / `hang launchGate` / `onFinish` / **then** `livePainted`. Never `homePaint settle`, `shardClone`, `shardsCovered`. Clip 4–9s: frozen ice, then fighter pop (overlay torn down). **Cause:** `shardClone` waited on LaunchGate `homePainted={livePainted}` from `homeSlot` `onLayout`, which **does not fire under ice**; `livePainted` only ran on the **live** host after `enterLive`. Hang then `startShardFly` **without** `shardsMounted` (no FacetShards) and LaunchGate `splashHangMs+800` **unmounted MmaSplash** so fly could not run. **Fix (Metro JS only):** clone from `MmaSplash` `homeMiddle` `onLayout` w/h>0 after ice lock + `homeSlot` mounted (fallback clone if children never layout — do not wait 12s). Removed `homePainted` prop. `startShardFly` **blocked** unless `shardsMountedRef`. Hang-after-lock **clones then flies**, never flies empty. LaunchGate hang **skips** `enterLive` while `homeUnderIce && phase overlay`. `lockLeaveTimeoutMs` starts at ice-cover (not `livePainted`) only if overlay still stuck after the fly window. `finishToApp`: `keepVideo` false → overlay off → `onFinish` (video keeps tail-looping until that beat; **no pause**). Sheet stays behind shards (`overlayStack` elevation 0; `crackLayerOnTop` elevation 24). **Did not touch** inner-page skeleton / `DashboardSkeleton` routes. No PNG, no VideoView in `Animated.View`, no `translateZ`, no ClipPath `r`, no zoom-6, no three.js, no CASE C.
- **Why:** Puzzle fly never mounted; hang killed the overlay onto the last fighter frame.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect logs: `glassCovered` → `onAppCovered` → `homeMiddle layout` / `homePaint settle` → **`shardClone` → `shardsCovered` → `sheetRelease` → `shardBreak` → `onFinish cinematic` → `onFinish launchGate`**. Then `livePainted` / `liveReveal`. Pieces fly in many directions; holes = crude home; video tail-loops until real onFinish.
- **If FAIL:** do not gate clone on LaunchGate live host layout; do not `enterLive` from hang during cinematic; do not `startShardFly` with zero shard hosts.

### 2026-09-19 — Clip 4–9s: clone on homeMiddle; hang must not kill overlay

- **Files:** `src/components/launch/launch-gate.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Clip FAIL 4–9s: ice lock ~7.0 → fighter FLASH ~7.1 → ice back → shards jump/fly **on fighter** not home → BLACK → home pop ~8.9. Logs: **no `shardClone`**; hang force fly empty; **hang launchGate unmounted MmaSplash**; `livePainted` after overlay dead. **Leave order (JS only):** ice lock + `onAppCovered` mounts crude LaunchGate **children** (not Bones / not inner-page skeleton edits) as `homeMiddle` (opaque, elevation 14 > TextureView). Clone on **`homeMiddle` onLayout w/h>0** + `paintExtraFrames` + `appPaintSettleMs` — **not** LaunchGate `livePainted` (homeSlot no longer uses that onLayout). Short **`cloneFallbackMs` 360** if children never layout (never wait 12s). FacetShard cover set is **not** cleared when `shardsMounted` turns true. `startShardFly` only if **shardsMounted and shardsCovered**. Hang-after-lock: clone then wait cover then fly — never empty fly. LaunchGate hang **skips `enterLive`** while cinematic hold / `homeUnderIce` && overlay. **`lockLeaveTimeout` starts only after `onFlyStarted`**, not at ice lock. `finishToApp`: **keepVideo false** while home+shards still covering → extra frames → overlay off → `onFinish` (video tail-loops until that beat; **no pause** at lock). During lock, overlay/sheet elevation **above home** so ice stays on top; on `sheetRelease` overlay elevation **0**, sheet **unmounted**, shards elevation 24 (no glassFill/SVG ice on flying pieces). Sheet drop only after every FacetShard onLayout + `paintExtraFrames` (not 2 rAF as cover). Sandwich: video playing bottom, home middle, shards top. **Did not touch** DashboardSkeleton routes. Combo: `textureView` + `fill` + `useExoShutter true`. No PNG, no VideoView in `Animated.View`, no `translateZ`, no ClipPath `r`, no zoom-6, no CASE C, no `player.loop`.
- **Why:** User OK’d 4–9s clip plan. Prior pass still gated/logged livePainted on under-ice home, hang tore overlay onto TextureView, fly ran with no hosts.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect logs: `glassCovered` → `onAppCovered` → `homeMiddle layout` → **`shardClone` → `shardsCovered` → `sheetRelease` → `shardBreak` → `onFinish cinematic` → `onFinish launchGate`** → then `livePainted`. Pieces fly many directions over MMA Vision; holes = home, not fighter, not `#000`.
- **If FAIL:** do not `enterLive` from hang during cinematic; do not start `lockLeaveTimeout` at `onAppCovered`; do not `startShardFly` before shard hosts cover; do not log `livePainted` on the under-ice slot; do not pause at lock; do not restore Bones sandwich.

### 2026-09-19 — One ice layer: fill hosts ARE fly hosts
- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Two screens were cheap **FacetFill** polygons + CrackStroke, then **`shardClone` ~24 FacetShard Views** at cover — dropping (1) and showing (2) hitch/flash. **Fix (Metro JS only):** **one** `FacetShard` host set mounts at **`showFacets`** (`fly=false`); those polygons **are** the ice fill (`fillOpacity` via `fillClock`). CrackStroke SVG is **strokes only** (no FacetFill, no fan-cover rect). Backup sheet ramps **under** shards. At fly: hide strokes (`hideStrokeSvg`), **same** hosts `breaking=true`. Removed `shardsMounted` / `cloneShards` / `shardClone` log. Logs: **`iceHostsReady` → `sheetRelease` → `shardBreak`**. `startShardFly` only if those hosts laid out. Hang-after-lock waits hosts / flies — **does not** unmount overlay mid-fly. Tail-loop no pause. Holes = crude home. No Bones inner page. No PNG. No VideoView in `Animated.View`. No `translateZ`. No ClipPath `r`. No zoom-6. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** User: cracked cells already on screen must be the cells that fly; two renders looked like a new frame.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect fill → lock → **same** pieces fly over MMA Vision, no ice-swap hitch. Logs: `facetsFill` → `iceHostsReady` → `glassCovered` → `onAppCovered` → `homeMiddle layout` → `sheetRelease` → `shardBreak`.
- **If FAIL:** do not restore FacetFill + shardClone; do not unmount fills and mount new Views in the same beat; if 24 views at `showFacets` hitch, pre-mount hosts at punch with opacity 0 and only raise `fillOpacity` (still one host set).

### 2026-09-19 — Hosts from punch + overlay Z above home + no dead-end watchdogs
- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What:** Audit of the “one ice layer” pass found **4 real defects** left, all fixed (Metro JS only).
  **(1) `iceHostsReady` could never fire → 12s hang.** `onHostLaidOut` was gated on `showFacets`, and the laid-out Set was cleared whenever `showFacets` was false. Now the **one** `FacetShard` host set mounts with the overlay **at punch** (`fillOpacity` 0 — the commit that already inserts the strokes, so there is no second insertion burst at `facetsFill` and no clone at cover), `onHostLaidOut` is **not** gated on fills, and the Set is invalidated **only** when the mesh (host ids) changes. A 120ms poll marks ready on **all** hosts, or on a **partial** set after `cloneFallbackMs` (log `iceHostsLaidOut all|partial n/total` then `iceHostsReady`). `showFacets` now only runs `fillClock`.
  **(2) Home drew OVER the flying pieces.** `overlayStack` dropped to **elevation 0** on `sheetRelease` while `homeMiddle` was **elevation 14`** → Android sorts siblings by Z, so the opaque home covered the whole overlay exactly when the shards started to fly (ice “pop”, no visible break). A child’s own elevation (per-shard 12) **cannot** lift it above an uncle view, so that did nothing. Now `homeMiddle` **elevation 8** (still above the TextureView), `overlayStack` **elevation 22 for the whole cinematic** (no `overlayStackLock` toggle), sheet `elevation 0` **below** the faces and **unmounted** at release, `crackLayer` 24, strokes `elevation 8` **above** `shardLayer` 2 (zIndex and elevation now agree), per-shard elevation **0** (an elevated transparent box also draws a rectangular shadow).
  **(3) Dead-end watchdogs.** MmaSplash’s one-shot hang logged `wait ice hosts` and **never looked again** (infinite ice lock); LaunchGate’s `hang launchGate skipped — cinematic` also never re-armed. MmaSplash hang is now a **200ms watchdog**: fly in progress → never cut; ice locked + hosts ready → force fly; ice locked + **zero** hosts after `hostWaitGiveUpMs` **1400** → `finishToApp` (home covers → video off → overlay off), never an empty fly, never a stuck lock. LaunchGate keeps skipping the hang for the cinematic but arms a **final** deadline (`lockLeaveTimeoutMs`, now **3000**) so the app is always reachable; taking the splash down takes VideoView with it, so no fighter is ever left uncovered.
  **(4) Black pop at the phase swap.** LaunchGate root is now the **app background**, not `#000`; `#000` under the fighter still comes from MmaSplash `blackBehind`. Also split the reused frame-chain cancel ref into settle / finish chains.
  **Unchanged:** ONE host set (fills **are** the fly hosts), no `shardClone`, tail-loop with **no pause** / no `player.loop` / no full-clip `currentTime=0`, `finishToApp` = `keepVideo` false → paint frames → overlay off → `onFinish`, `isDataReady` does not hold, `DashboardSkeleton` / Bones untouched. No PNG, no VideoView in `Animated.View`, no `translateZ`, no ClipPath `r`, no zoom-6, no three.js, no CASE C. Combo unchanged: `textureView` + `fill` + `useExoShutter true`.
- **Why:** Device logs: no `iceHostsReady`, 12s hang, forced empty fly, `hang launchGate` unmounting `MmaSplash`, `livePainted` after the overlay was dead; clip: ice lock → fighter flash → ice pop → shards on fighter → black → home pop.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expected logs in order: `punch` → `iceHostsLaidOut` → `iceHostsReady` → `facetsFill` → `glassFillRamp` → `glassCovered` → `onAppCovered` → `homeMiddle layout` → `homePaint settle` → **`sheetRelease` → `shardBreak`** → `keepVideo off cinematic` → `overlay off cinematic` → `onFinish cinematic` → `onFinish launchGate` → **then** `livePainted` / `liveReveal`. Whole cinematic ≈ 4.2s (well inside the baked clip), fighter tail-looping under the opaque home the entire time.
- **If FAIL:** do **not** drop `overlayStack` elevation below `homeMiddle`; do **not** re-gate `onHostLaidOut` on `showFacets`; do **not** clear the laid-out Set when fills turn on; do **not** make either hang a one-shot that can return without re-arming; do **not** unmount `MmaSplash` while `fadingRef` (fly) is running.

### 2026-09-19 — Home children painted under ice BEFORE sheetRelease
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What was still flashing:** After the 9-step jsProps/floor pass, ice cells stayed opaque and the fly clocks were real, but `sheetRelease` still gated on an **EMPTY** `homeMiddle` (`floorPainted`). LaunchGate children mounted in a **second commit** after that (or only after overlay off). Shard holes stayed flat `#090A0C`; when the overlay died, home popped in — a FLASH/JUMP, not a multi-direction glass-shard burst over MMA Vision.
- **What (Metro JS only):** At `glassCovered`, fire `onAppCovered` **immediately** so real LaunchGate children mount under the ice. Empty `homeMiddle` (`palettes.dark.bg`) stays as the anti-fighter **backup UNDER** those children. `homeSlot` is no longer gated on `floorPainted`. Fly waits for **homeMiddle AND homeSlot** `onLayout` w/h > 0 + `paintExtraFrames` (`homePaint settle`) **then** `appPaintSettleMs` + `shardCoverSettleMs` → `sheetRelease` → `shardBreak`. `startShardFly` refuses to run without `floorPainted` (never uncover TextureView) **and** without home painted (unless `homeContentGiveUpMs` 1200 — fly over floor, never hang). Hang-after-lock waits `floor/hosts/home`. No liveHost remount: children stay in this one host. **Did not touch** FacetShard / jsProps-fill / `breaking` prop / stroke unmount / VideoView / Bones / inner-page skeleton. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. No PNG, no VideoView in `Animated.View`, no `translateZ`, no ClipPath `r`, no zoom-6, no three.js, no CASE C, no `player.loop`, no pause at lock.
- **Why:** User: relationship (A) ice at opacity 1 after cracks vs (B) home still a flash/jump. Behind the flying shards the screen must **already** be the inner/home page. Do not wait until shards have fully flown away to start the page transition and render home.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Expected log order:** `punch` → `punchAnchor` → `iceHostsLaidOut` → `iceHostsReady` → `facetsFill` → `glassFillRamp` → `glassCovered` → **`onAppCovered`** → `floorMount` → `homeMiddle layout` → `floorPainted` → **`homeSlot layout` → `homePaint settle` / `home children painted` (UNDER ICE)** → **`sheetRelease` → `shardBreak`** → `probe shardBreak+160 cellOpacity 1.0` → `probe flyEnd` → `keepVideo off cinematic` (`floorPainted true`, `homePainted true`) → `overlay off` → `onFinish cinematic` → `onFinish launchGate`. Home children painted **BEFORE** `sheetRelease`. Holes during fly = MMA Vision, not fighter, not empty `#090A0C` wait, not a later liveHost swap.
- **If FAIL:** do **not** put `fillOpacity` back on `jsProps`; do **not** reintroduce a `breaking` React prop; do **not** unmount the stroke layer; do **not** fly without `floorPainted`; do **not** delay home render until after fly / onFinish / live phase; do **not** remount children from `homeSlot` into a `liveHost`; do **not** restore Bones sandwich. If home never layouts, `homeContentGiveUp` is the lever (fly over floor), not a 12s hang.

### 2026-09-19 — Burst on visible ice + home not trapped in floorMounted
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/app/_layout.tsx`, `src/components/system-chrome.tsx`, `src/components/launch/splash-lock.ts`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **Bugs:** (1) `sheetRelease` then **8 rAF** then `flyMs`, plus `appPaintSettleMs`+`shardCoverSettleMs` (112ms) after floor+home paint → ice froze, then burst. `useSplashLock` painted Stack `contentStyle` `splash.canvas` `#000` so holes were unreadable. (2) `homeSlot` only rendered inside `floorMounted`. `enterLive` / hang / `videoFailed` / `noFloor` never set `floorMounted` → overlay off, children never in the tree, lock still `#000`.
- **What (Metro JS only):** Home host mounts when `floorMounted` **OR** `homeSlot` **OR** cinematic finished (`splashActive` false). `finishToApp` always `onAppCovered` + `setFloorMounted` **before** `keepVideo` false → paint frames → overlay off. `splashActive` false runs the same teardown. LockedStack / SystemChrome under ice use `colors.bg` (`#090A0C`), not `splash.canvas`. `flyMs` `withTiming` on the **same beat** as `sheetRelease` (no 8 rAF between drop and transform). Sheet stays under shards; unmount **1 frame** after fly has displacement. Stroke layer **fades**, never unmounts. Same FacetShard hosts. Floor/home `paintExtraFrames` **8** kept as paint gates only. No extra hold after `floorPainted` + home painted. Video: no pause at lock; tail wrap `duration − videoTailLoopMs`; `player.loop` false; VideoView unmount only in `finishToApp` while floor/sheet/shards cover. `overlayStack` elevation **22** entire cinematic. LaunchGate hang does **not** `enterLive` mid-fly; `lockLeaveTimeout` only after `onFlyStarted`; removed hang-deferred `enterLive`. Combo: `textureView` + `fill` + `useExoShutter true`. No PNG, no VideoView in `Animated.View`, no `translateZ`, no ClipPath `r`, no zoom-6, no three.js, no CASE C, no Bones / inner skeleton, no second host tree.
- **Why:** User OK’d diagnosis: attach burst to visible ice; never black-screen because home was trapped in `floorMounted`.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Expected logs:** `home children painted` **BEFORE** `sheetRelease`; `shardBreak` immediately after `sheetRelease` (no empty 8-frame gap); `probe shardBreak+160` `cellOpacity` 1 + `flyMs`>0.
- **If FAIL:** do **not** put 8 rAF back between `sheetRelease` and `flyMs`; do **not** gate home on `floorMounted` only; do **not** paint Stack `#000` under ice; do **not** `enterLive` from hang during fly; do **not** drop `overlayStack` below `homeMiddle` 8; do **not** pause/unmount VideoView at ice lock; do **not** add a second shard host tree. If motion is still weak, only bump `shardDistBase` / `shardStaggerMs`.

### 2026-09-19 — Floor sibling ≠ Stack; never overlay-off ice lock; verbose Metro beats
- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/system-chrome.tsx`, `src/app/_layout.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** (1) **`floorWaitGiveUp` / `finishToApp("noFloor")` no longer drop the overlay** while the ice sheet is up and FacetShard hosts are ready (`iceLockIsOnlyCover`). That was the clip bug: ice vanished to black, no fly. Logs `floorWaitGiveUp — hold ice lock` and waits for floor/home layout, then **`sheetRelease` + `flyMs` on the same beat**. Hang `hangNoFloor` same hold. (2) **Layout gate split from Stack:** empty `floorSibling` (`absoluteFill`, `palettes.dark.bg` `#090A0C`) has its **own** `onLayout` → `floorPainted`. `homeSlot` / `LockedStack` is a **different sibling** (`homeSlotHost`). Floor paint does not wait on ScreenStack measure. (3) Fly when ice hosts ready + sheet opaque + **floor sibling** painted; `homeContentGiveUp` may fly over floor color if Stack children are slow. Sheet stays under shards **1 frame** after `flyMs>0`. Same FacetShard hosts. (4) Late `onLayout` is **not** swallowed by `transitionedRef` before fly starts. (5) **SystemChrome** does **not** set `hidden`/`translucent` at `onAppCovered` (LockedStack mount under ice); those change only after `onFinish`. (6) LaunchGate hang still **skips `enterLive` mid-fly / cinematic**. Video: no pause; tail wrap `duration − videoTailLoopMs`; `player.loop` false; VideoView unmount only in `finishToApp` while cover is up. `overlayStack` elevation **22** whole cinematic. Combo unchanged: `textureView` + `fill` + `useExoShutter true`. (7) **Verbose `[splash]` timeline:** every gate (including 0×0 `floorLayout` / `homeSlot layout` / `videoLayout`, ice host 0-size, `cloneFallback`, watchdog flags, `startShardFly skipped` reasons, `sheetRelease`+`flyMs`+`shardBreak` same tick, `probe shardBreak+160` cellOpacity+flyMs, keepVideo/overlay/onFinish with flags). No per-frame worklet spam.
- **Why:** User OK’d the plan: crude overlay-off while ice lock was the only cover; floor `onLayout` nested Stack so `floorPainted` starved; next device run needs a full Metro beat log.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Expected logs:** `home children painted` **OR** `homeContentGiveUp` **BEFORE** `sheetRelease`; `shardBreak` immediately after `sheetRelease`; `probe shardBreak+160` `cellOpacity` **1** + `flyMs` **> 0**; **NO** `overlay off` before fly starts when ice is locked. If `floorWaitGiveUp` fires with hosts+sheet, expect `hold ice lock`, never `overlay off` / `noFloor` teardown.
- **If FAIL:** do **not** restore `finishToApp("noFloor")` overlay-off while `showSheet && iceHostsReady`; do **not** nest Stack inside the floor layout gate; do **not** change StatusBar hidden/translucent at `onAppCovered`; do **not** `enterLive` from hang mid-fly; do **not** pause VideoView at ice lock; do **not** put VideoView in `Animated.View`; do **not** PNG/stills; do **not** CASE C; do **not** `translateZ` / jsProps on SVG fill / ClipPath r / Bones.

### 2026-09-19 — Floor height 0 ice-lock hang: explicit cover box + fly without forever height>0
- **Files:** `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **Proven (this log + frozen-ice screenshot):** Ice lock 24/24, `glassCovered`, `sheetUp`, `overlayAlive`, `homeSlot` mounted, LockedStack under ice, chrome unchanged. `homeMiddle` / `homeSlot` / `floorLayout` all **384×0**. `videoLayout` **414.57×898.49** (full screen on the video layer). `floorPainted` stayed false because code required height>0. `floorWaitGiveUp — hold ice lock` then watchdog forever; `flyStarted` false; no `sheetRelease` / `shardBreak` / `homeContentGiveUp`. Holding ice was the new hang (prior crude overlay-off was black).
- **What (Metro JS only):** Floor sibling (elevation **8**, under overlay **22**) is still a sandwich sibling of LockedStack, `pointerEvents="none"`. **Do not use `absoluteFill` `bottom:0`/`right:0` on that host** — Yoga stretched it to the 0-tall parent. Fill = `position:"absolute"` left/top **plus explicit width/height** from `videoLayout` / LaunchGate root `onLayout` / `Dimensions.get("window")` (`minHeight` too). Same cover box on `homeSlotHost` so Stack has a non-zero host. `onLayout` width>0 height===0 logs `floorLayout 384 0 — treat as collapsed`, then `floor height fallback` (source + numbers), then `floorPainted` after `paintExtraFrames`. `homeContentGiveUp` **no longer waits on `floorPainted`**. Once the floor is sized, giveUp uses `homeContentGiveUpAfterFloorMs` **400**. `startShardFly` may run if floor is painted **or** cover/video height>0, after home painted **or** giveUp — `sheetRelease`+`flyMs` same tick. Ice lock still **never overlay-off** before fly; `floorWaitGiveUp` applies the height fallback instead of waiting forever. Watchdog logs every **1s** (not 200ms). StatusBar unchanged at `onAppCovered`. No VideoView in `Animated.View`, no `translateZ`, no jsProps fill, no PNG, no Bones, no CASE C, no pause.
- **Why:** User hung on ice after the floor-sibling patch; 0-height floor starved `floorPainted` and therefore `homeContentGiveUp`.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Expected logs:** `floorLayout 384 0` (if still collapsed) → `floorLayout 384 0 — treat as collapsed` → `floor height fallback 898` (or similar, `source videoLayout|root|window`) → `floorPainted` → `homeContentGiveUp` **or** `homePaint settle` → `sheetRelease` + `flyMs` same tick → `shardBreak` → `probe shardBreak+160`. Ice **must move**. No infinite watchdog-only hang. Holes may be `#090A0C` if Dashboard is still 0-tall.
- **If FAIL:** do **not** restore overlay-off before fly on ice lock; do **not** wait forever on homeMiddle height>0; do **not** put `bottom:0` back on the floor host; do **not** wrap VideoView; do **not** pause; do **not** PNG/CASE C/`translateZ`/jsProps fill/Bones.

### 2026-09-19 — After shard fly: unmount floor plate so crude home can paint

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `docs/splash-launch.md`
- **Proven:** Sandwich fly succeeded (`sheetRelease`/`shardBreak`, `cellOpacity` 0 at `flyEnd`, overlay off, home wrapper 384×832). Inner frame stayed black. Dashboard **is not empty** (`DashboardScreen` has wordmark, empty-state card, login link). Cause: after overlay unmount, empty floor sibling (`#090A0C`, elevation **8**) stayed mounted (`showFloor = floorMounted || splashActive === false`), and `homeSlotHost` stayed an **Android elevated card** (elevation **9**, opaque fill, `position:absolute`). Wrapper `onLayout` ≠ native ScreenContainer pixels — expo-router Stack often will not composite inside that card.
- **What (Metro JS only):** Unmount the floor plate when `overlayAlive` is false (no opaque `#090A0C` cover after fly). Same `homeSlot` children — **no** liveHost remount, **no** Dashboard/Bones rewrite. After overlay-off the home host is `flex:1`, elevation **0**. LaunchGate `homeSlot` is `flex:1` (not `absoluteFill`). FacetShard fly / video combo unchanged. No PNG, no VideoView in `Animated.View`, no `translateZ`, no jsProps fill, no CASE C.
- **Why:** User: shards fly in all directions then inner screen still black instead of crude MMA Vision.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. **Expected logs:** existing fly path, then `overlay off` → **`liveReveal floor unmounted homeHost flex elevation 0`** → `onFinish`. Screen after ice = wordmark + card, not `#000` / floor plate.
- **If FAIL:** do **not** keep floor mounted after overlay-off; do **not** leave elevation 8/9 on the live home host; do **not** remount Stack into a second tree; do **not** rewrite inner pages / Bones.

### 2026-09-19 — 2× splash cinematic speed (halve durations)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** Halved **visual/cinematic** clocks so effects run 2× faster. `splashFlyClockMs` is **derived** (`shardStaggerMs + shardBreakMs * shardFadeStartRatio + shardFadeMs`) → ~1042 → **~521**. Mesh face `delay` stagger 0.02/0.08 → 0.01/0.04. Stroke fade 160→80; crack lock extra 48→24. Probe `shardBreak+160` → `shardBreak+80`.
  **Halved:** `hapticAtMs` 2000→1000, `introHoldMs` 140→70, `introWipeMs` 420→210, `crackGrowMs` 420→210, `facetFillMs` 320→160, `glassCoverMs` 180→90, `glassHoldMs` 220→110, `glassLockDelayMs` 64→32, `cloneFallbackMs` 360→180, `homeContentGiveUpAfterFloorMs` 400→200, `leaveAfterBreakMs` 180→90, `crackRevealMs` 800→400, `crackHoldMs` 1000→500, `shardBreakMs`/`fadeMs` 820→410, `shardStaggerMs` 180→90, `shardFadeMs` 190→95, `flashMs` 140→70.
  **Kept (fail-safe / not duration-speed):** `splashHangMs` 12000, `lockLeaveTimeoutMs` 3000, `floorWaitGiveUpMs` 900, `hostWaitGiveUpMs` 1400, `homeContentGiveUpMs` 1200, `videoTeardownMs` 220, `appPaintSettleMs` 48, `shardCoverSettleMs` 64, `videoTailLoopMs` 900, `videoTailSeekCooldownMs` 320, `shardFadeStartRatio` 0.82, `FILL_SPAN` 0.72 (fill-clock fraction, not ms), `shardDistBase`/`shardDistPerLen`/`shardSeparateDip`/`shardEasePower`, colors, elevations, cell count. Combo unchanged: `textureView` + `fill` + `useExoShutter false` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. No PNG, no VideoView in `Animated.View`, no `translateZ`, no jsProps fill, no CASE C, no dashboard rewrite.
- **Why:** User asked all splash/cinematic effects 2× faster (halve durations); keep hang watchdogs so ice lock cannot return.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect same beats, ~half time. Log `flyMs` / `flyClockMs` ≈ **521**. Punch at `hapticAtMs` 1000.
- **If FAIL:** do **not** restore 1× clocks by stretching fail-safes; do **not** PNG; do **not** wrap VideoView; do **not** CASE C; do **not** half `splashHangMs` / `lockLeaveTimeoutMs`.

### 2026-09-19 — Double fighter VIDEO playbackRate (restore punch PTS)

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** Cinematic `videothanhcong` now plays at **`player.playbackRate = 2`** (`splash.videoPlaybackRate`, expo-video 0–16, Android ExoPlayer). Set in `useVideoPlayer` setup, `startPlay`, `replaceAsync`, and tail arm (keep 2 unless `videoTailLoopRate !== 1`). Log **`[splash] playbackRate 2`**. Punch compare is **`event.currentTime * 1000 >= hapticAtMs`** (media PTS, **not** `Date.now`). Prior 2× cinematic **halved `hapticAtMs` 2000→1000** as if it were wall clock — that would fire haptic at the **1s frame**, not the punch. **Restored `hapticAtMs` 2000** so punch stays the same MP4 frame (~2.0s video time → **~1.0s wall** at rate 2). Tail wrap still **`duration − videoTailLoopMs`** in **media time**; seek cooldown stays wall `Date.now`. Video **not paused**. Combo unchanged: `textureView` + `fill` + `useExoShutter` as in player; transparent VideoView; `#000` only on LaunchGate/MmaSplash root. No PNG, no VideoView in `Animated.View`, no CASE C, no `player.loop`.
- **Why:** User asked 2× fighter **video** speed; haptic/punch must stay on the punch **in the clip**.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect log `playbackRate 2` then `punch` when `currentTime ≈ 2.0s` (~1s wall). Cracks at that frame, not at 1s PTS.
- **If FAIL:** do **not** set `hapticAtMs` 1000 again for 2× video; do **not** gate punch on `Date.now`; do **not** PNG / wrap VideoView / CASE C / pause.

### 2026-09-19 — Plan B: clipped vector dashboard landing (no ice FACE_FILLS)

- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** Ice grey `FACE_FILLS` removed from the FacetShard paint path (`FACE_FILLS_UNUSED` true). Each of the **same 24 hosts** draws a **vector** MMA Vision dashboard silhouette (`SplashLandingMarks`: `palettes.dark.bg` `#090A0C`, ThemeToggle **3× 44×44** rounded placeholders top-right, `Svg.Text` wordmark `BarlowCondensed_700Bold` 34 ink, card `rx=16` surface/line minH 92, empty + login vi strings / type tokens, `spacing.screenX` 24, `paddingTop` ≈ insets + `spacing.md`) **clipped** by a **static** `ClipPath` `Polygon` (`plan.points`). Rim polygon **outside** clip (`fill none`, stroke `#eef4f8`). `fillClock` still ramps **host** `Animated.View` opacity (landing over fighter). **No** `jsProps` on fill. Backup `glassFill` sheet = `palettes.dark.bg` / `splash.glassFillColor` `#090A0C` (**not** `#b8c3d0`). Landing always **dark** tokens even if system/app scheme is light (logged mismatch). `FacetShard` remains `React.memo`; landing marks memoized by W/H. Same `flyMs` / `sheetRelease` beat; `overlayStack` elevation **22**. Real Dashboard stays in `homeSlot` under ice so holes during fly = app. Video **no pause**. No PNG/`Image`/ViewShot, no ClipPath Circle `r`, no VideoView in `Animated.View`, no `translateZ`, no CASE C, no Bones rewrite. Verbose `[splash]` logs: landingMarks built, per-shard first layout (clipPath exists, polygon point count, iceFillUsed false, landingClipped true), aggregate `landingClipped 24/24`, fillClock ramp start/end, sheet hex, FACE_FILLS unused, home children painted before sheetRelease, skip if W/H 0. No per-frame worklet spam.
- **Why:** User OK’d Plan B: ice lock should look like a crude MMA Vision dashboard (vector), then cells fly and holes show the real Dashboard.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect lock = dark dashboard silhouette in shards (not grey ice) → same 24-cell fly → holes = real Dashboard. Cracks unchanged.
- **If FAIL:** do **not** restore `FACE_FILLS` ice paint; do **not** `jsProps` fillOpacity; do **not** ClipPath `Circle` `r`; do **not** PNG/ViewShot; do **not** ice-colored `#b8c3d0` sheet; do **not** wrap VideoView; do **not** CASE C / `translateZ` / Bones rewrite.

### 2026-09-19 — Center-stack poster on glass + 300ms hold

- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `src/components/brand/logo-mark.tsx`, `src/i18n/vi.ts`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** Glass faces no longer clone Dashboard chrome. `SplashLandingMarks` is a **center-stack poster**: full overlay `#090A0C`, inline LogoMark SVG (lotus in octagon, same paths as `logo-mark.tsx`, ~72px, cx center, cy ~36% H), one-line `MMA VISION` BarlowCondensed_700Bold ~56 letterSpacing 1.6 ink `#F3F1EC`, slogan **Tầm nhìn võ đài** (`vi.brand.slogan`) IBMPlexSans Medium ~18 lotus `#C9A86C` ~12px below the wordmark. **No** ThemeToggle / card / login / academy on glass. FacetShard `ClipPath` stays **Polygon** `plan.points` (not Circle `r`); rim outside clip; `FACE_FILLS` unused; `fillClock` still drives host opacity (no `jsProps` fill). After `glassCovered`/lock wait **`glassHoldMs` 300** before `sheetRelease`/fly; fly = **max(hold elapsed, floor/home paint)** — do not fly the instant the floor paints if hold is running. **No** first-launch AsyncStorage skip (`firstLaunchSkip used false`). Crack/fill/video rate unchanged (2× cinematic as-is). Video **not paused**. Sandwich/z-order unchanged; real Dashboard still under ice for holes. Verbose `[splash]` logs: landingKind poster, markExists, sloganExists + text + wordmark, centerStack, dashboardChromeOnGlass false, holdMs/start/end, flyBlockedByHold, landingClipped 24/24, clipPath polygon not circle, FACE_FILLS unused, sheet `#090A0C`, home painted vs hold end vs sheetRelease order.
- **Why:** User OK’d CHỐT plan: poster intro on ice (readable in the short fill), 300ms hold so the mark/slogan can land, then the same 24-cell fly.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect lock = dark poster (logo + MMA VISION + slogan), not dashboard toggle/card; hold ~300ms; then 24 shards fly; holes = real Dashboard; no fighter through gaps; same cinematic every cold start.
- **If FAIL:** do **not** restore dashboard silhouette on glass; do **not** PNG/`Image`; do **not** ClipPath Circle `r`; do **not** `jsProps` fill; do **not** skip hold when floor paints; do **not** add first-launch skip; do **not** wrap VideoView / CASE C / `translateZ` / pause.

### 2026-09-19 — Light-gray glass poster + app icon logo (scale-up)

- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** Glass **poster page only**. Sheet `Rect` + backup `glassFill` (`splash.glassFillColor` / `styles.glassFill`) = **`#c5d0dc`** (`notBlack` true, `is090A0C` false) so lock gaps are not `#090A0C`. **Dashboard / floor / `homeSlotHost` stay `palettes.dark.bg` — `dashboard.tsx` untouched.** Ink on light gray = **`#090A0C`** (~12.7:1). Slogan **`#C9A86C` ~1.44:1 fail** → **`#6B5428` ~4.9:1** (not dark lotus). **oldLogoUsed false:** LogoMark / lotus-octagon paths **not** on poster (`logo-mark.tsx` left for other callers). **PAGE LOGO** = `assets/splash/brand-mark.png` (glove + cyan reticle; same brand as `assets/icon.png`; **not** fighter `splash-icon.png` / punch video, **not** `android-icon-foreground.png` letterbox, **never** `glass-shatter-overlay.png`). **Exception:** one `SvgImage` inside the clipped landing `G` for this logo swap only — cracks/shards remain SVG polygons. Scale vs prior poster: mark **72→108 (1.5×)**, wordmark **56→72 (1.286×)** track 1.4, slogan **18→22 (1.222×)**, gap **12→16 (1.333×)**; mark center still **36% H**; Barlow Condensed 72 + 108 mark designed for **~384** width with margin. 24 FacetShard, polygon clip, `glassHoldMs` 300, fly, no VideoView in Animated, no jsProps fill, no Circle `r`, FACE_FILLS unused as ice paint. Logs: `bg` `#c5d0dc`, `notBlack` true, `oldLogoUsed` false, `splashIcon path exists` true, `imageVsSvg` image, scale object, `ink` `#090A0C`.
- **Why:** User: light ice-gray lock (not black peek), scale up poster, delete old lotus mark on this page, use splash app icon as logo.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect lock = light gray poster + large glove icon + dark MMA VISION + brown slogan; 300ms hold; 24-cell fly; holes = dark Dashboard; no black peek at lock.
- **If FAIL:** do **not** restore LogoMark on poster; do **not** paint FACE_FILLS as ice; do **not** use shatter PNG; do **not** restyle dashboard; do **not** wrap VideoView / jsProps fill / Circle `r`.

### 2026-09-19 — Fix Metro `Cannot read property 'bg' of undefined` (poster palette)

- **Files:** `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **Crash:** `splash-glass-shatter.tsx:476` `LANDING_PALETTE.bg` after light-gray poster. `LANDING_PALETTE` was removed from `splash-landing-marks.tsx` (`POSTER_SHEET_BG` + `splash.glassFillColor` `#c5d0dc` only). Import stayed; `LANDING_PALETTE` is `undefined`. `colors.ts` `palettes` is `{ light, dark }` each with `bg`; `palettes.dark.bg` `#090A0C` is valid. Poster must **not** use `palettes[scheme]` or `useThemePreference().colors` (hook throws outside provider; `colors` undefined would also `.bg` crash).
- **What (Metro JS only):** Drop `LANDING_PALETTE` + `useThemePreference` from shatter. Poster log uses `POSTER_SHEET_BG` / `splash.glassFillColor` (`exists true`). Floor/sandwich still `palettes.dark.bg` in MmaSplash/LaunchGate. Same 24-host fly / no VideoView wrap / no jsProps fill.
- **Why:** Light-gray landing leftover import after `LANDING_PALETTE` deletion.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload**. Expect no `.bg` of undefined; lock still `#c5d0dc` poster; fly holes = dark Dashboard.
- **If FAIL:** do **not** reintroduce `LANDING_PALETTE` from ThemeProvider; do **not** wrap VideoView / CASE C / pause at lock.

### 2026-09-19 — Slow crack veins only (`crackGrowMs` 420)

- **Files:** `src/theme/splash.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** Restore **vein** grow after the 2× cinematic pass halved `crackGrowMs` **210 → 420** (original readable dashoffset). CrackStroke lock extra **24 → 48** (same 2× cut, crack-related). **Did not** restore mesh **face** `delay` 0.01/0.04 (facet fill stagger, not veins). **Unchanged:** `facetFillMs` 160, `glassCoverMs` 90, `glassHoldMs` 300, `shardBreakMs` 410, `videoPlaybackRate` 2, poster, sandwich, stroke-fade-on-fly 80, probe `shardBreak+80`. Log **`[splash] crackGrowMs 420`** at punch/overlay start. Poster still `splash.glassFillColor` `#c5d0dc` hex — no `palettes` / `colors.bg` on landing marks (avoids `.bg` of undefined). Combo unchanged: `textureView` + `fill` + `useExoShutter false` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. No PNG, no VideoView in `Animated.View`, no CASE C, no zoom-6.
- **Why:** User: giảm tốc độ nứt kính = slow crack veins only (2× slower than current 210ms).
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect `crackGrowMs 420` then `facetsFill` ~+420; ice fill / hold / fly / video rate unchanged.
- **If FAIL:** do **not** halve `facetFillMs` / `glassHoldMs` / `shardBreakMs` again to “match”; do **not** PNG / wrap VideoView / CASE C.

### 2026-09-19 — Restore contrasting FACE_FILLS ice + SVG mark (no PNG/slogan)

- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** Mock-1 ice contrast back. `FACE_FILLS` **6** (`#b8c3d0` `#c5d0dc` `#aeb9c6` `#c2ccd6` `#b3bfcc` `#d8dee6`) assigned per mesh face (`FACE_FILLS_UNUSED` false). Each FacetShard paints a **static** polygon `fill` (host opacity still `fillClock` / `useAnimatedStyle`; **no** `jsProps` fill). Removed poster **full-screen `Rect`** that flattened every cell to one `#c5d0dc`. Backup `glassFill` / `splash.glassFillColor` = mid ice **`#c2ccd6`** (not `#000` / `#090A0C`; does not paint over faces). Poster content SVG only: **no slogan** (`Tầm nhìn võ đài` off glass), **MMA VISION** `Svg.Text` `#090A0C` under mark, **vector** rounded squircle (large `rx` + `ClipPath` Rect) dark plate + cyan reticle + glove/fist **paths** — **no** `SvgImage` / `brand-mark.png` / `glass-shatter-overlay.png` / LogoMark lotus / ThemeToggle. Cracks: inner veins thicker, outer thinner, irregular ring branches; stroke ice-greys not 100% white; `jsProps` **dashoffset only**; clip = **Polygon** not Circle `r`. Unchanged: 24 FacetShard fly, `glassHoldMs` 300, `crackGrowMs` 420, video sandwich. Logs: `iceFillUsed` true, `pngOnGlass` false, `slogan` false, `FACE_FILLS count` 6, `sheet` `#c2ccd6`.
- **Why:** User: keep SVG glass faces, restore contrasting ice greys like mock 2, drop PNG/slogan, more natural crack widths.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect lock = mixed ice shards + dark vector mark + MMA VISION, no slogan, no photo; 300ms hold; 24-cell fly; holes = Dashboard.
- **If FAIL:** do **not** restore unifying poster Rect / PNG / SvgImage; do **not** `jsProps` fillOpacity; do **not** ClipPath Circle `r`; do **not** wrap VideoView / CASE C / `#000` sheet.

### 2026-09-19 — PNG logo on ice + premount 24 shards (punch hitch) + hide nav
- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/launch-gate.tsx`, `src/components/system-chrome.tsx`, `src/app/_layout.tsx`, `assets/splash/brand-mark.png`, `docs/splash-launch.md`
- **What (Metro JS only):** **A)** Glass poster logo is `assets/splash/brand-mark.png` via `react-native-svg` `Image` (`SvgImage`) + **ClipPath rounded squircle `Rect` `rx`** (not Circle `r`). Deleted vector reticle/glove-blob and any lotus `LogoMark` from the glass poster. **PNG exception = this icon file only** — never `glass-shatter-overlay.png`, never wallpaper, never RN `Image` for kính/crack. Ice cells stay **FACE_FILLS** SVG per-facet. **No slogan.** Brand (logo + MMA VISION) is a sibling **BrandLayer above CrackStroke** (`brandAboveCracks true`) so the 300ms hold is readable; cracks remain on ice around/behind; brand block offsets off punch origin if it overlaps. Android **status + navigation bars hidden** for the whole splash lock (`StatusBar.setHidden`, `NavigationBar.setHidden` / `setVisibilityAsync("hidden")`, Stack `navigationBarHidden` while locked). Restore only after `onFinish`. `onAppCovered` / `sheetRelease` do **not** flip translucent or unhide the grey nav bar mid-cinematic. Unchanged clocks: `glassHoldMs` 300, `crackGrowMs` 420, 24-host fly. No VideoView in `Animated.View`, no `jsProps` fill, no Circle `r`. **B)** Premount the **24 FacetShard hosts** (`fillClock` 0 / opacity 0) with the splash root **before** `hapticAtMs`. Punch does **not** insert the shard+SVG tree (`punchMountsShards false`). Punch = haptic + arm crackGrow + later fillClock. **No `player.pause()` at punch** (`pauseAtPunch false`).
- **Why:** User OK’d both poster/UX and punch-hitch plans plus verbose `[splash]` true/false logs.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect no grey nav bar on ice; readable PNG logo + MMA VISION above cracks during hold; punch without a 24-host insert hitch; fighter keeps playing.
- **If FAIL:** do **not** remount FacetShards at punch; do **not** `player.pause()` at punch; do **not** use shatter/wallpaper PNG; do **not** unhide nav at `onAppCovered`; do **not** wrap VideoView / `jsProps` fill / Circle `r`.
- **Expected log order:** `mmaSplash mount premountHosts true punchMountsShards false pauseAtPunch false brandAboveCracks true pngOnGlass logoOnly true brand-mark path exists true iceFillUsed true slogan false` → `premountHosts true` → `iceHostsLaidOut … beforePunch true` (before `hapticAtMs`) → `punch pauseAtPunch false punchMountsShards false` → `punch decision navHidden true WHEN punch` → `crackGrow armed true` → `facetsFill` / `fillClock ramp start` → `glassFillRamp` → hold / fly as before.

### 2026-09-19 — Center brand (no punch X) + SVG ice gradient/specular
- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **Why clipped:** Last patch `brandLayout` translated the logo+wordmark **off punch origin** (`shiftX` up to −80 when `originX > cx`, punch ≈ 83% W). That shoved the stack left and `Svg.Text` `"MMA VISION"` overflowed the overlay → screenshot **“MA VISION”** (M cut off). Cracks still grow from punch; brand does not.
- **What (Metro JS only):** (1) Brand stack geometrically **centered** on overlay W×H: `brandCenterX = W/2`, `offsetPunch false`. Still a sibling **above CrackStroke** (`brandAboveCracks`). Rounded `brand-mark.png` squircle clip kept. **No slogan.** `overflow visible` on brand Svg. (2) Ice was honest **matte** `FACE_FILLS` hex tiles + uniform `#eef4f8` rim — not glass (no fresnel/IOR/env). Same **24 FacetShard hosts** (premount unchanged): per-facet **static** `LinearGradient` (FACE_FILL → slightly lighter cool grey toward one corner), thin **specular** ellipse `#f7fbff` @0.2 clipped to **Polygon** (not Circle `r`) on the upper-left of each cell, rim **brighter than that cell’s fill**, subtle inner stroke. Contrast between FACE_FILLS kept. **pngIce false.** No `Image` ice, no three.js, no `translateZ`, no `jsProps` fill. Logs: `brandCenter` W/2, `offsetPunch false`, `glassGradient true`, `specular true`, `pngIce false`, `textOverflow false`, wordmark full `MMA VISION`.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect centered glove + full **MMA VISION**; ice cells with in-cell brightness + edge catch, not identical sticker grey. Punch hitch unchanged (hosts still premount).
- **If FAIL:** do **not** re-offset brand by punch X; do **not** PNG ice photos; do **not** `jsProps` fill; do **not** remount 24 hosts at punch; do **not** wrap VideoView / CASE C / Circle `r`.

### 2026-09-19 — Thinner cracks, more veins around punch (not left pile)
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** Hairline strokes: `CRACK_STROKE_MAIN` **1.05** (was plate **3.4**), `CRACK_STROKE_BRANCH` **0.34** (was **2.4**). Face mesh **extraPerEdge stays 2** → **24** FacetShard hosts (premount unchanged). Extra cracks: **32** uniform-**angle** rim samples around punch + **16** extra inner rays (`vein-a-x-*`). **Not** rect-perimeter vein samples (those piled long rays left of `punchScreenX`≈80%). **No** `p-left-n*` 20-vein set. **No** PNG cracks. **No** ClipPath Circle `r`. Highlight hairline `0.28×width` (never `width>=3.4` filter). Logs: **`veinCount`**, **`strokeMain`**, **`strokeBranch`**. Unchanged: brand **W/2**, SVG ice gradients/specular, premount 24, `brand-mark.png` logo-only, `crackGrowMs` 420, combo `textureView` + `fill` + `useExoShutter false` + transparent VideoView.
- **Why:** User: thinner glass cracks, higher count/frequency, spread around the punch — not piled on the left.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect dense thin veins fanning **360° from the fist**; logo + MMA VISION still centered; 24-cell fly unchanged.
- **If FAIL:** do **not** restore 3.4/2.4 plate widths; do **not** add 20 left-only veins; do **not** bump face extraPerEdge (breaks 24 hosts); do **not** PNG cracks / Circle `r` / wrap VideoView.

### 2026-09-19 — Wet ice highlight polygon + brand on-screen logs

- **Files:** `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** Brand stays overlay-centered (`textAnchor middle`, cy ~36% H, margin ≥24). `offsetApplied` **false** unless last-resort **clamped** so MMA VISION is fully on-screen (never punch-avoid). Ice cells: static per-id `LinearGradient` (top-left + white stop ~0.26) plus a **highlight polygon** filled with `RadialGradient` white 0.16–0.32, clipped to **Polygon** (not Circle `r`, not glass PNG). Face count still 24. Logs: `overlayW`, `brandCx`, `wordmark x`, `punchX`, `offsetApplied`, `brandClipped false`, `wordmarkOnScreen true`, `crackStrokeMain`/`crackStrokeBranch`, `veinCount`, `glassGradient true`.
- **Why:** Ice still read as flat plastic after the first gradient pass (ellipse-only); brand clip needed explicit on-screen fit + logs.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`.
- **If FAIL:** do **not** restore punch X brand shift; do **not** PNG glass; do **not** `jsProps` fill; do **not** CASE C `#000` on cells.

### 2026-09-19 — Punch-arm grow + 160ms lockstep fill + leak sheet + radial ice

- **Files:** `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **Measured (this log):** premount 24/24 `beforePunch true`; punchAnchor +2; **facetsFill +943** then fillClock ramp +944; **glassFillRamp +3133** (~2.2s fill); `crackGrow armed true` only at +946 (after facetsFill); fillClock still 0 at +946 watchdog → TextureView through cells. `facetFillMs` is **160**; 226 extra strokes must not delay fill.
- **What (Metro JS only):** (1) **`growClock` owned by MmaSplash** — `withTiming` + log **`crackGrow armed true at punch +0`** in `onImpact` the same JS turn as punchAnchor. CrackStroke SVG **premounts** with splash (hidden dashes); punch does **not** insert 226 `AnimatedPath`s. Extra veins still draw; they do **not** gate fillClock. (2) After `crackGrowMs` **420**, shared **`fillClock` 0→1 in `facetFillMs` 160** (`withTiming`). `FILL_SPAN` **1**, per-face **fillDelay 0** (was 0.72 span + index delays — cells stayed transparent after ramp start). Log **`fillDurationMs` expected 160 vs actual**. (3) Sequence: punch → veins 420 → fill 160 → cover 90 → hold 300 → fly. **`glassFill` ramps WITH fill** (`leakSheetWithFill true`, sheet `#c2ccd6` under shards) so TextureView cannot read mesh gaps during ice-in; cover 90 is lock after fill, not a 3s wait. (4) Ice color by **distance from punch** (`COLOR_RADIAL_PUNCH`): near punch darker/more saturated + stronger specular; rim lighter residual. Still SVG Linear/RadialGradient; **not** `FACE_FILLS[i%6]`. Faces inflated **2.2px** so inner/outer tiles overlap (no seam holes). Unchanged: 24 fly hosts, brand center, strokes 1.05/0.34, no pause, no Circle `r`, no jsProps fill, combo `textureView` + `fill` + `useExoShutter false` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. Logs: `crackGrow armed` +0, `fillDurationMs`, `leakSheetWithFill true`, `colorRadialPunch true`.
- **Why:** User stuck on cracks too long; fillClock 0 leaked fighter; ice greys were random index scramble.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). **Expected log order:** `punchAnchor +0` → `crackGrow armed true at punch +0` → `facetsFill +~420` → `fillClock ramp start` + `glassFillRamp with fill` + `leakSheetWithFill true` → `fillDurationMs expected 160 actual ~160` → `glassCover +~580` → `glassCovered` → hold 300 → fly. No glassFillRamp at +3s. All 24 hosts opaque together during fill.
- **If FAIL:** do **not** wait 226 veins before fillClock; do **not** restore FILL_SPAN 0.72 / per-shard fillDelay; do **not** start sheet only after a 3s JS timeout; do **not** remount strokes at punch; do **not** PNG ice / jsProps fill / Circle `r` / wrap VideoView.

### 2026-09-19 — Shared 120ms vein clock (no per-path stagger)

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** 226 CrackStroke paths were mapping `local = (growClock - edge.delay) / edge.grow` with per-vein delays ~0–0.32 and grow spans as low as 0.12. That is sequential fan-out, not one clock — reads as **~10s** of crawling veins even when `crackGrowMs` is 420. **Fix:** `crackGrowMs` **120**; `veinStaggerMs` **0**; every mesh edge `delay 0` / `grow 1`; worklet `strokeDashoffset = length * (1 - growClock)` on the **same** 0→1 linear `withTiming` armed at punch +0. Fill still starts after that **one** 120ms (not after last vein). **Unchanged:** `facetFillMs` 160, `glassCoverMs` 90, `glassHoldMs` 300. **Do not pause** VideoView. No PNG. Combo unchanged: `textureView` + `fill` + `useExoShutter false` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. Logs: `crackGrowMs 120`, `veinStaggerMs 0`, `growDurationExpected 120`, `crackGrow armed true at punch +0`.
- **Why:** User: cracks still take nearly 10 seconds; speed up veins many times; all veins one shared clock ~120ms, not sequential stagger.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no** native rebuild). Expect all veins to finish in **~120ms** from punch; `facetsFill` ~**+120**; then fill 160 + cover 90 + hold 300. Do **not** wait ~10s of veins.
- **If FAIL:** do **not** restore per-path `edge.delay` / `edge.grow` spans; do **not** stagger 226 timeouts; do **not** PNG / pause video / wrap VideoView / `jsProps` fill / Circle `r`.

### 2026-09-19 — Rate-1 walk-in, shutter before haptic, 120ms grow that paints
- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-glass-mesh.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** (1) **Walk-in / punch:** `videoPlaybackRate` **1** through walk-in+punch; `hapticAtMs` **2000** media PTS; seek `currentTime=0` on play. `fireImpact` logs `currentTime`/`duration`/`playbackRate`/`timeMs` at firstFrame and every candidate; `path` is `timeUpdate` | `poll` | `playToEnd` | `shutterDone`. **Never** punch if `timeMs < punchMinMediaMs` 1800 unless `videoFailed`. **Never** `playToEnd` → punch when PTS `< hapticAtMs`. (2) **Shutter:** restore `introHoldMs` **140** + `introWipeMs` **420** (visible split); hold+wipe must finish **before** haptic. Punch/haptic wait `shutterDone`; overlayStack still premounts **under** shutter (`overlayPremount` z 3 / shutter z 4) so cracks cannot sit on a closed shutter. Log `shutterBeforePunch true`. (3) **Grow:** shared `growClock` 120ms; `veinStaggerMs` 0; worklet snaps dashoffset **0** at clock 1; detach `animatedProps` after snap (`jsPropsWipe false`) instead of 226 Fabric resets during grow. Fill starts on growClock **`withTiming` finished** (UI `runOnJS`), not only JS `setTimeout`. Extra veins during grow **16** angular + **8** inner; highlights are static `Path` after snap (no jsProps). **24** FacetShard hosts unchanged. `useExoShutter` **left true** (FILL+textureView in this tree — not flipped to false; cover+true still banned). No pause at punch, no PNG ice, no CASE C, no VideoView in `Animated.View`, no Circle `r`, no jsProps fill. **Raw:** `assets/splash/videothanhcong.mp4` SHA256 **matches** `android/app/src/main/res/raw/splash_loop.mp4` — **no copy, no native rebuild**.
- **Why:** User OK’d walk-in visible (rate 1), shutter complete before punch, 120ms veins that actually paint, verbose `[splash]` true/false on every gate.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). **Expected logs:** `firstFrame timeMs~0 duration~6.8 playbackRate 1` → `shutterDone` → walk visible → `punch path timeUpdate timeMs~2000 shutterBeforePunch true` → `crackGrow armed +0` → `growPaintMs actual ~120 jsPropsWipe false` → `facetsFill ~+120` → ice fill 160 → cover → hold 300 → fly.
- **If FAIL:** do **not** fire punch from `playToEnd` at PTS 0; do **not** set `playbackRate` 2 before punch; do **not** start fill only from a JS timeout while growClock is still 0; do **not** remount 226 `animatedProps` mid-grow; do **not** PNG ice / wrap VideoView / CASE C / pause / Circle `r` / jsProps fill; do **not** flip `useExoShutter` to false without a device clip (fighter may go black).

### 2026-09-19 — growClock 120ms UI, hang after lock, short shutter after frame
- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/launch-gate.tsx`, `docs/splash-launch.md`
- **Measured (this log):** punch GATE OK (`timeUpdate` ~2009, `shutterBeforePunch true`, rate 1). **`growPaintMs` actual 18019 expected 120** — `growClock withTiming finished` took 18s because **~132 CrackStroke jsProps dashoffset** worklets + hang/`finishToApp skipped` spam starved JS/Fabric. Fill expected 160 actual 1758. Hang at +16623 (`glassLocked false` `fillClock` 0) then LaunchGate `onFinish` mid-cinematic +19711. `firstFrame timeMs` 330 + shutterDone 621 (walk under black). `playToEnd timeMs` 5931 during freeze.
- **What (Metro JS only):** (1) Grow-time jsProps = **`GROW_JS_PROPS_MAX` 8** origin `ray-in-*` only. All other veins are **static** hidden Paths until a **single snap** (`growClock` 1 → dashoffset 0, no 132 Fabric commits/frame). Shared `growClock` driven by `withTiming` **and** `useFrameCallback` elapsed/`crackGrowMs`. **JS `setTimeout(120)` starts fillClock first-wins** vs withTiming finished (log `source`); timeout **cancels** grow timing and forces clock 1 even if the callback is 18s late. (2) Hang **not** armed at overlay mount and **not** during grow/fill/hold. LaunchGate hang = **12s after `onAppCovered`/glassLocked**; fly still uses `lockLeaveTimeout`. `finishToApp skipped` / hang logs **once** per key. `splashActive false` refused while phase is grow/fill/hold. (3) `playingChange` pause → log + `play()`. **Never punch from `playToEnd`.** No pause at punch. (4) Shutter hold **does not start at mount**. Log `firstFrame timeMs`; if **>200 seek 0 once**. Wipe arms when `timeMs < introWipeArmMediaMs` 200 (`introHoldMs` 0 after that frame). Failsafe still finishes shutter before haptic. Combo unchanged: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. 24 premount fly hosts. No PNG ice, no jsProps fill, no CASE C, no VideoView in `Animated.View`.
- **Why:** User: cracks slow because growClock 120ms ran in 18s; hang/`onFinish` mid-cinematic; hitch from firstFrame 330ms under 621ms shutter.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. **Expected logs:** `firstFrame timeMs` (seek0 if >200) → `walkVisible`/`shutterWipe` → `shutterDone` before punch → `punch path timeUpdate timeMs~2009 shutterBeforePunch true` → `crackGrow armed +0 growJsProps 8` → **`growPaintMs actual ~120–200` `source` jsTimeout|withTiming** → `facetsFill ~+120` → `fillDurationMs expected 160 actual ~160` → `glassCovered` **with no hang before that** → hold 300 → fly. Punch still ~2009. No `finishToApp skipped` flood. No LaunchGate `onFinish` at +16s while grow running.
- **If FAIL:** do **not** put jsProps dashoffset back on 100+ paths; do **not** wait only on `withTiming` finished; do **not** arm hang at mount; do **not** punch from `playToEnd`; do **not** PNG / pause / wrap VideoView / CASE C / jsProps fill / Circle `r`.

### 2026-09-19 — A+B keep C: grow at punch land, native splash until playing t≈0
- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/splash-video-types.ts`, `src/components/launch/mma-splash.tsx`, `src/components/launch/launch-gate.tsx`, `src/app/_layout.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** **A)** Haptic stays `hapticAtMs` **2000** (`punchMinMediaMs` **1800**, no `playToEnd` punch, rate **1**). `growClock` arms when media PTS ≥ **`growArmPts` 2475** (2450–2500) or **`growArmAfterPunchMs` 450** wall fallback. Ice fill still after grow **`crackGrowMs` 120** (`GROW_JS_PROPS_MAX` **8**). Hang not during grow/fill. 24 hosts still premount before play (opacity 0) — not moved to firstFrame. **B)** Native `SplashScreen` stays until **playing AND duration>0 AND currentTime≈0** (`nativeSplashHideMaxPts` **80**, walk-in safety if firstFrame is late but still `< punchMinMediaMs` after seek-0-before-play). `hideAsync` **not** on RootLayout / LaunchGate mount / layout. Do **not** play while `duration===0`. Seek 0 only **before** first visible play (`seekAfterVisible false`). No firstFrame-then-seek-0 flash pose. VideoView **opacity 1** (never 0). RN intro shutter **off** the TextureView (hold = native splash). **C kept:** no early punch, no rate 2 before punch, no 3.8s shutter on video. No pause at punch. No CASE C. No PNG ice. Brand-mark ok. Combo: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root. Verbose `[splash]` logs: `growArmPts`, `punchLanded`, `hapticAtMs vs growArm`, `hideAsync when`, `duration` at `startPlay`, `firstFrame timeMs`, `videoViewOpacity 1`, `splashUntilPlaying true`, `seekAfterVisible false`.
- **Why:** User OK’d consolidated A+B, keep C. Cracks were starting at haptic (~2000) not punch land; native splash hid on JS mount so walk-in flashed / RN wipe covered TextureView.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). **Expected:** `startPlay duration~6.83` → `firstFrame timeMs 0` → `hideAsync` after playing → walk-in → punch ~2008 → `growArm ~2500 punchLanded true` → `growPaintMs ~120` → fill ~160 → hold → fly. No hang before `glassCovered`.
- **If FAIL:** do **not** hideAsync on layout/mount; do **not** play at duration 0; do **not** seek 0 after a visible frame; do **not** arm growClock at haptic +0; do **not** remount 24 hosts at firstFrame; do **not** set VideoView opacity 0; do **not** CASE C / PNG ice / pause at punch / rate 2 / playToEnd punch / wrap VideoView.

### 2026-09-19 — SplashGlassShatter crash: leftover `spokes` after phone-glass mesh
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `docs/splash-launch.md`
- **Exception:** `ReferenceError: Property 'spokes' doesn't exist` (Hermes) at `buildGlassMesh` → `SplashGlassShatter` (`mma-splash.tsx` ~1645). Phone-glass rewrite dropped the `spokes` array but left `const spoke = spokes[i];` in the 12-sector face loop. `spoke` was unused. Not `plan.frost` / concentric / origin / missing shatter props (parent still passes width/height/originX/originY/fillClock/flyMs/strokeFade/onIceHostsReady/growArmed/growClock).
- **What (Metro JS only):** Removed the dead `spokes[i]` read. Logged `mesh field check` (`spokes leftover undefined true`, `plan.frost` undefined, `specBoost`/`fillOpacity` defined, `concentricRings`, origin finite, face count). **Kept:** 24 hosts (`FACE_EXTRA_PER_EDGE` 2), `crackGrowMs` 360, `growArmPts` 2475, native splash until playing t≈0, `GROW_JS_PROPS_MAX` 8, no PNG ice, no Circle `r`, no VideoView in `Animated.View`.
- **Why:** User crash on `SplashGlassShatter` after the phone-glass mesh change.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile`. Expect overlay mount without redbox; `mesh field check faces 24`; then punch → growArm ~2475 → grow 360 → fill → hold → fly.
- **If FAIL:** do **not** restore `spokes`; do **not** PNG ice / Circle `r` / wrap VideoView / CASE C / bump jsProps past 8 / change host count off 24.

### 2026-09-19 — Opaque ice + straight radial cracks
- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `src/theme/splash.ts`, `docs/splash-launch.md`
- **What (Metro JS only):** (1) **Opaque glass:** all **24** face fills `fillOpacity` **1** (never rim alpha). Frost is lighter/darker **grey-green hex**, not translucent. Solid polygon under the ice gradient; LinearGradient stops `stopOpacity` **1** so video cannot read through the fill. Backup `glassFillColor` `#c8d4cc` stays opaque; `leakSheetWithFill` still covers TextureView during ice-in. Face overlap **~2px**. Logs **`fillOpaque true` `seeThrough false`**. Specular highlight still overlays white on **top of** the opaque cell. **No** `jsProps` fill. (2) **Cracks:** straight radials from punch to the bezel (optional **one** jog). Organic wobble / concentric rings as the main look **removed** (`CONCENTRIC_RINGS` **0**). Thicker near punch, thinner far (inner vs outer segments). Grow-time jsProps stays **`GROW_JS_PROPS_MAX` 8** (`ray-in-*` only). Extra radials **snap at clock 1**. `crackGrowMs` **360**. Not 132 live dashes. No ClipPath Circle `r`. No PNG ice. **Kept:** 24 fly hosts, `growArmPts` **2475**, `hapticAtMs` **2000**, rate **1**, native splash until playing t≈0, VideoView opacity **1**, brand-mark, `glassHoldMs` **300**. Combo: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root.
- **Why:** User: looking through glass = wrong UX (fighter/home behind); shatter must be straight rays from impact, not organic rings.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). Expect opaque grey-green lock with **no fighter through ice**; cracks = straight star from punch; `growJsProps 8`; `crackGrowMs 360`; then fill / hold 300 / fly.
- **If FAIL:** do **not** restore translucent `fillOpacity` on rim faces; do **not** put jsProps on fill; do **not** bring back 132 live dashes / concentric as the main crack; do **not** PNG ice / Circle `r` / wrap VideoView / CASE C / pause / rate 2.

### 2026-09-19 — Dent epicenter + smaller Black MMA VISION + brand in ice clips

- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/splash-landing-marks.tsx`, `src/components/launch/mma-splash.tsx`, `src/components/launch/splash-video-player.tsx`, `src/components/launch/launch-gate.tsx`, `src/theme/typography.ts`, `src/app/_layout.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** (1) **Dent at punch** — SVG only, **no `translateZ`**, **no Circle `r`**. Ice `fillOpacity` stays **1** (`seeThrough false`). Epicenter is a darker crush (`iceFillFromPunch` + `RadialGradient` crush) plus top-light highlight and opposite dark rim (fake concave). Extra **thicker** `dent-ray-*` stubs in **~10%** of min(W,H) (8–12%); they **SNAP** at growClock 1 (not extra jsProps). Log **`dentEpicenter true`**. (2) **MMA VISION** size **50** (clamp 48–52), `textAnchor middle`, **W/2**, margin **≥24**. Font **`BarlowCondensed_900Black`** (also load 800 ExtraBold) + matching `Svg.Text` stroke. Log **`wordmarkSize`**, **`font`**, **`brandClipped false`**, **`wordmarkOnScreen true`**. (3) Removed **BrandLayer** sibling above CrackStroke. **`SplashLandingMarks` is inside each FacetShard** polygon clip (unique squircle clip ids), **under** CrackStroke so veins cut letters+logo. **24 hosts** still carry slices when flying. Log **`brandAboveCracks false`**, **`brandInClip true`**, **`cracksOverGlyphs true`**. Verbose `[splash]` flag dump on mesh / landing / punch / growArm / fill / LaunchGate gates. **Kept:** `fillOpaque`, straight radials, `crackGrowMs` **360**, `GROW_JS_PROPS_MAX` **8**, `growArmPts` **2475**, rate **1**, native splash until playing t≈0, VideoView opacity **1**, no PNG ice, no jsProps fill, `glassHoldMs` **300**. Combo: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root.
- **Why:** User OK’d dent + smaller thicker wordmark + brand in the glass under cracks.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). Expect concave crush at the fist, full **MMA VISION** on-screen (~50px Black), cracks slicing the lockup, slices flying with 24 cells.
- **If FAIL:** do **not** put brand back above CrackStroke; do **not** grow wordmark to 72; do **not** `translateZ` / Circle `r` / PNG ice / jsProps fill / wrap VideoView / extra jsProps past 8 / remount 24 hosts at punch.

### 2026-09-19 — Slow 360ms shared grow + phone-glass mesh (8 jsProps)

- **Files:** `src/theme/splash.ts`, `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** (1) **Timing:** `crackGrowMs` **360** (in 320–400). One `growClock`, `veinStaggerMs` **0**. Grow-time jsProps stays **`GROW_JS_PROPS_MAX` 8** origin `ray-in-*` only. Extra concentric/branch Paths **SNAP** at clock 1 (no 132 live dashes / 18s hitch). Fill still after grow. Hang still not during grow/fill/hold. Log **`growPaintMs` expected 360 actual**, **`growJsProps` 8**. (2) **Phone glass (SVG only):** 24 FacetShard hosts kept. Faces **small near punch, large at rim** (constant-px inner ring + angular-sorted rect rim — **not** `index%6`). Veins = radials from punch + **3** concentric rings (clipped circles), denser/thicker at impact, thinner far; **no left pile**. Material = pale grey-green glass, bright rims; epicenter frosted white / more opaque; rim lighter + static `fillOpacity` (never jsProps fill). Gradients + specular kept. **No** PNG ice, **no** ClipPath Circle `r`. Sheet `glassFillColor` `#c8d4cc`. **Kept:** rate **1**, punch `hapticAtMs` **2000**, `growArmPts` **2475**, native splash until playing t≈0, VideoView opacity **1**, no pause, premount before play, brand-mark, `glassHoldMs` **300**, 24 fly. Combo: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root.
- **Why:** User OK’d both: readable slow crack grow on one clock, and phone-screen punch shatter look (mesh + color + crack distribution).
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). **Expected logs:** `phoneGlassMesh true`, `concentricRings 3`, `shardSizeByPunchDist true`, `frostEpicenter true`, `colorRandomIndex false`, `growJsProps 8`, `crackGrowMs 360`, `growPaintMs expected 360 actual ~360`. Punch ~2000 then growArm ~2475 then grow then fill then hold 300 then fly.
- **If FAIL:** do **not** put jsProps dashoffset on concentric/branch Paths; do **not** restore 120ms grow; do **not** size faces by `index%6`; do **not** PNG ice / Circle `r` / jsProps fill / wrap VideoView / CASE C / pause / rate 2 / remount 24 hosts at punch.

### 2026-09-19 — Remove fake dark 3D dent; opaque white crush + flat edge rims

- **Files:** `src/components/launch/splash-glass-mesh.ts`, `src/components/launch/splash-glass-shatter.tsx`, `src/components/launch/mma-splash.tsx`, `docs/splash-launch.md`
- **What (Metro JS only):** Removed the punch **RadialGradient dent blob** (dark `#3f4844` crush + opposite dark rim). Epicenter is a **small opaque white/light-grey crush**: fan + chip **triangles** plus **thicker** `crush-ray-*` stubs in **~8%** of min(W,H) (6–10%). Triangles are drawn **inside** the existing **24** FacetShard clips (`fillOpacity` **1**) — not extra fly hosts, not Circle `r`, not Skia. Face ice near punch is light grey-white hex, not `#4e5854`. Per-face **edge rims** are split polylines: **bright** on the lit side, **slightly darker** opposite — flat glass edge, not a bowl shadow. LinearGradient stops stay `stopOpacity` **1**; highlight chip is an opaque polygon (no alpha RadialGradient overlay). Logs: **`dentEpicenter false` `crushWhite true` `fillOpaque true` `seeThrough false`**. **Kept:** 24 hosts, straight radials, `crackGrowMs` **360**, `GROW_JS_PROPS_MAX` **8**, `growArmPts` **2475**, brand in clip, MMA VISION ~**50** Black. No `translateZ`, no PNG ice, no jsProps fill, no Circle `r`. Combo unchanged: `textureView` + `fill` + `useExoShutter true` + transparent VideoView; `#000` only LaunchGate/MmaSplash root.
- **Why:** User OK’d: fake dark 3D dent blob is wrong; crush should read as smashed white glass chips + thick inner rays, with flat bright/dark edges.
- **Result on device clip:** record PASS/FAIL after **Metro-only reload** on `Semester_8/reactnative-mobile` (JS only — **no native rebuild**). Expect **no dark bowl** at the fist; opaque white crush in a small radius; fighter **not** reading through ice; brand still in clips; grow 360 / 8 jsProps / growArm 2475.
- **If FAIL:** do **not** restore dent RadialGradients / dark `#2c3330` rim; do **not** `translateZ` / Circle `r` / PNG ice / Skia / jsProps fill / extra jsProps past 8 / extra fly hosts past 24.

## Sample LoadingScreen vs this app

Apply **architecture**, not the expo-av sample widget:


| Do                                      | Do not                                          |
| --------------------------------------- | ----------------------------------------------- |
| `expo-video` `VideoView`                | `expo-av` `Video`                               |
| Plain `View` around video               | `Animated.View` wrapping `VideoView`            |
| `isDataReady` from `LaunchGate`         | Fake 1500ms ready                               |
| Vector / Reanimated overlay after punch | PNG/WebP/JPEG `Image` overlay; overlay from t=0 |


---

## Wrong tree reminder


| Path                                                      | Role                                                 |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `...\Semester_8\Mobile_WDP301\MMA-TMS\reactnative-mobile` | **Metro / source of truth**                          |
| `...\Semester 8\Mobile_WDP301\MMA-TMS`                    | Cursor workspace; **no** nested `reactnative-mobile` |


