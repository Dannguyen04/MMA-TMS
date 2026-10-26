import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appearance } from "@/i18n/appearance";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterStack } from "@/screens/fighter/redesign/shell";
import { useAppearanceState, useTypography } from "@/theme";
import { titleTextStyle } from "@/theme/typography";

export function FighterSettingsScreen() {
  const colors = useFighterPalette();
  const { applied } = useAppearanceState();
  const titleStyle = titleTextStyle(useTypography());
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const summary = `${appearance.presets[applied.presetId]} · ${appearance.modes[applied.settings.mode]}`;

  return (
    <FighterStack
      footer={
        <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Text style={[styles.note, { color: colors.muted }]}>Thông báo chưa lưu được trên điện thoại.</Text>
          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel="Lưu, sắp có"
            style={[styles.save, { backgroundColor: colors.surface2 }]}
          >
            <MaterialCommunityIcons name="lock-outline" size={15} color={colors.muted} />
            <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Lưu (sắp có)</Text>
          </View>
        </View>
      }
    >
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, titleStyle, { color: colors.ink, textTransform: "none", flexShrink: 1 }]}
        >
          Cài đặt
        </Text>
      </View>
      <View style={styles.pad}>
        <View style={[styles.notice, { backgroundColor: colors.surface2 }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.ink} />
          <View style={styles.flex}>
            <Text style={[styles.noticeTitle, { color: colors.ink }]}>Giao diện lưu trên điện thoại</Text>
            <Text style={[styles.noticeBody, { color: colors.muted }]}>
              Chủ đề, màu nhấn và cỡ chữ được ghi trên máy này, không đồng bộ lên máy chủ. Thông báo vẫn chưa lưu được.
            </Text>
          </View>
        </View>

        <Text style={[styles.kicker, { color: colors.muted }]}>CÁ NHÂN HÓA</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Giao diện. Chủ đề, màu nhấn và kiểu chữ."
          onPress={() => router.push("/giao-dien" as Href)}
          style={[styles.entry, { borderBottomColor: colors.line }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="palette-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.entryTitle, { color: colors.ink }]}>Giao diện</Text>
            <Text style={[styles.noticeBody, { color: colors.muted }]}>Chủ đề, màu nhấn và kiểu chữ.</Text>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
              {summary}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
        </Pressable>

        <View style={styles.rowBetween}>
          <Text style={[styles.kicker, { color: colors.muted }]}>THÔNG BÁO</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Sắp có</Text>
        </View>
        <View style={[styles.phone, { borderBottomColor: colors.line }]}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={colors.muted} />
          <View style={styles.flex}>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>Thông báo trên điện thoại</Text>
            <Text style={[styles.noticeBody, { color: colors.muted }]}>Chưa khả dụng trên thiết bị này</Text>
          </View>
          <View
            accessibilityRole="switch"
            accessibilityState={{ disabled: true, checked: false }}
            accessibilityLabel="Thông báo trên điện thoại, chưa khả dụng"
            style={[styles.sw, { backgroundColor: colors.disabled }]}
          >
            <View style={[styles.knob, { backgroundColor: colors.muted }]} />
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Kênh thông báo</Text>
        <View style={styles.channels}>
          <Channel icon="email-outline" label="Email" />
          <Channel icon="cellphone" label="Push" />
        </View>
        <Text style={[styles.noticeBody, { color: colors.muted }]}>Tùy chọn email / push sẽ được mở sau.</Text>
      </View>
    </FighterStack>
  );
}

function Channel({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  const colors = useFighterPalette();
  return (
    <View
      accessibilityLabel={`${label}, sắp có`}
      style={[styles.channel, { borderColor: colors.line }]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.muted} />
      <Text style={{ flex: 1, color: colors.muted, fontSize: 14 }}>{label}</Text>
      <MaterialCommunityIcons name="lock-outline" size={14} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  back: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700" },
  pad: { paddingHorizontal: 20, paddingTop: 12, gap: 16, paddingBottom: 24 },
  notice: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 12 },
  flex: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: 14, fontWeight: "600" },
  noticeBody: { fontSize: 13, lineHeight: 19 },
  kicker: { fontSize: 12, fontWeight: "700" },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  entryTitle: { fontSize: 16, fontWeight: "600" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  phone: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sw: { width: 44, height: 26, borderRadius: 13, justifyContent: "center", paddingHorizontal: 3 },
  knob: { width: 20, height: 20, borderRadius: 10 },
  channels: { flexDirection: "row", gap: 10 },
  channel: { flex: 1, height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 20, gap: 8 },
  note: { fontSize: 12, textAlign: "center" },
  save: { height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
});
