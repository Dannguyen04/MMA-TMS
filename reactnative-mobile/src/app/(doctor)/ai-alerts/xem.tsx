import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { doctor } from "@/i18n/doctor";
import { media } from "@/i18n/media";
import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";
import { DoctorChrome, doctorMuted, doctorStyles } from "@/screens/doctor/doctor-chrome";
import { radius, spacing, type, useThemePreference } from "@/theme";

/** `/ai-alerts/xem?jobId=…` (hoặc `?id=<videoId>`): video, khung xương, đoạn bằng chứng. Không có tham số: trang cũ. */
export default function DoctorAiAlertLegacyRoute() {
  const params = useLocalSearchParams<{ id?: string; jobId?: string }>();
  if (params.id || params.jobId) {
    return <EvidenceRoute role="doctor" params={params} listHref={"/(doctor)/ai-alerts" as Href} canRequestAnalysis={false} />;
  }
  return <LegacyNotice />;
}

function LegacyNotice() {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const router = useRouter();
  return (
    <DoctorChrome title={media.alertsTitle} back>
      <View style={[doctorStyles.list, { paddingTop: spacing.xl, gap: spacing.lg }]}>
        <Text style={[type.title, { color: colors.ink, textTransform: "none" }]}>{doctor.ai.legacyTitle}</Text>
        <Text style={[type.body, { color: colors.ink }]}>{doctor.ai.legacyBody}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/(doctor)/ai-alerts" as Href)}
          style={({ pressed }) => [
            {
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.field,
              backgroundColor: colors.cta,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[type.cta, { color: colors.onCta }]}>{doctor.ai.legacyAction}</Text>
        </Pressable>
        <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.field, padding: spacing.md, gap: 4 }}>
          <Text style={[type.label, { color: colors.ink }]}>{doctor.ai.accountTitle}</Text>
          <Text style={[type.caption, { color: muted }]}>{doctor.ai.accountBody}</Text>
        </View>
        <Text style={[type.caption, { color: muted }]}>{doctor.ai.notDiagnosis}</Text>
      </View>
    </DoctorChrome>
  );
}
