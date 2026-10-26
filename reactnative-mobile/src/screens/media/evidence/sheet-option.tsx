import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useFighterPalette } from "@/screens/fighter/redesign/palette";

/** One selectable row inside a BottomSheet. `kind="check"` toggles, `kind="radio"` picks one. */
export function SheetOption({
  label,
  detail,
  selected,
  kind = "radio",
  onPress,
  testID,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  kind?: "radio" | "check";
  onPress: () => void;
  testID?: string;
}) {
  const c = useFighterPalette();
  const icon =
    kind === "check" ? (selected ? "checkbox" : "square-outline") : selected ? "radio-button-on" : "radio-button-off";
  return (
    <Pressable
      testID={testID}
      accessibilityRole={kind === "check" ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.copy}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: selected ? "700" : "500" }}>{label}</Text>
        {detail ? <Text style={{ color: c.muted, fontSize: 13 }}>{detail}</Text> : null}
      </View>
      <Ionicons name={icon} size={22} color={selected ? c.accent : c.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  copy: { flex: 1, gap: 2 },
});
