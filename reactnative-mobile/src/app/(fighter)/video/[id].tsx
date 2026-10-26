import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { VideoDetailContent } from "@/screens/media/video-detail";

export default function FighterVideoDetailRoute() {
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoId = typeof id === "string" ? id : "";
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {videoId ? (
        <VideoDetailContent videoId={videoId} canRequestAnalysis onBack={() => router.back()} />
      ) : null}
    </View>
  );
}
