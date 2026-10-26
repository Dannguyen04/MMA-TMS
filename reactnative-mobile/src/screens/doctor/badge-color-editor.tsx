import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SlideSheet, SheetOption } from "@/components/ui/slide-sheet";
import { HexField, SwatchRow } from "@/screens/appearance/controls";
import { radius, spacing, type, useThemePreference } from "@/theme";

import {
  BADGE_GROUPS,
  defaultBadgeColor,
  useBadgeOverrides,
  useResetBadgeColors,
  useSetBadgeColor,
  type BadgeGroup,
  type BadgeId,
} from "./badge-colors";

const SWATCHES = ["#16A34A", "#0284C7", "#CA8A04", "#DC2626", "#71717A", "#FF8066", "#22C55E", "#38BDF8", "#EAB308", "#EF4444"];

export function BadgeColorEditor() {
  const { colors, resolvedScheme } = useThemePreference();
  const scheme = resolvedScheme === "light" ? "light" : "dark";
  const overrides = useBadgeOverrides();
  const setColor = useSetBadgeColor();
  const reset = useResetBadgeColors();
  const [group, setGroup] = useState<BadgeGroup | null>(null);
  const [editing, setEditing] = useState<BadgeId | null>(null);

  const editingItem = group?.items.find((item) => item.id === editing) ?? null;
  const editingValue = editingItem
    ? overrides[editingItem.id] ?? defaultBadgeColor(editingItem.id, scheme)
    : "#71717A";

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[type.body, { color: colors.ink, flex: 1 }]}>Màu huy hiệu</Text>
        <Pressable
          accessibilityRole="button"
          onPress={reset}
          style={({ pressed }) => [styles.reset, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[type.link, { color: colors.lotus }]}>Mặc định</Text>
        </Pressable>
      </View>
      <Text style={[type.caption, { color: colors.ink }]}>
        Màu chữ trên huy hiệu của bác sĩ. Lưu trên thiết bị này.
      </Text>
      {BADGE_GROUPS.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => {
            setEditing(null);
            setGroup(item);
          }}
          style={({ pressed }) => [
            styles.row,
            {
              borderColor: colors.line,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[type.body, { color: colors.ink, flex: 1 }]}>{item.label}</Text>
          <View style={styles.dots}>
            {item.items.slice(0, 4).map((badge) => (
              <View
                key={badge.id}
                style={[
                  styles.dot,
                  { backgroundColor: overrides[badge.id] ?? defaultBadgeColor(badge.id, scheme) },
                ]}
              />
            ))}
          </View>
        </Pressable>
      ))}
      <SlideSheet
        visible={group != null && editing == null}
        onClose={() => setGroup(null)}
        title={group?.label ?? "Màu huy hiệu"}
      >
        {group?.items.map((item) => (
          <SheetOption
            key={item.id}
            label={item.label}
            selected={overrides[item.id] != null}
            onPress={() => setEditing(item.id)}
          />
        ))}
      </SlideSheet>
      <SlideSheet
        visible={editingItem != null}
        onClose={() => setEditing(null)}
        title={editingItem?.label ?? "Màu"}
      >
        {editingItem ? (
          <View style={styles.picker}>
            <SwatchRow
              label={editingItem.label}
              swatches={SWATCHES}
              value={overrides[editingItem.id] ?? null}
              onChange={(hex) => setColor(editingItem.id, hex)}
            />
            <HexField
              value={editingValue}
              onCommit={(hex) => setColor(editingItem.id, hex)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setColor(editingItem.id, null)}
              style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[type.link, { color: colors.lotus }]}>Dùng màu gốc</Text>
            </Pressable>
          </View>
        ) : null}
      </SlideSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center" },
  reset: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  row: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  picker: { gap: spacing.md, paddingBottom: spacing.lg },
});
