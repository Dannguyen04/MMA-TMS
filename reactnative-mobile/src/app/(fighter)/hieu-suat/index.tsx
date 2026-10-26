import { StyleSheet, Text, View } from "react-native";

import { FeatureUnavailable } from "@/components/feature-unavailable";
import { unavailable } from "@/i18n/unavailable";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub } from "@/screens/fighter/redesign/shell";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function FighterPerformanceRoute() {
  const colors = useFighterPalette();
  return (
    <FighterHub>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: colors.ink }]}>{"Hiệu suất"}</Text>
        <FeatureUnavailable icon="chart-line" description={unavailable.performance} />
      </View>
    </FighterHub>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: "700" },
});
