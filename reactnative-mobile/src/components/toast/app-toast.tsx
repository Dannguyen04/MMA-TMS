import { useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast, {
  BaseToast,
  type ToastConfig,
  type ToastConfigParams,
} from "react-native-toast-message";

import { type ColorTokens, useThemePreference } from "@/theme";
import { hapticSuccess } from "@/components/motion";

export type AppToastTone = "success" | "error" | "info";

const VISIBILITY_MS = 4200;

/** Slide + fade in, then the reverse slide + fade out before the toast unmounts visually. */
export const APP_TOAST_ANIMATION = {
  enter: { type: "timing" as const, duration: 320 },
  exit: { type: "timing" as const, duration: 280 },
};

export function showAppToast(message: string, tone: AppToastTone = "error") {
  const text = message.trim();
  if (!text) return;
  // Haptic chỉ cho lưu / thành công (Phương án B).
  if (tone === "success") hapticSuccess();
  Toast.show({
    type: tone,
    text1: text,
    position: "top",
    autoHide: true,
    visibilityTime: VISIBILITY_MS,
    swipeable: true,
    animationConfig: APP_TOAST_ANIMATION,
  });
}

export function useToastMessage(message: string | null | undefined, tone: AppToastTone) {
  const previous = useRef("");
  useEffect(() => {
    const next = message?.trim() ?? "";
    if (!next) {
      previous.current = "";
      return;
    }
    if (previous.current === next) return;
    previous.current = next;
    showAppToast(next, tone);
  }, [message, tone]);
}

function toastCard(colors: ColorTokens, tone: AppToastTone) {
  const backgroundColor =
    tone === "success" ? colors.successSoft : tone === "info" ? colors.surfaceMuted : colors.dangerSoft;
  const accent = tone === "success" ? colors.success : tone === "info" ? colors.ink : colors.danger;
  return function ThemedToast(props: ToastConfigParams<unknown>) {
    return (
      <BaseToast
        text1={props.text1}
        text2={props.text2}
        onPress={props.onPress}
        style={[styles.card, { backgroundColor, borderLeftColor: accent }, props.text2 ? { height: undefined, minHeight: 84 } : null]}
        contentContainerStyle={[styles.content, props.text2 ? { paddingVertical: 6, overflow: "visible" } : null]}
        text1NumberOfLines={6}
        text1Style={[styles.text, { color: accent }]}
        text2NumberOfLines={2}
        text2Style={{ color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "700", textDecorationLine: "underline", paddingBottom: 2 }}
      />
    );
  };
}

export function AppToastHost() {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const config = useMemo<ToastConfig>(
    () => ({
      success: toastCard(colors, "success"),
      error: toastCard(colors, "error"),
      info: toastCard(colors, "info"),
    }),
    [colors],
  );

  return (
    <Toast
      config={config}
      position="top"
      topOffset={insets.top + 12}
      visibilityTime={VISIBILITY_MS}
      autoHide
      swipeable
      animationConfig={APP_TOAST_ANIMATION}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    height: undefined,
    minHeight: 64,
    width: "92%",
    maxWidth: 420,
    borderLeftWidth: 5,
    paddingVertical: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
