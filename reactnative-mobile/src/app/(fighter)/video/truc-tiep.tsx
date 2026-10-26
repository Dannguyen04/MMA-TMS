import { StyleSheet, Text, View } from "react-native";

import { FeatureUnavailable } from "@/components/feature-unavailable";
import { unavailable } from "@/i18n/unavailable";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterStack } from "@/screens/fighter/redesign/shell";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function FighterLiveCheckRoute() {
  const colors = useFighterPalette();
  return (
    <FighterStack>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: colors.ink }]}>{"Form trực tiếp"}</Text>
        <FeatureUnavailable icon="video-outline" description={unavailable.live} />
      </View>
    </FighterStack>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
});
