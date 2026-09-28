import { Text } from "react-native";

import { blocked } from "@/i18n/blocked";
import { GlassCard } from "@/screens/fighter/screen";
import { BlockedFighterPage } from "@/screens/parity/blocked-workspace";
import { type, useThemePreference } from "@/theme";

export default function FighterLiveRoute() {
  const { colors } = useThemePreference();
  return (
    <BlockedFighterPage title={blocked.liveCheck} extra={blocked.live}>
      <GlassCard>
        <Text style={[type.body, { color: colors.inkMuted }]}>
          Khung camera giữ chỗ. Không bật camera vì chưa có hợp đồng realtime trên nestjs-api.
        </Text>
      </GlassCard>
    </BlockedFighterPage>
  );
}
