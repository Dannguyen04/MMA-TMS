import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoDetailContent } from "@/screens/media/video-detail";
import { useThemePreference } from "@/theme";

export default function CoachVideoDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoId = typeof id === "string" ? id : "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemePreference();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      {videoId ? (
        <VideoDetailContent videoId={videoId} canRequestAnalysis onBack={() => router.back()} />
      ) : null}
    </View>
  );
}
