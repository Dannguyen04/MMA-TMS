import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import type { VideoRecord } from "@/api/media";
import { coachRo } from "@/i18n/coach-ro";
import { media } from "@/i18n/media";
import { vai } from "@/i18n/video-ai";
import { DetailTabs } from "@/screens/doctor/detail/detail-ui";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useAiEnabled, useAiNames, useJobs, useVideoTitles } from "@/screens/video-ai/ai-data";
import { AiJobList } from "@/screens/video-ai/ai-job-list";
import { AiVideoLibrary } from "@/screens/video-ai/ai-video-library";

import { vnDate } from "../readonly/ro-format";
import { RoScreen } from "../readonly/ro-ui";

export const COACH_VIDEO_DETAIL_PATH = "/(coach)/video-analysis/chi-tiet";
const trainingLabels = media.training as Record<string, string>;

/** Chữ loại tập; mã lạ thì không hiện (không lộ mã thô). */
export function trainingText(code: string): string {
  return trainingLabels[code] ?? "";
}

/** Dòng phụ của một video: tên võ sĩ, loại tập, ngày. */
export function videoLines(v: Pick<VideoRecord, "fighterId" | "trainingType" | "createdAt">, names: Record<string, string>): string[] {
  return [names[v.fighterId] ?? "", [trainingText(v.trainingType), vnDate(v.createdAt)].filter(Boolean).join(" · ")].filter(Boolean);
}

type Seg = "library" | "review";

/** Tab Video của HLV: Thư viện | Cần duyệt (badge = số job chờ HLV duyệt). */
export function CoachVideosScreen() {
  const params = useLocalSearchParams<{ fighterId?: string; seg?: string; t?: string }>();
  const enabled = useAiEnabled();
  const p = useFighterPalette();
  const names = useAiNames(enabled);
  const jobs = useJobs(enabled, true);
  const titles = useVideoTitles(enabled);
  const [seg, setSeg] = useState<Seg>("library");
  const [fighterId, setFighterId] = useState("");
  const libRefresh = useRef<(() => Promise<unknown>) | null>(null);

  // "Xem tất cả" từ chi tiết võ sĩ mở tab này với võ sĩ đặt sẵn (và phân đoạn tương ứng).
  useEffect(() => {
    if (typeof params.fighterId === "string") setFighterId(params.fighterId);
    if (params.seg === "review" || params.seg === "library") setSeg(params.seg);
  }, [params.fighterId, params.seg, params.t]);

  const pending = jobs.data?.pending.size ?? 0;
  const refresh = () => Promise.all([jobs.refresh(), titles.refresh(), seg === "library" ? libRefresh.current?.() : null]);

  return (
    <RoScreen title={coachRo.nav.videoTitle} onRefresh={refresh} refreshing={false} stickyHeaderIndices={[0]}>
      <View style={{ backgroundColor: p.bg, marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8, marginVertical: -8 }}>
        <DetailTabs
          value={seg}
          onChange={setSeg}
          tabs={[
            { key: "library", label: vai.segLibrary },
            { key: "review", label: vai.segReview, badge: pending, a11y: vai.segReviewA11y(pending) },
          ]}
        />
      </View>
      <View>
        {seg === "library" ? (
          <AiVideoLibrary
            enabled={enabled}
            names={names}
            jobs={jobs.data?.jobs ?? []}
            fighterId={fighterId}
            onFighter={setFighterId}
            bindRefresh={(fn) => {
              libRefresh.current = fn;
            }}
          />
        ) : (
          <AiJobList load={jobs} names={names} titles={titles.data ?? {}} fighterId={fighterId || undefined} onClearFighter={() => setFighterId("")} />
        )}
      </View>
    </RoScreen>
  );
}
