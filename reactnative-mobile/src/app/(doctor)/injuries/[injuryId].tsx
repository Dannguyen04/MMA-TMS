import { Text } from "react-native";

import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorInjuryDetailRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorChrome title="Chấn thương">
      <Text style={[type.body, { color: colors.ink }]}>
        Không có GET /injuries/:id. Chấn thương đang mở nằm trong GET /fighters/:id/medical.
      </Text>
    </DoctorChrome>
  );
}
