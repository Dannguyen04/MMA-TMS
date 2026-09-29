import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorExamDetailRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.exams} extra={blocked.clinicalWrite}>
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
