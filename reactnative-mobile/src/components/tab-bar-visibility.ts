import { useSyncExternalStore } from "react";

/**
 * Whether the role tab bar (Coach, Admin, Doctor) is drawn along the bottom right now. A screen inside the tabs
 * still gets the device's bottom inset from `useSafeAreaInsets`, but the bar already pads for it, so a docked
 * footer that adds it again floats a gesture-bar's height above the tabs (owner 2026-11-19, Phân tích đối thủ).
 */
let visible = false;
const listeners = new Set<() => void>();

export function setBottomTabBarVisible(next: boolean) {
  if (next === visible) return;
  visible = next;
  listeners.forEach((l) => l());
}

export function useBottomTabBarVisible(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => visible, () => visible);
}
