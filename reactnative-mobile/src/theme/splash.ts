export const splash = {
  canvas: "#000000",
  cyan: "#22e1ff",
  crimson: "#ff2d55",
  text: "#f5f7fa",
  videoWidth: 720,
  videoHeight: 1280,
  /**
   * Mild fill-space zoom + left/up shift to hide the “AI” mark (top-left of the clip).
   * Do **not** pair this with parent `overflow: hidden` (that blanks TextureView).
   * Extra pixels sit off-screen; parents stay `overflow: "visible"`.
   */
  videoLayoutScale: 1.08,
  /** 1 = all extra width on the left (watermark side). */
  videoLeftCrop: 1,
  /** 0–1: share of extra height pushed above the top edge. */
  videoTopCrop: 0.45,
  /** Punch in **video fill-space** (then mapped through videoLayoutScale / crop). */
  punchScreenX: 0.83,
  punchScreenY: 0.3,
  /**
   * ONE key: punch + haptic + crack overlay start together.
   * **Video timeline** ms (`player.currentTime * 1000`), not wall clock.
   * Punch frame in `videothanhcong` is ~2000ms PTS. Keep media marks fixed;
   * wall clock halves when `videoPlaybackRate` is 2.
   */
  hapticAtMs: 2000,
  /**
   * Never fireImpact below this PTS unless `videoFailed`. playToEnd must not
   * punch when media is still in the walk-in.
   */
  punchMinMediaMs: 1800,
  /**
   * Plan A: haptic stays at `hapticAtMs` (~2000). Arm `growClock` when media
   * PTS reaches this (punch LAND in the clip ≈ 2450–2500). Not the haptic beat.
   */
  growArmPts: 2475,
  /**
   * Wall-clock fallback after haptic if PTS never reaches `growArmPts`
   * (~225ms later at rate 2 ≈ 2450 PTS).
   */
  growArmAfterPunchMs: 225,
  /**
   * Plan B: hide native SplashScreen only when playing AND currentTime*1000
   * is in [0, this]. Not layout mount. Not firstFrame-then-seek-0.
   */
  nativeSplashHideMaxPts: 80,
  /**
   * Cinematic fighter (`videothanhcong`) ExoPlayer / expo-video speed.
   * Rate 2 = half wall-clock to the same media PTS marks.
   */
  videoPlaybackRate: 2,
  /**
   * Shared vein grow: ALL live strokes dashoffset length→0 on ONE growClock 0→1
   * in this duration. Extra radials SNAP at clock 1
   * (not 100+ jsProps). Not sequential per-path waits. Do not multiply by vein count.
   * Independent of the hold progress bar / load percent — never couple to them.
   */
  crackGrowMs: 1200,
  /**
   * Total stagger window across ALL veins (ms). 0 = every path starts at punch +0.
   * Cap 20ms if a tiny fan-out is needed — never per-vein * count.
   */
  veinStaggerMs: 0,
  /** Face fills after rays finish. Vector polygons, not PNG. Shared fillClock 0→1 in this duration (lockstep, not per-shard). */
  facetFillMs: 240,
  /**
   * Backup full-screen ice View after faces are opaque.
   * Not a clip radius. Must reach opacity 1 then lock.
   */
  glassCoverMs: 140,
  /**
   * MINIMUM wall-clock dwell after glassCovered/lock before sheetRelease/fly.
   * Shatter also requires the aggregate load + HUD bar at 100% and paint
   * readiness — this timer alone must not trigger fly. Not byte-level isDataReady.
   */
  glassHoldMs: 150,
  /**
   * Hold HUD fast-forward: when the aggregate load is already 100% as the bar
   * appears, fill from the displayed value to 100 in this duration. Never a
   * paced floor — a load still in flight is followed as-is.
   */
  hudFastForwardMs: 320,
  /**
   * Backup sheet under FacetShards — frosted milky pane so gaps are not dark holes.
   * Matches FACE_FILLS mid stop. Not `#000` / `#090A0C` / muddy mid-grey.
   * Dashboard / floor under ice stays `palettes.dark.bg`.
   */
  glassFillColor: "#e7eeea",
  /**
   * After glassFill withTiming, wait so the lock View can paint, then mount
   * the opaque floor. `onAppCovered` already fired at ice lock so home children
   * are in props. Do **not** pause or unmount VideoView on this beat.
   */
  glassLockDelayMs: 16,
  /**
   * Unused for pause/unmount (fighter keeps tail-looping under home).
   * Kept in hang / cinematic budget.
   */
  videoTeardownMs: 110,
  /**
   * Legacy settle after home paint. Fly no longer waits this after floor+home
   * `paintExtraFrames` — that extra hold froze ice then burst. Kept for hang math.
   */
  appPaintSettleMs: 24,
  /**
   * Window after which a *partial* FacetShard onLayout set counts as
   * `iceHostsReady` (hosts are mounted from punch, so this is a safety net).
   * **Not** a fly trigger any more — see `floorWaitGiveUpMs`.
   */
  cloneFallbackMs: 90,
  /**
   * Watchdog for the empty floor **sibling** (not ScreenStack). If that View
   * reports width>0 height 0, treat as collapsed: apply height from video/root/
   * window, log, then `floorPainted`. Do **not** crude-leave while ice lock is
   * the only cover. Do **not** hold ice forever waiting for height>0.
   * `finishToApp("noFloor")` overlay-off is only when there is no ice lock.
   */
  floorWaitGiveUpMs: 450,
  /**
   * After `onAppCovered` mounts the real home children, wait this long for their
   * wrapper `onLayout` + `paintExtraFrames`. Runs even if `floorPainted` is
   * still false (0-height floor used to starve this timer → infinite ice lock).
   * If it expires, fly anyway (holes may be `#090A0C` if Stack is still 0-tall).
   * Never hang. Never overlay-off before fly when ice locked.
   */
  homeContentGiveUpMs: 600,
  /**
   * Once the floor sibling has a real (or fallback) size, do not wait the full
   * `homeContentGiveUpMs` for Stack height — Dashboard can stay 0-tall.
   */
  homeContentGiveUpAfterFloorMs: 100,
  /**
   * Watchdog only: after the hang deadline with ice locked but **zero** hosts
   * laid out, stop waiting and leave the crude way (home covers → video off →
   * overlay off). Never hang on the ice lock forever; never fly empty.
   */
  hostWaitGiveUpMs: 700,
  /**
   * Legacy post-cover delay. Backup sheet now drops at fly start (same beat as
   * flyMs) so a solid pale rect cannot outlast the shards. Kept for hang math.
   */
  shardCoverSettleMs: 32,
  /**
   * Extra requestAnimationFrame ticks after onLayout w/h > 0.
   * Two rAF is **not** a painted gate. Frame count — do not halve with rate.
   */
  paintExtraFrames: 8,
  /**
   * After shardBreakMs, buffer then always onFinish (overlay off, then video).
   */
  leaveAfterBreakMs: 200,
  /**
   * LaunchGate last-resort **after shard fly starts** if cinematic never onFinish,
   * and the final deadline after a hang that was skipped for the cinematic.
   * Do **not** start this at ice lock / onAppCovered (that unmounted MmaSplash
   * mid-cinematic). Must outlast `splashFlyClockMs` + leaveAfterBreakMs + paint
   * frames.
   */
  lockLeaveTimeoutMs: 4500,
  /**
   * TRACKING / tail RANGE (ms): last this-many milliseconds of the *source*
   * punch-tracking window. JS wraps to max(0, duration − this/1000) near EOF
   * (never currentTime = 0 unless duration < tail; never player.loop).
   * Baked concat (original + last 0.90s ×3) is backup already in the MP4 —
   * changing this number does NOT rewrite those copies (ffmpeg + native rebuild).
   */
  videoTailLoopMs: 900,
  /**
   * Wrap this many seconds *before* EOF (inside the tail window).
   * Seeking on the last TextureView frame hitchs; wrap earlier than 0.12 / 0.40.
   * Never currentTime=0 of the full clip; never player.loop on the whole file.
   */
  videoTailSeekLeadSec: 0.62,
  /**
   * Anti-hammer between TextureView seeks. Halved with intro ×2 so wrap still
   * lands before glass lock at rate 2.
   */
  videoTailSeekCooldownMs: 160,
  /**
   * TRACKING / tail PLAYBACK SPEED. Matches intro rate so the seek loop keeps
   * the same wall-clock density relative to cinematic timers.
   */
  videoTailLoopRate: 2,
  /**
   * Closed-split hold AFTER a painted frame at currentTime near 0.
   * Do **not** start this clock at overlay mount (covers 0.3s+ of walk under black).
   * 0 = start wipe as soon as timeMs < introWipeArmMediaMs.
   */
  introHoldMs: 0,
  /**
   * Opening wipe after the post-frame hold. Must finish before punch (~2000ms PTS).
   */
  introWipeMs: 210,
  /**
   * Arm the intro wipe only once media PTS is below this (walk start), after a
   * painted frame. firstFrame timeMs > this → seek 0 once.
   */
  introWipeArmMediaMs: 200,
  /**
   * Legacy post-punch hold (unused for leave). Leave is P1 grow + P2 glass +
   * glassHoldMs + fadeMs. Kept so hang math / old call sites do not break.
   */
  crackRevealMs: 200,
  crackHoldMs: 250,
  /**
   * Puzzle fly after sheet drop: perspective + rotateX/Y + translate from punch.
   * Modest per-face scale — not overlay zoom-6. Same hosts that covered 100%.
   */
  shardBreakMs: 920,
  /** Alias for hang math / old leave timers — same as shardBreakMs. */
  fadeMs: 920,
  /**
   * Radius stagger: inner faces break first, rim faces last, spread over this.
   */
  shardStaggerMs: 200,
  /**
   * Fade must start **after** the travel is readable and end ~with it.
   */
  shardFadeStartRatio: 0.82,
  shardFadeMs: 220,
  /**
   * Worklet ease-out exponent for the fly (early push, no Easing.in).
   * 3.0 puts ~27% of the travel in the first ~80ms, so the gaps are wide enough
   * to read the home UI behind them almost immediately.
   */
  shardEasePower: 3,
  /** Travel = base + distance-from-punch × factor. */
  shardDistBase: 240,
  shardDistPerLen: 0.6,
  /**
   * Early per-cell shrink (peaks ~15% into the beat) so a dark seam opens around
   * EVERY cell in the first ~120ms — that is what reads as "kính rạn thành
   * từng miếng" before any piece has travelled far. Pure Reanimated, no PNG.
   */
  shardSeparateDip: 0.07,
  /**
   * Last-resort **after glassLocked** (or after fly via lockLeaveTimeout).
   * Do **not** arm at overlay mount / during crack grow / fill / hold.
   * LaunchGate must not enterLive on this clock while grow is still running.
   */
  splashHangMs: 6000,
  flashMs: 35,
  markPt: 36,
  wordmarkSize: 14,
  statusWidth: 36,
  statusHeight: 2,
} as const;

/**
 * Length of the `flyMs` shared-value ramp: the last-staggered face still gets a
 * full `shardBreakMs` of travel plus its fade tail.
 */
export const splashFlyClockMs =
  splash.shardStaggerMs + splash.shardBreakMs * splash.shardFadeStartRatio + splash.shardFadeMs;

export const splashCinematicMs =
  splash.crackGrowMs +
  splash.facetFillMs +
  splash.glassCoverMs +
  splash.glassLockDelayMs +
  splash.videoTeardownMs +
  splash.appPaintSettleMs +
  splash.shardCoverSettleMs +
  splash.glassHoldMs +
  splash.shardBreakMs +
  splash.leaveAfterBreakMs;

export function splashVideoLayout(viewW: number, viewH: number): {
  width: number;
  height: number;
  left: number;
  top: number;
} {
  const scale = splash.videoLayoutScale;
  const width = viewW * scale;
  const height = viewH * scale;
  return {
    width,
    height,
    left: -(width - viewW) * splash.videoLeftCrop,
    top: -(height - viewH) * splash.videoTopCrop,
  };
}

/** Fist contact in screen space after the watermark crop (not Animated transform). */
export function punchScreenOrigin(viewW: number, viewH: number): { x: number; y: number } {
  const layout = splashVideoLayout(viewW, viewH);
  return {
    x: layout.left + splash.punchScreenX * layout.width,
    y: layout.top + splash.punchScreenY * layout.height,
  };
}
