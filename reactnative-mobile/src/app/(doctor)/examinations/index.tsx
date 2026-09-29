import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage, DoctorNavLink } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorExamsRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.exams} extra={blocked.clinicalWrite}>
      <DoctorNavLink href="/examinations/new" label={blocked.newExam} />
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
