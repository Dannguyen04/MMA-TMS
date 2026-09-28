/** AsyncStorage splash reads in `runSplashBootstrap` (theme / session / dashboard cache). */
export const SPLASH_STORAGE_TASK_COUNT = 3;

/** Aggregate splash load: the storage reads plus SessionProvider restore, equal weight. */
export const SPLASH_LOAD_TASK_COUNT = SPLASH_STORAGE_TASK_COUNT + 1;

/**
 * Task-count progress. With the default total: 0/4→0, 1/4→25, 2/4→50,
 * 3/4→75, 4/4→100. Not a time lerp.
 */
export function splashLoadProgressPct(
  completedTasks: number,
  totalTasks: number = SPLASH_LOAD_TASK_COUNT,
): number {
  if (totalTasks <= 0) return 100;
  const done = Math.max(0, Math.min(completedTasks, totalTasks));
  return Math.round((done / totalTasks) * 100);
}

/**
 * Aggregate splash load %: settled storage reads + settled session restore,
 * over `SPLASH_LOAD_TASK_COUNT`. A task that failed into its fallback counts
 * as settled.
 */
export function splashAggregateLoadPct(storageSettled: number, sessionSettled: boolean): number {
  const storage = Math.max(0, Math.min(storageSettled, SPLASH_STORAGE_TASK_COUNT));
  return splashLoadProgressPct(storage + (sessionSettled ? 1 : 0), SPLASH_LOAD_TASK_COUNT);
}

export type CanStartShardFlyInput = {
  /** Grow + fill + glass cover finished (do not cut crack short). */
  crackPipelineDone: boolean;
  /** `glassHoldMs` minimum dwell after cover elapsed. */
  minDwellDone: boolean;
  /** 0–100 aggregate load (storage reads + session restore); must be 100. */
  loadProgress: number;
  /**
   * Hold HUD bar has displayed 100% (real follow or the short fast-forward
   * finished), so the glass never breaks under a bar that still reads < 100.
   */
  barFilled: boolean;
  /**
   * Hold lockup has finished its exit. Shatter waits so the overlay can
   * leave before the glass breaks.
   */
  overlayExitDone: boolean;
  /** Ice hosts + floor/home paint readiness (or give-up watchdogs). */
  paintReady: boolean;
};

/**
 * Shatter may start only when crack pipeline, min dwell, aggregate load 100%,
 * HUD bar filled, overlay exit, and paint readiness are all true.
 * Pure — no timers, no RN.
 */
export function canStartShardFly(input: CanStartShardFlyInput): boolean {
  return (
    input.crackPipelineDone &&
    input.minDwellDone &&
    input.loadProgress >= 100 &&
    input.barFilled &&
    input.overlayExitDone &&
    input.paintReady
  );
}

/**
 * Pale full-screen backup ice is hold-only. Once fly starts it must not stay
 * opaque — that solid rect vanishing is the white flash over dark home.
 */
export function shouldShowBackupIceSheet(flyStarted: boolean): boolean {
  return !flyStarted;
}
