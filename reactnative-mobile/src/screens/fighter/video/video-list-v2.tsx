import { useCallback, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { listAnalysisJobs, listVideos } from "@/api/media";
import { StaggerList } from "@/components/motion";
import { fighterVideo as t } from "@/i18n/fighter-video";
import { videoTitle } from "@/i18n/server-text";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { Action, CampShell } from "@/screens/fight-camp/camp-ui";
import { backToMe } from "@/screens/fighter/me/me-model";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { jobForVideo } from "@/screens/media/video-model";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { rowView, UPLOAD, videoHref } from "./video-v2-model";

async function loadVideos(fighterId: string | null, canFetch: boolean) {
  if (!canFetch || !fighterId) return null;
  const [page, jobs] = await Promise.all([listVideos({ fighterId, limit: 50 }), listAnalysisJobs()]);
  return page.items.map(video => ({ video, job: jobForVideo(jobs, video.id) }));
}

/** Video (redesign step 13): the lit upload button, then one row per video, newest first. */
export function FighterVideosV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { fighterId, canFetch } = useFighterId();
  const [src, reload, refresh] = useSource(() => loadVideos(fighterId, canFetch), `${fighterId}-${canFetch}`);
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) { first.current = false; return; } void refresh(); }, [refresh]));

  const rows = src.state === "ok" ? src.data : null;
  return <CampShell title={t.title} onBack={() => backToMe(router)} onRefresh={refresh}>
    <View testID="fighter-videos-v2" style={{ gap: 18 }}>
      {canFetch ? <Action label={t.upload} onPress={() => router.push(UPLOAD)}/> : null}
      {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
      {src.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
      {src.state === "ok" && rows === null ? <Text style={{ ...readableTextStyle(15.5), color: c.ink }}>{t.demo}</Text> : null}
      {rows && rows.length === 0 ? <Text testID="videos-empty" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(26), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.empty}</Text> : null}
      {rows && rows.length ? <StaggerList testID="videos-list">
        {rows.map(({ video, job }, k) => {
          const v = rowView(video, job);
          const title = videoTitle(video.title);
          return <SlipRow key={video.id} testID={`video-row-${video.id}`} lead={v.lead} leadTone={v.leadTone} icon={v.kind === "wait" ? "history" : undefined}
            title={title} word={v.word} wordTone={v.lineTone} line={v.rest} a11y={t.rowA11y(title, v.line, v.score)}
            onPress={() => router.push(videoHref(video.id))} last={k === rows.length - 1}/>;
        })}
      </StaggerList> : null}
    </View>
  </CampShell>;
}
