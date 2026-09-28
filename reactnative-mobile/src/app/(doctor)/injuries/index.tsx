import { blocked } from "@/i18n/blocked";
import { DoctorBlockedCard, DoctorBlockedPage, DoctorNavLink } from "@/screens/doctor/blocked-page";
import { Text } from "react-native";
import { type, useThemePreference } from "@/theme";

export default function DoctorInjuriesRoute() {
  const { colors } = useThemePreference();
  return (
    <DoctorBlockedPage title={blocked.injury} extra={blocked.clinicalWrite}>
      <DoctorNavLink href="/injuries/new" label={blocked.newInjury} />
      <DoctorBlockedCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
      </DoctorBlockedCard>
    </DoctorBlockedPage>
  );
}
