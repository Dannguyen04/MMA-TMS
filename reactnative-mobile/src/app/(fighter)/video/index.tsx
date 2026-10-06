import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { media } from "@/i18n/media";
import { fighter } from "@/i18n/fighter";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub } from "@/screens/fighter/redesign/shell";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import { VideoLibraryContent } from "@/screens/media/video-library";

export default function FighterVideosRoute() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, canFetch, isDemo } = useFighterId();

  return (
    <FighterHub>
      <VideoScreenHeader title={media.videosTitle} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {isDemo || !canFetch || !fighterId ? (
          <Text style={{ color: colors.muted }}>{fighter.common.demoHint}</Text>
        ) : (
          <VideoLibraryContent
            fighterId={fighterId}
            onUpload={() => router.push("/video/tai-len" as Href)}
            onOpen={(id) => router.push(`/video/${id}` as Href)}
          />
        )}
      </View>
    </FighterHub>
  );
}
