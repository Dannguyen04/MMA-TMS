import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthUnderlineField } from "@/components/auth/auth-underline-field";
import { vi } from "@/i18n/vi";
import { radius, spacing, type, useThemePreference } from "@/theme";
import { isValidDateOnly } from "@/utils/is-valid-date-only";

type AuthDateFieldProps = {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  onChangeText: (value: string) => void;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Visible wheel viewport. Padding + scrollToOffset(index * item) centers the row. */
export const AUTH_DATE_WHEEL_ITEM = 44;
export const AUTH_DATE_WHEEL_VIEWPORT = 220;
const WHEEL_PAD = (AUTH_DATE_WHEEL_VIEWPORT - AUTH_DATE_WHEEL_ITEM) / 2;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseParts(value: string) {
  if (!isValidDateOnly(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

function displayDate(value: string) {
  const parts = parseParts(value);
  if (!parts) return "";
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function AuthDateField({
  label,
  value,
  error,
  helper,
  onChangeText,
}: AuthDateFieldProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const now = new Date();
  const maxYear = now.getFullYear();
  const minYear = maxYear - 80;
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear, minYear],
  );

  const parsed = parseParts(value);
  const [year, setYear] = useState(parsed?.year ?? 2000);
  const [month, setMonth] = useState(parsed?.month ?? 1);
  const [day, setDay] = useState(parsed?.day ?? 1);
  const yearRef = useRef(year);
  const monthRef = useRef(month);
  const dayRef = useRef(day);
  yearRef.current = year;
  monthRef.current = month;
  dayRef.current = day;

  const hasError = Boolean(error);
  const shown = displayDate(value);
  const showHelper = Boolean(helper) && !hasError;

  const openPicker = () => {
    Keyboard.dismiss();
    const next = parseParts(value);
    setYear(next?.year ?? 2000);
    setMonth(next?.month ?? 1);
    setDay(next?.day ?? 1);
    setFocused(true);
    setOpen(true);
  };

  const apply = () => {
    const dim = daysInMonth(yearRef.current, monthRef.current);
    const safeDay = Math.min(dayRef.current, dim);
    onChangeText(`${yearRef.current}-${pad2(monthRef.current)}-${pad2(safeDay)}`);
    setOpen(false);
    setFocused(false);
  };

  const dim = daysInMonth(year, month);
  const days = useMemo(
    () => Array.from({ length: dim }, (_, i) => i + 1),
    [dim],
  );

  return (
    <View style={styles.root}>
      <AuthUnderlineField
        label={label}
        error={error}
        helper={helper}
        helperPersistent={showHelper}
        focused={focused}
        filled={Boolean(shown)}
        onPress={openPicker}
        accessibilityLabel={shown ? `${label}. ${shown}` : `${label}. ${vi.register.pickDate}`}
        accessory={
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={22}
            color={colors.inkMuted}
          />
        }
      >
        <Text
          style={[
            type.body,
            styles.value,
            { color: shown ? colors.ink : colors.inkSubtle },
          ]}
        >
          {shown || (focused ? vi.register.datePlaceholder : "")}
        </Text>
      </AuthUnderlineField>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setOpen(false);
            setFocused(false);
          }}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
            onPress={() => undefined}
          >
            <Text style={[type.title, { color: colors.ink, fontSize: 22 }]}>{label}</Text>
            <View style={styles.columns}>
              <Wheel
                label={vi.register.year}
                values={years}
                selected={year}
                open={open}
                onSelect={setYear}
              />
              <Wheel
                label={vi.register.month}
                values={MONTHS}
                selected={month}
                open={open}
                onSelect={(next) => {
                  setMonth(next);
                  setDay((d) => Math.min(d, daysInMonth(year, next)));
                }}
              />
              <Wheel
                label={vi.register.day}
                values={days}
                selected={Math.min(day, dim)}
                open={open}
                onSelect={setDay}
              />
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOpen(false);
                  setFocused(false);
                }}
                style={styles.action}
              >
                <Text style={[type.link, { color: colors.inkMuted }]}>{vi.common.cancel}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={apply} style={styles.action}>
                <Text style={[type.link, { color: colors.lotus }]}>{vi.common.done}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function wheelOffset(index: number) {
  return index * AUTH_DATE_WHEEL_ITEM;
}

function Wheel({
  label,
  values,
  selected,
  open,
  onSelect,
}: {
  label: string;
  values: readonly number[];
  selected: number;
  open: boolean;
  onSelect: (value: number) => void;
}) {
  const { colors } = useThemePreference();
  const listRef = useRef<FlatList<number>>(null);
  const data = useMemo(() => [...values], [values]);
  const selectedIndex = Math.max(0, data.findIndex((item) => item === selected));

  const scrollSelected = (animated: boolean) => {
    listRef.current?.scrollToOffset({
      offset: wheelOffset(selectedIndex),
      animated,
    });
  };

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => scrollSelected(false));
    return () => cancelAnimationFrame(frame);
  }, [open, selectedIndex, data.length]);

  return (
    <View style={styles.wheel}>
      <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>{label}</Text>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => String(item)}
        style={styles.wheelScroll}
        contentContainerStyle={styles.wheelContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_items, index) => ({
          length: AUTH_DATE_WHEEL_ITEM,
          offset: wheelOffset(index),
          index,
        })}
        onScrollToIndexFailed={() => {
          requestAnimationFrame(() => scrollSelected(false));
        }}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label} ${pad2(item)}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(item)}
              style={[
                styles.wheelItem,
                active
                  ? {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.lotus,
                    }
                  : { borderColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  type.body,
                  {
                    color: active ? colors.lotus : colors.ink,
                    textAlign: "center",
                    fontWeight: active ? "700" : "400",
                  },
                ]}
              >
                {pad2(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minWidth: 0,
  },
  value: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  columns: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  wheel: {
    flex: 1,
    gap: spacing.xs,
  },
  wheelScroll: {
    height: AUTH_DATE_WHEEL_VIEWPORT,
  },
  wheelContent: {
    paddingVertical: WHEEL_PAD,
  },
  wheelItem: {
    height: AUTH_DATE_WHEEL_ITEM,
    minHeight: AUTH_DATE_WHEEL_ITEM,
    justifyContent: "center",
    borderRadius: radius.field,
    borderWidth: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.lg,
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
});
