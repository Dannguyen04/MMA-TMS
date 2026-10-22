import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { VideoUploadContent } from "@/screens/media/video-upload";
import { useFighterId } from "@/screens/fighter/use-fighter-id";

export default function FighterUploadRoute() {
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <VideoUploadContent
        fighterId={canFetch ? fighterId : null}
        onBack={() => router.back()}
        onUploaded={(id) => router.replace(`/video/${id}` as Href)}
      />
    </View>
  );
}
