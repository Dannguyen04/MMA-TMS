import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { media } from "@/i18n/media";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import { VideoLibraryContent } from "@/screens/media/video-library";
import { useThemePreference } from "@/theme";

export default function CoachFighterVideosRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fighterId = typeof id === "string" ? id : "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemePreference();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoScreenHeader title={media.videosTitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
        {fighterId ? (
          <VideoLibraryContent
            fighterId={fighterId}
            onUpload={() => router.push(`/video-analysis/upload?fighterId=${fighterId}` as Href)}
            onOpen={(videoId) => router.push(`/video-analysis/${videoId}` as Href)}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
