import { Text, View } from "react-native";

import { doctorRest as t } from "@/i18n/doctor/doctor-rest";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

/** Disclaimer under AI results, one sentence per line (redesign step 21). */
export function DoctorAiDisclaimer() {
  const { colors: c } = useThemePreference();
  return <View testID="doctor-ai-disclaimer" style={{ gap: 2 }}>{t.disclaimer.map((s) => <Text key={s} style={{ ...readableTextStyle(14), color: c.ink }}>{s}</Text>)}</View>;
}
