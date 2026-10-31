import { Text } from "react-native";

import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorRecoveryDetailRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorChrome title="Hồi phục">
      <Text style={[type.body, { color: colors.ink }]}>
        Không có GET /recovery-plans/:id. Kế hoạch đang mở nằm trong GET /fighters/:id/medical.
      </Text>
    </DoctorChrome>
  );
}
