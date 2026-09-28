export type SplashVideoSource = {
  /** Scheme-less Android raw name, android.resource URI, or Metro/web URL. */
  uri?: string;
  /** Metro `require()` asset id (iOS / web). Exclusive with uri when both set. */
  assetId?: number;
};

export type SplashVideoPlayerProps = {
  source: SplashVideoSource;
  onFail: () => void;
  onImpact: (meta: { path: string; timeMs: number; shutterBeforePunch: boolean }) => void;
  /** Plan A: growClock when punch LANDS (PTS >= growArmPts), not at haptic. */
  onGrowArm: (meta: { path: string; timeMs: number; punchLanded: boolean }) => void;
  onFirstFrame: (meta: { timeMs: number }) => void;
  onWalkVisible?: (timeMs: number) => void;
  /** Native splash is the hold. RN wipe must not cover walk-in. */
  shutterDone: boolean;
  /** VideoView box in px (may be larger than the stage; no overflow:hidden parent). */
  layoutWidth: number;
  layoutHeight: number;
  layoutLeft: number;
  layoutTop: number;
};
