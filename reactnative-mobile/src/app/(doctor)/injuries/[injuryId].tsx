import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";

import { doctor } from "@/i18n/doctor";
import {
  DoctorChrome,
  DoctorPatientBar,
  FighterSwitchSheet,
  doctorMuted,
  doctorStyles,
} from "@/screens/doctor/doctor-chrome";
import { useSelectedFighter } from "@/screens/doctor/selected-fighter";
import { radius, spacing, type, useThemePreference } from "@/theme";

export default function DoctorInjuryDetailRoute() {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const router = useRouter();
  const { fighter } = useSelectedFighter();
  const [sheet, setSheet] = useState(false);

  return (
    <DoctorChrome title={doctor.injury.detailTitle} back>
      <FighterSwitchSheet visible={sheet} onClose={() => setSheet(false)} />
      <View style={doctorStyles.list}>
        {fighter ? <DoctorPatientBar onChange={() => setSheet(true)} /> : null}
        <Text style={[type.title, { color: colors.ink, textTransform: "none" }]}>
          {fighter ? doctor.injury.guidanceTitle : doctor.injury.pickTitle}
        </Text>
        <Text style={[type.body, { color: colors.ink }]}>
          {fighter ? doctor.injury.guidanceBody : doctor.injury.pickBody}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/(doctor)" as Href)}
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
          <Text style={[type.cta, { color: colors.onCta }]}>{doctor.injury.backToFighters}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/records" as Href)}
          style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[type.link, { color: colors.lotus }]}>{doctor.recovery.viewRecords}</Text>
        </Pressable>
        <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.field, padding: spacing.md, gap: 4 }}>
          <Text style={[type.label, { color: colors.ink }]}>{doctor.injury.guidanceTitle}</Text>
          <Text style={[type.caption, { color: muted }]}>{doctor.injury.guidanceBody}</Text>
        </View>
      </View>
    </DoctorChrome>
  );
}
