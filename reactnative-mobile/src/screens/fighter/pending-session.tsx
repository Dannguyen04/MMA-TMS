import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { fighter } from "@/i18n/fighter";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { fz, lh, liveSheet } from "@/theme/typography";

/** T-048 10A: a PENDING session waits for the coach; the fighter has no start or complete action on it. */
export function PendingBadge() {
  const colors = useFighterPalette();
  return (
    <View accessible accessibilityLabel={`${fighter.sessionStatus.PENDING}. ${fighter.pendingLine}`} style={styles.row} testID="pending-badge">
      <View style={styles.badge}>
        <Icon name="history" size={15} color={colors.warning} />
        <Text style={[styles.badgeText, { color: colors.warning }]}>{fighter.sessionStatus.PENDING}</Text>
      </View>
      <Text style={[styles.line, { color: colors.muted }]}>{fighter.pendingLine}</Text>
    </View>
  );
}

const styles = liveSheet(() => ({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontSize: fz(13), lineHeight: lh(18), fontWeight: "700" },
  line: { fontSize: fz(13), lineHeight: lh(18), flexShrink: 1 },
}));
