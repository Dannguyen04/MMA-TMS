import { Platform, useWindowDimensions } from "react-native";

/**
 * Phase 5 F: from this window width the role tab bar leaves the bottom edge:
 * a left Material navigation rail (Android tablets, web) or, on iPad, an iPadOS-style sidebar.
 */
export const NAV_RAIL_MIN_WIDTH = 900;
/** Rail width: 80dp Material rail plus room for two-line Vietnamese labels ("Thông báo", "Người dùng"). */
export const NAV_RAIL_WIDTH = 88;
/** iPad sidebar width: icon with the label beside it (iPadOS sidebar). */
export const NAV_SIDEBAR_WIDTH = 240;

export type NavKind = "bar" | "rail" | "sidebar";

/** Read at call time (not import time) so tests and the web harness can stand in for an iPad. */
export function isPadDevice(): boolean {
  return Platform.OS === "ios" && Platform.isPad === true;
}

export function isNavRail(windowWidth: number): boolean {
  return windowWidth >= NAV_RAIL_MIN_WIDTH;
}

export function navKind(windowWidth: number, pad: boolean = isPadDevice()): NavKind {
  if (!isNavRail(windowWidth)) return "bar";
  return pad ? "sidebar" : "rail";
}

/** Width the side navigation takes from the screen (0 for the bottom bar), before safe-area insets. */
export function navSideWidth(kind: NavKind): number {
  return kind === "sidebar" ? NAV_SIDEBAR_WIDTH : kind === "rail" ? NAV_RAIL_WIDTH : 0;
}

export function useNavKind(): NavKind {
  return navKind(useWindowDimensions().width);
}

/** True when the navigation sits on the left (rail or sidebar); layouts set `tabBarPosition: "left"`. */
export function useNavRail(): boolean {
  return useNavKind() !== "bar";
}
