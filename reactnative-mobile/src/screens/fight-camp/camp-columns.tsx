import { createContext, useContext, type ReactNode } from "react";
import { View } from "react-native";

/**
 * Phase 5 E: coach screens split into two columns when the space CampShell actually gets
 * (window minus the navigation rail) is at least this wide.
 */
export const CAMP_TWO_COLUMN_MIN = 900;
/**
 * Cap for the two-column column. 1040 = 22 + 486 + 24 + 486 + 22: each column keeps about the
 * width of the single 640 column's text block, so line length and scanning stay as on phones.
 * With the iPad sidebar (240): 1180 → 940 and 1366 → 1126 get two columns; 1024 → 784 stays one.
 * Android/web rail (88): 1024 → 936, 1180 → 1092, 1280 → 1192 get two columns.
 */
export const CAMP_TWO_COLUMN_MAX = 1040;

export function campTwoColumns(enabled: boolean, availableWidth: number): boolean {
  return enabled && availableWidth >= CAMP_TWO_COLUMN_MIN;
}

const TwoColumns = createContext(false);
export const CampTwoColumnsProvider = TwoColumns.Provider;
export const useCampTwoColumns = () => useContext(TwoColumns);

/**
 * Below the threshold renders `children` unchanged (the phone order). From the threshold renders
 * `left` and `right` side by side, each column stacked with the same gap as the screen.
 */
export function CampColumns({ left, right, gap = 22, children }: { left: ReactNode; right: ReactNode; gap?: number; children: ReactNode }) {
  const wide = useCampTwoColumns();
  if (!wide) return <>{children}</>;
  return <View testID="camp-two-columns" style={{ flexDirection: "row", alignItems: "flex-start", gap: 24 }}>
    <View testID="camp-column-left" style={{ flex: 1, minWidth: 0, gap }}>{left}</View>
    <View testID="camp-column-right" style={{ flex: 1, minWidth: 0, gap }}>{right}</View>
  </View>;
}
