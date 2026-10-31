import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { media } from "@/i18n/media";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import { VideoLibraryContent } from "@/screens/media/video-library";
import { useThemePreference } from "@/theme";

export default function CoachVideoLibraryRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemePreference();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoScreenHeader title={media.videosTitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
        <Text style={{ color: colors.inkMuted, marginBottom: 12 }}>{media.reviewOwner}</Text>
        <VideoLibraryContent
          onUpload={() => router.push("/video-analysis/upload" as Href)}
          onOpen={(videoId) => router.push(`/video-analysis/${videoId}` as Href)}
        />
      </ScrollView>
    </View>
  );
}
