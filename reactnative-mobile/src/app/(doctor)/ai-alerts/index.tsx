import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage, DoctorNavLink } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorAiAlertsRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.aiAlerts} extra={blocked.relatedJobs}>
      <DoctorNavLink href="/ai-alerts/xem" label="Chi tiết cảnh báo (giữ chỗ)" />
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>
          GET /jobs/impairments tồn tại nhưng không AccessTokenGuard. App không gọi.
        </Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
