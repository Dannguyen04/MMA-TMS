import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { medical } from "@/i18n/medical";
import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorClearanceRoute() {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <DoctorChrome title={medical.clearances}>
      <Pressable onPress={() => router.push("/clearance/new" as Href)}>
        <Text style={[type.link, { color: colors.lotus }]}>Cấp giấy từ lần khám đã lưu</Text>
      </Pressable>
    </DoctorChrome>
  );
}
