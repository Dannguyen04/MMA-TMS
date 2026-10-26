import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motion, radius, spacing, type, useThemePreference } from "@/theme";

/**
 * One slide from the bottom. Reduced motion drops the travel and still opens and closes.
 */
export function SlideSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const translate = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    const duration = reduced ? 0 : motion.base;
    const native = Platform.OS !== "web";
    if (visible) {
      setMounted(true);
      translate.setValue(reduced ? 0 : height);
      backdrop.setValue(reduced ? 1 : 0);
      Animated.parallel([
        Animated.timing(translate, { toValue: 0, duration, useNativeDriver: native }),
        Animated.timing(backdrop, { toValue: 1, duration, useNativeDriver: native }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(translate, { toValue: height, duration, useNativeDriver: native }),
      Animated.timing(backdrop, { toValue: 0, duration, useNativeDriver: native }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [backdrop, height, mounted, reduced, translate, visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" style={styles.fill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateY: translate }],
            },
          ]}
        >
          <View style={styles.head}>
            <Text style={[type.title, styles.title, { color: colors.ink, textTransform: "none" }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
            >
              <Text style={[type.link, { color: colors.lotus }]}>Đóng</Text>
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={Platform.OS === "web" ? ({ scrollbarWidth: "none" } as ViewStyle) : undefined}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SheetOption({
  label,
  selected,
  onPress,
  hint,
  swatches,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hint?: string;
  /** Two-colour preview chip (background, accent) shown before the label. */
  swatches?: readonly [string, string];
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {swatches ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.swatch, { borderColor: colors.controlBorder, backgroundColor: swatches[0] }]}
        >
          <View style={[styles.swatchDot, { backgroundColor: swatches[1] }]} />
        </View>
      ) : null}
      <View style={styles.optionText}>
        <Text style={[type.body, { color: selected ? colors.lotus : colors.ink }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: colors.ink }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flex: 1 },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  optionText: { flex: 1, gap: 2 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchDot: { width: 16, height: 16, borderRadius: 8 },
});
