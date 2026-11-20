import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach/coach";
import { coachVideo as t } from "@/i18n/coach/coach-video";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { VideoUploadPage } from "@/screens/fighter/video/upload-v2";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { useState } from "react";
import { COACH_VIDEOS, coachVideoHref } from "./video-model";

/**
 * Coach Tải video (redesign step 19): the fighter's upload form (step 13) with the fighter on top. From a fighter page
 * the name is shown; from the Video list a fighter field opens the coach's fighters. A new video opens its page.
 */
export function CoachUploadScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const params = useLocalSearchParams<{ fighterId?: string }>();
  const fixed = typeof params.fighterId === "string" ? params.fighterId : "";
  const [chosen, setChosen] = useState("");
  const [fighters, reload] = useSource(() => coachApi.listFighters({ limit: 100 }).then(p => p.data), "cu|fighters");
  const list = fighters.state === "ok" ? fighters.data : [];
  const fixedFighter = fixed ? list.find(f => f.id === fixed) : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace(COACH_VIDEOS as never));
  const top = fixed
    ? <View testID="upload-fighter" style={{ gap: 2 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{fixedFighter ? fighterName(fixedFighter) : " "}</Text>
      <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{t.forFighter}</Text>
    </View>
    : <FighterPick testID="upload-pick-fighter" label={t.fighterField} placeholder={t.pickFighter} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
      state={fighters.state} fighters={list} value={chosen} onChange={setChosen} onRetry={reload}/>;
  return <VideoUploadPage testID="coach-upload" fighterId={fixed || chosen || null} top={top} needFighter={t.needFighter} onBack={back}
    onUploaded={id => router.replace(coachVideoHref(id))}/>;
}
