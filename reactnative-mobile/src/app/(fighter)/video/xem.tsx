import { Text, View } from "react-native";

import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterStack } from "@/screens/fighter/redesign/shell";

export default function FighterVideoReviewRoute() {
  const colors = useFighterPalette();
  return (
    <FighterStack>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>Duyệt bằng chứng</Text>
        <Text style={{ color: colors.muted }}>{media.reviewOwner}</Text>
      </View>
    </FighterStack>
  );
}
