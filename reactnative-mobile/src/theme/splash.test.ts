import { splash, splashFlyClockMs, splashVideoLayout } from "@/theme/splash";

describe("splash intro ×2 timing constants", () => {
  it("sets playback rates to 2", () => {
    expect(splash.videoPlaybackRate).toBe(2);
    expect(splash.videoTailLoopRate).toBe(2);
  });

  it("keeps media PTS thresholds unchanged", () => {
    expect(splash.hapticAtMs).toBe(2000);
    expect(splash.growArmPts).toBe(2475);
    expect(splash.punchMinMediaMs).toBe(1800);
    expect(splash.nativeSplashHideMaxPts).toBe(80);
    expect(splash.introWipeArmMediaMs).toBe(200);
  });

  it("halves wall-clock cinematic delays", () => {
    expect(splash.growArmAfterPunchMs).toBe(225);
    expect(splash.crackGrowMs).toBe(1200);
    expect(splash.facetFillMs).toBe(240);
    expect(splash.glassCoverMs).toBe(140);
    expect(splash.glassHoldMs).toBe(150);
    expect(splash.hudFastForwardMs).toBeGreaterThanOrEqual(250);
    expect(splash.hudFastForwardMs).toBeLessThanOrEqual(400);
    expect(splash.glassLockDelayMs).toBe(16);
    expect(splash.cloneFallbackMs).toBe(90);
    expect(splash.floorWaitGiveUpMs).toBe(450);
    expect(splash.homeContentGiveUpMs).toBe(600);
    expect(splash.homeContentGiveUpAfterFloorMs).toBe(100);
    expect(splash.hostWaitGiveUpMs).toBe(700);
    expect(splash.leaveAfterBreakMs).toBe(200);
    expect(splash.lockLeaveTimeoutMs).toBe(4500);
    expect(splash.splashHangMs).toBe(6000);
    expect(splash.introWipeMs).toBe(210);
    expect(splash.videoTailSeekCooldownMs).toBe(160);
    expect(splash.shardBreakMs).toBe(920);
    expect(splash.fadeMs).toBe(920);
    expect(splash.shardStaggerMs).toBe(200);
    expect(splash.shardFadeMs).toBe(220);
    expect(splash.shardFadeStartRatio).toBe(0.82);
  });

  it("halves legacy hang-math constants", () => {
    expect(splash.videoTeardownMs).toBe(110);
    expect(splash.appPaintSettleMs).toBe(24);
    expect(splash.shardCoverSettleMs).toBe(32);
    expect(splash.crackRevealMs).toBe(200);
    expect(splash.crackHoldMs).toBe(250);
    expect(splash.flashMs).toBe(35);
  });

  it("does not change paintExtraFrames (frame count)", () => {
    expect(splash.paintExtraFrames).toBe(8);
  });

  it("keeps splashFlyClockMs formula consistent with ×3 shatter timers", () => {
    const expected =
      splash.shardStaggerMs + splash.shardBreakMs * splash.shardFadeStartRatio + splash.shardFadeMs;
    expect(splashFlyClockMs).toBe(expected);
    expect(splashFlyClockMs).toBeCloseTo(1174.4, 5);
    expect(splash.lockLeaveTimeoutMs).toBeGreaterThan(
      splashFlyClockMs + splash.leaveAfterBreakMs,
    );
  });
});

describe("splash video layout across screen shapes", () => {
  it("keeps the phone layout unchanged", () => {
    const box = splashVideoLayout(390, 844);
    expect(box.width).toBeCloseTo(390 * splash.videoLayoutScale);
    expect(box.height).toBeCloseTo(844 * splash.videoLayoutScale);
    expect(box.watermarkMask.width).toBe(0);
  });

  it.each([
    ["iPad portrait", 820, 1180],
    ["iPad landscape", 1180, 820],
    ["desktop browser", 1440, 900],
  ])("keeps the 9:16 clip shape and centres it on %s", (_label, w, h) => {
    const box = splashVideoLayout(w, h);
    expect(box.width / box.height).toBeCloseTo(splash.videoWidth / splash.videoHeight);
    // The un-cropped part of the clip is centred on screen.
    const visibleLeft = box.watermarkMask.left + box.watermarkMask.width;
    const visibleWidth = (h * splash.videoWidth) / splash.videoHeight;
    expect(Math.abs(visibleLeft + visibleWidth / 2 - w / 2)).toBeLessThan(1);
    // The watermark strip is masked.
    expect(box.watermarkMask.width).toBeGreaterThan(0);
    expect(box.watermarkMask.left).toBeCloseTo(box.left);
  });
});
