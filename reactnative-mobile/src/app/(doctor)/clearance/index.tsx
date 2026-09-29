import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage, DoctorNavLink } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorClearanceRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.clearance} extra={blocked.clearanceRead}>
      <DoctorNavLink href="/clearance/new" label={blocked.grantClearance} />
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>
          Đọc: GET /fighters/:id/medical-summary trên tab Y tế. Ghi giấy phép: chưa có POST.
        </Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
