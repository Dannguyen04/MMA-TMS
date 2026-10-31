import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useTypography } from "@/theme";

export function VideoScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const colors = useFighterPalette();
  const live = useTypography();
  const fontSize = Math.round(24 * live.sizeFactor * 10) / 10;
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={media.back}
        onPress={onBack}
        style={[styles.back, { backgroundColor: colors.surface2 }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          color: colors.ink,
          fontFamily: live.faces.bold,
          fontSize,
          lineHeight: Math.ceil(fontSize * 1.2),
        }}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
});
