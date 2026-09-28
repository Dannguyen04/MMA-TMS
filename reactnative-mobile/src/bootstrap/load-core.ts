import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  SPLASH_STORAGE_TASK_COUNT,
  splashLoadProgressPct,
} from "@/components/launch/splash-shatter-gate";
import { THEME_PREFERENCE_KEY } from "@/theme/theme-preference";

export const SESSION_KEY = "mma.session";
export const DASHBOARD_CACHE_KEY = "mma.dashboard.cache";

export type CoreBootstrap = {
  themePreference: string | null;
  session: string | null;
};

export type DashboardBootstrap = {
  cache: string | null;
  ready: boolean;
};

export type SplashBootstrapResult = {
  core: CoreBootstrap;
  dashboard: DashboardBootstrap;
};

export type SplashLoadProgressHandler = (
  completedTasks: number,
  totalTasks: number,
  progressPct: number,
) => void;

async function settleStorageTask<T>(
  task: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

/**
 * Runs the three AsyncStorage splash tasks concurrently. Each settled task
 * (success or failure) bumps `completedTasks` so progress never hangs on a
 * storage error. Reports storage-only counts; LaunchGate folds in session
 * restore for the aggregate splash %.
 */
export async function runSplashBootstrap(
  onTaskDone?: SplashLoadProgressHandler,
): Promise<SplashBootstrapResult> {
  let completed = 0;
  const total = SPLASH_STORAGE_TASK_COUNT;

  const bump = () => {
    completed += 1;
    onTaskDone?.(completed, total, splashLoadProgressPct(completed, total));
  };

  const runTask = async <T,>(task: () => Promise<T>, fallback: T): Promise<T> => {
    const value = await settleStorageTask(task, fallback);
    bump();
    return value;
  };

  const [themePreference, session, cache] = await Promise.all([
    runTask(() => AsyncStorage.getItem(THEME_PREFERENCE_KEY), null),
    runTask(() => AsyncStorage.getItem(SESSION_KEY), null),
    runTask(() => AsyncStorage.getItem(DASHBOARD_CACHE_KEY), null),
  ]);

  return {
    core: {
      themePreference: themePreference ?? null,
      session: session ?? null,
    },
    dashboard: { cache: cache ?? null, ready: true },
  };
}

export async function loadCoreApp(): Promise<CoreBootstrap> {
  const { core } = await runSplashBootstrap();
  return core;
}

export async function loadDashboardData(): Promise<DashboardBootstrap> {
  const cache = await settleStorageTask(() => AsyncStorage.getItem(DASHBOARD_CACHE_KEY), null);
  return { cache, ready: true };
}
