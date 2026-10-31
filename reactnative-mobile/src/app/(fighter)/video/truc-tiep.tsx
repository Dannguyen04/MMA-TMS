import { Text, View } from "react-native";

import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterStack } from "@/screens/fighter/redesign/shell";

export default function FighterLiveCheckRoute() {
  const colors = useFighterPalette();
  return (
    <FighterStack>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>Form trực tiếp</Text>
        <Text style={{ color: colors.muted }}>{media.liveMissing}</Text>
      </View>
    </FighterStack>
  );
}
