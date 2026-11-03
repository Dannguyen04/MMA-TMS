import { StyleSheet, Text, View } from "react-native";
import { fighter } from "@/i18n/fighter";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

/** T-048 10A: a PENDING session waits for the coach; the fighter has no start or complete action on it. */
export function PendingBadge() {
  const colors = useFighterPalette();
  return (
    <View accessible accessibilityLabel={`${fighter.sessionStatus.PENDING}. ${fighter.pendingLine}`} style={styles.row} testID="pending-badge">
      <View style={[styles.badge, { borderColor: colors.warning }]}>
        <Text style={[styles.badgeText, { color: colors.warning }]}>{fighter.sessionStatus.PENDING}</Text>
      </View>
      <Text style={[styles.line, { color: colors.muted }]}>{fighter.pendingLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  line: { fontSize: 13, flexShrink: 1 },
});
