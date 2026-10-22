import type { ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

import { cx } from "./tokens";

const ALL_EDGES: readonly Edge[] = ["top", "right", "bottom", "left"];

/** Web only: keep the mobile layout in a centered phone-width column instead of stretching it. */
const frameClass = Platform.OS === "web" ? "w-full max-w-phone self-center" : "w-full";

export type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView. Default true. */
  scroll?: boolean;
  /** Safe-area edges to pad. Default all. */
  edges?: readonly Edge[];
  /** Layout-only classes for the content column. */
  className?: string;
};

export function Screen({ children, scroll = true, edges = ALL_EDGES, className }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const safeArea = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
  };
  const column = cx("gap-section px-screen py-screen", className);

  return (
    <View className="flex-1 bg-background" style={safeArea}>
      <View className={cx("flex-1", frameClass)}>
        {scroll ? (
          <ScrollView className="flex-1" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
            <View className={column}>{children}</View>
          </ScrollView>
        ) : (
          <View className={cx("flex-1", column)}>{children}</View>
        )}
      </View>
    </View>
  );
}
