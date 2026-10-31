import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { fighterBout as t } from "@/i18n/fighter-bout";
import { SPEC, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterScreen } from "@/screens/fighter/screen";

/** Cách giảm cân an toàn: 3 ý ngắn + 1 dòng lưu ý cuối. Không số kg, không mẹo cắt nước. */
export function FighterGuideScreen() {
  const colors = useFighterPalette();
  return (
    <FighterScreen title={t.guide.title} onBack specLayout>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {t.guide.items.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="success" size={24} color={colors.link} />
            <Text style={[TEXT.body, styles.flex, { color: colors.ink }]}>{item}</Text>
          </View>
        ))}
      </View>
      <View accessibilityRole="alert" style={[styles.card, styles.notice, { backgroundColor: colors.surface, borderColor: colors.attention }]}>
        <View style={styles.row}>
          <Icon name="warning" size={24} color={colors.attention} />
          <Text style={[TEXT.bodyBold, styles.flex, { color: colors.ink }]}>{t.guide.closing}</Text>
        </View>
      </View>
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: SPEC.radius, padding: SPEC.card, gap: SPEC.gap },
  notice: { borderWidth: 2 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
