import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { filterText } from "@/i18n/filter";
import { fonts, motion, radius, spacing, useThemePreference } from "@/theme";
import { mixHex } from "@/theme/appearance/color-math";

export type FilterOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * Nút lọc gọn + bottom sheet chọn (dùng chung cho mọi role).
 * - Chọn một: chạm là áp dụng và đóng.
 * - Chọn nhiều: có "Xoá lọc" / "Áp dụng"; chỉ áp dụng khi bấm nút.
 * `allValue` (chọn một) là giá trị "không lọc" — không tính vào badge.
 */
type SingleProps<T extends string> = {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
  allValue?: T;
};
type MultiProps<T extends string> = {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
};
export type FilterSelectProps<T extends string> = (SingleProps<T> | MultiProps<T>) & {
  /** Tên bộ lọc (tiêu đề sheet + tiền tố nút), ví dụ "Trạng thái". */
  label: string;
  options: readonly FilterOption<T>[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Màu chữ nhãn + biểu tượng phụ (mặc định `inkMuted`). */
  mutedColor?: string;
};

export function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  const { label, options, style, testID } = props;
  const { colors } = useThemePreference();
  const muted = props.mutedColor ?? colors.inkMuted;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T[]>([]);

  const selected: readonly T[] = props.multiple ? props.value : [props.value];
  const allValue = props.multiple ? undefined : props.allValue;
  const activeCount = props.multiple
    ? props.value.length
    : props.value === allValue || (allValue === undefined && props.value === "")
      ? 0
      : 1;
  const current = useMemo(() => {
    if (props.multiple) {
      if (props.value.length === 0) return filterText.all;
      const first = options.find((o) => o.value === props.value[0])?.label ?? "";
      return props.value.length === 1 ? first : `${first} +${props.value.length - 1}`;
    }
    return options.find((o) => o.value === props.value)?.label ?? filterText.all;
  }, [options, props.multiple, props.value]);

  const openSheet = () => {
    if (props.multiple) setDraft([...props.value]);
    setOpen(true);
  };
  const active = activeCount > 0;
  const accent = colors.lotus;

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={filterText.triggerA11y(label, current)}
        accessibilityState={{ expanded: open }}
        onPress={openSheet}
        hitSlop={4}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: active ? accent : colors.controlBorder,
            backgroundColor: active ? mixHex(colors.surface, accent, 0.08) : colors.surface,
            opacity: pressed ? 0.75 : 1,
          },
          style,
        ]}
      >
        <Icon name="filter" size={16} color={active ? accent : muted} />
        <Text numberOfLines={1} style={[styles.triggerText, { color: colors.ink }]}>
          <Text style={{ color: muted }}>{label}: </Text>
          {current}
        </Text>
        {active ? (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={[styles.badgeText, { color: colors.onCta }]}>{activeCount}</Text>
          </View>
        ) : null}
        <Icon name="chevronDown" size={16} color={muted} />
      </Pressable>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          props.multiple ? (
            <View style={styles.footer}>
              <SheetButton label={filterText.clear} onPress={() => setDraft([])} disabled={draft.length === 0} />
              <SheetButton
                primary
                label={draft.length ? `${filterText.apply} (${draft.length})` : filterText.apply}
                onPress={() => {
                  if (props.multiple) props.onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
          ) : null
        }
      >
        {options.map((option) => {
          const on = props.multiple ? draft.includes(option.value) : selected.includes(option.value);
          return (
            <Pressable
              key={option.value || "__all"}
              accessibilityRole={props.multiple ? "checkbox" : "radio"}
              accessibilityState={props.multiple ? { checked: on } : { selected: on }}
              onPress={() => {
                if (props.multiple) {
                  setDraft((d) => (d.includes(option.value) ? d.filter((v) => v !== option.value) : [...d, option.value]));
                  return;
                }
                props.onChange(option.value);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                { borderBottomColor: colors.line, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
              ]}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: on ? accent : colors.ink }]}>{option.label}</Text>
                {option.hint ? <Text style={[styles.hint, { color: colors.inkMuted }]}>{option.hint}</Text> : null}
              </View>
              {props.multiple ? (
                <View
                  style={[
                    styles.box,
                    { borderColor: on ? accent : colors.controlBorder, backgroundColor: on ? accent : "transparent" },
                  ]}
                >
                  {on ? <Icon name="check" size={14} color={colors.onCta} /> : null}
                </View>
              ) : on ? (
                <Icon name="check" size={18} color={accent} />
              ) : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </>
  );
}

function SheetButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.cta, borderColor: colors.cta }
          : { backgroundColor: colors.surface, borderColor: colors.controlBorder },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? colors.onCta : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Bottom sheet trượt lên: backdrop, kéo/chạm để đóng, safe-area, tôn trọng giảm chuyển động. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useThemePreference();
  // Không bắt buộc SafeAreaProvider (test/màn lẻ) — thiếu thì coi inset = 0.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const offset = useSharedValue(height);
  const fade = useSharedValue(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const duration = reduced ? 0 : motion.base;
    if (visible) {
      setMounted(true);
      offset.value = reduced ? 0 : height;
      fade.value = reduced ? 1 : 0;
      offset.value = withTiming(0, { duration });
      fade.value = withTiming(1, { duration });
      return;
    }
    if (!mounted) return;
    fade.value = withTiming(0, { duration });
    offset.value = withTiming(height, { duration });
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [visible, reduced, height, mounted, offset, fade]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          offset.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.8) closeRef.current();
          else offset.value = withTiming(0, { duration: reduced ? 0 : motion.press * 2 });
        },
        onPanResponderTerminate: () => {
          offset.value = withTiming(0, { duration: reduced ? 0 : motion.press * 2 });
        },
      }),
    [offset, reduced],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel={filterText.backdrop} style={styles.flex} onPress={onClose} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              paddingBottom: insets.bottom + spacing.md,
              maxHeight: height * 0.8,
            },
            sheetStyle,
          ]}
        >
          <View {...pan.panHandlers} style={styles.grab}>
            <View accessibilityLabel={filterText.handle} style={[styles.handle, { backgroundColor: colors.controlBorder }]} />
            <View style={styles.head}>
              <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
                {title}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={filterText.close} onPress={onClose} hitSlop={10} style={styles.close}>
                <Icon name="close" size={20} color={colors.inkMuted} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={Platform.OS === "web" ? ({ scrollbarWidth: "none" } as ViewStyle) : undefined}
          >
            {children}
          </ScrollView>
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  trigger: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  triggerText: { flexShrink: 1, fontFamily: fonts.uiMedium, fontSize: 14 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { fontFamily: fonts.uiSemi, fontSize: 12 },
  sheet: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  grab: { paddingTop: spacing.sm },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  title: { flex: 1, fontFamily: fonts.uiSemi, fontSize: 17 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontFamily: fonts.ui, fontSize: 16 },
  hint: { fontFamily: fonts.ui, fontSize: 13 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", gap: spacing.md, paddingTop: spacing.sm },
  button: { flex: 1, minHeight: 48, borderRadius: radius.field, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.uiSemi, fontSize: 15 },
});
