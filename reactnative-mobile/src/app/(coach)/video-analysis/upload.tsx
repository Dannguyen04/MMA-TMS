import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoUploadContent } from "@/screens/media/video-upload";
import { useThemePreference } from "@/theme";

export default function CoachVideoUploadRoute() {
  const params = useLocalSearchParams<{ fighterId?: string }>();
  const fighterId = typeof params.fighterId === "string" ? params.fighterId : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemePreference();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoUploadContent
        fighterId={fighterId}
        onBack={() => router.back()}
        onUploaded={(id) => router.replace(`/video-analysis/${id}` as Href)}
      />
    </View>
  );
}
