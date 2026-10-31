import { Text } from "react-native";

import { media } from "@/i18n/media";
import { CoachScaffold } from "@/screens/coach/coach-ui";
import { useThemePreference } from "@/theme";

export default function CoachVideoReviewRoute() {
  const { colors } = useThemePreference();
  return (
    <CoachScaffold title="Duyệt bằng chứng" inStack>
      <Text style={{ color: colors.ink }}>{media.reviewOwner}</Text>
    </CoachScaffold>
  );
}
