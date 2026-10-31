import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { medical } from "@/i18n/medical";
import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorInjuriesRoute() {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <DoctorChrome title={medical.injuries}>
      <Pressable onPress={() => router.push("/injuries/new" as Href)}>
        <Text style={[type.link, { color: colors.lotus }]}>Ghi chấn thương</Text>
      </Pressable>
    </DoctorChrome>
  );
}
