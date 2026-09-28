import { createContext, use } from "react";

/**
 * True while splash layers own the frame (status bar hidden, light icons).
 * Must NOT force Stack `contentStyle` / chrome to `splash.canvas` `#000` once
 * home is mounted under ice — holes would be unreadable.
 */
export const SplashLockContext = createContext(false);

export function useSplashLock() {
  return use(SplashLockContext);
}
