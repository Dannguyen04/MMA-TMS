import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorRecoveryDetailRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.recovery} extra={blocked.clinicalWrite}>
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
