import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { doctor } from "@/i18n/doctor";
import {
  DoctorChrome,
  DoctorPatientBar,
  FighterSwitchSheet,
  doctorStyles,
} from "@/screens/doctor/doctor-chrome";
import { useSelectedFighter } from "@/screens/doctor/selected-fighter";
import { radius, type, useThemePreference } from "@/theme";

export default function DoctorRecoveryDetailRoute() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { fighter } = useSelectedFighter();
  const [sheet, setSheet] = useState(false);

  return (
    <DoctorChrome title={doctor.recovery.detailTitle} back>
      <FighterSwitchSheet visible={sheet} onClose={() => setSheet(false)} />
      <View style={doctorStyles.list}>
        {fighter ? <DoctorPatientBar onChange={() => setSheet(true)} /> : null}
        <Text style={[type.title, { color: colors.ink, textTransform: "none" }]}>
          {fighter ? doctor.recovery.detailHeading : doctor.injury.pickTitle}
        </Text>
        <Text style={[type.body, { color: colors.ink }]}>
          {fighter ? doctor.recovery.detailBody : doctor.injury.pickBody}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => (fighter ? router.push("/records" as Href) : router.navigate("/(doctor)" as Href))}
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
          <Text style={[type.cta, { color: colors.onCta }]}>
            {fighter ? doctor.recovery.viewRecords : doctor.injury.backToFighters}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/(doctor)" as Href)}
          style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[type.link, { color: colors.lotus }]}>{doctor.injury.backToFighters}</Text>
        </Pressable>
      </View>
    </DoctorChrome>
  );
}
