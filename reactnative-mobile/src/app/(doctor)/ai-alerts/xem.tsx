import { Text } from "react-native";

import { media } from "@/i18n/media";
import { DoctorChrome } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export default function DoctorAiAlertLegacyRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorChrome title={media.alertDetailTitle}>
      <Text style={[type.body, { color: colors.ink }]}>
        Mở một cảnh báo từ danh sách. GET /jobs/impairments trả job mà bác sĩ đang phụ trách được xem.
      </Text>
    </DoctorChrome>
  );
}
