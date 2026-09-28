import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage, DoctorNavLink } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorRecoveryRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.recovery} extra={blocked.clinicalWrite}>
      <DoctorNavLink href="/recovery/new" label="Kế hoạch hồi phục mới" />
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
