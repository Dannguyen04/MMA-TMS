import { Text, View } from "react-native";
import { StaggerList } from "@/components/motion/motion";
import { useRouter } from "expo-router";

import { fighterTran as t } from "@/i18n/fighter/fighter-tran";
import { CampShell } from "@/shared/ui/camp-ui";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { backToTran } from "./bout-model";

/** Cách giảm cân an toàn (redesign step 12): three tips, one sentence per line, then the warning in red. */
export function FighterGuideV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  return <CampShell title={t.guide.title} onBack={() => backToTran(router)}>
    <StaggerList testID="guide-v2">
      {t.guide.items.map((item, k) => <View key={k} style={{ flexDirection: "row", gap: 12, alignItems: "baseline", paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1 }}>
        <Text aria-hidden={true} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(20), lineHeight: lh(22), color: c.success, width: 22 }}>✓</Text>
        <Text style={{ ...readableTextStyle(15.5), color: c.ink, flex: 1 }}>{item}</Text>
      </View>)}
    </StaggerList>
    <Text accessibilityRole="alert" style={{ ...readableTextStyle(15.5, true), color: c.danger }}>{t.guide.closing}</Text>
  </CampShell>;
}
