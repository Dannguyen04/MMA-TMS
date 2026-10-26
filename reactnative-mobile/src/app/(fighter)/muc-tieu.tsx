import { Text, View } from "react-native";

import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub } from "@/screens/fighter/redesign/shell";

export default function FighterGoalsRoute() {
  const colors = useFighterPalette();
  return (
    <FighterHub>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "700" }}>Mục tiêu</Text>
        <Text style={{ color: colors.muted }}>{media.goalsMissing}</Text>
      </View>
    </FighterHub>
  );
}
