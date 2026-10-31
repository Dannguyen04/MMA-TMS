import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { medical } from "@/i18n/medical";
import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorRecoveryRoute() {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <DoctorChrome title={medical.recoveryPlans}>
      <Pressable onPress={() => router.push("/recovery/new" as Href)}>
        <Text style={[type.link, { color: colors.lotus }]}>Kế hoạch từ chấn thương có sẵn</Text>
      </Pressable>
    </DoctorChrome>
  );
}
