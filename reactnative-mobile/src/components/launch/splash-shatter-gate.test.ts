import {
  canStartShardFly,
  shouldShowBackupIceSheet,
  splashAggregateLoadPct,
  splashLoadProgressPct,
  SPLASH_LOAD_TASK_COUNT,
  SPLASH_STORAGE_TASK_COUNT,
} from "@/components/launch/splash-shatter-gate";

describe("splashLoadProgressPct", () => {
  it("maps discrete task counts to 0 / 25 / 50 / 75 / 100", () => {
    expect(SPLASH_STORAGE_TASK_COUNT).toBe(3);
    expect(SPLASH_LOAD_TASK_COUNT).toBe(4);
    expect(splashLoadProgressPct(0)).toBe(0);
    expect(splashLoadProgressPct(1)).toBe(25);
    expect(splashLoadProgressPct(2)).toBe(50);
    expect(splashLoadProgressPct(3)).toBe(75);
    expect(splashLoadProgressPct(4)).toBe(100);
  });

  it("clamps completed tasks to [0, total]", () => {
    expect(splashLoadProgressPct(-1)).toBe(0);
    expect(splashLoadProgressPct(99)).toBe(100);
  });
});

describe("splashAggregateLoadPct", () => {
  it("weights each storage read and the session restore at 25%", () => {
    expect(splashAggregateLoadPct(0, false)).toBe(0);
    expect(splashAggregateLoadPct(0, true)).toBe(25);
    expect(splashAggregateLoadPct(2, false)).toBe(50);
    expect(splashAggregateLoadPct(3, false)).toBe(75);
    expect(splashAggregateLoadPct(3, true)).toBe(100);
  });

  it("clamps storage counts so a double report cannot pass 100", () => {
    expect(splashAggregateLoadPct(9, false)).toBe(75);
    expect(splashAggregateLoadPct(9, true)).toBe(100);
    expect(splashAggregateLoadPct(-2, true)).toBe(25);
  });
});

describe("canStartShardFly", () => {
  const ready = {
    crackPipelineDone: true,
    minDwellDone: true,
    loadProgress: 100,
    barFilled: true,
    overlayExitDone: true,
    paintReady: true,
  };

  it("allows fly only when crack, min dwell, load 100, bar filled, overlay exit, and paint are all true", () => {
    expect(canStartShardFly(ready)).toBe(true);
  });

  it("blocks fly when load finished before crack pipeline", () => {
    expect(
      canStartShardFly({
        ...ready,
        crackPipelineDone: false,
        loadProgress: 100,
        minDwellDone: false,
      }),
    ).toBe(false);
  });

  it("blocks fly when crack done but min dwell not elapsed", () => {
    expect(
      canStartShardFly({
        ...ready,
        minDwellDone: false,
      }),
    ).toBe(false);
  });

  it("blocks fly when crack done before load reaches 100", () => {
    expect(
      canStartShardFly({
        ...ready,
        loadProgress: 67,
      }),
    ).toBe(false);
  });

  it("blocks fly while the HUD bar has not reached 100 even if real load is 100", () => {
    expect(
      canStartShardFly({
        ...ready,
        loadProgress: 100,
        barFilled: false,
      }),
    ).toBe(false);
  });

  it("blocks fly when the hold overlay has not finished leaving", () => {
    expect(
      canStartShardFly({
        ...ready,
        overlayExitDone: false,
      }),
    ).toBe(false);
  });

  it("blocks fly when paint gate is not ready", () => {
    expect(
      canStartShardFly({
        ...ready,
        paintReady: false,
      }),
    ).toBe(false);
  });
});

describe("shouldShowBackupIceSheet", () => {
  it("allows the pale backup sheet only before fly — never opaque for the whole fly", () => {
    expect(shouldShowBackupIceSheet(false)).toBe(true);
    expect(shouldShowBackupIceSheet(true)).toBe(false);
  });
});
