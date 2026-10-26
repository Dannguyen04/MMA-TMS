import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAnalysisJob } from "@/api/media";
import { SkeletonCards } from "@/components/loading";
import { ev } from "@/i18n/video-evidence";
import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { evidenceError } from "@/screens/media/evidence/errors";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import { VideoDetailContent, type EvidenceRole } from "@/screens/media/video-detail";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Query entry for the shared video/evidence screen: `?id=<videoId>` or `?jobId=<jobId>`
 * (doctor alerts know the job, not the video). Used by non-bracket routes only.
 */
export function EvidenceRoute({
  role,
  params,
  listHref,
  canRequestAnalysis,
}: {
  role: EvidenceRole;
  params: { id?: string | string[]; jobId?: string | string[] };
  listHref: Href;
  canRequestAnalysis: boolean;
}) {
  const c = useFighterPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const directId = first(params.id);
  const jobId = first(params.jobId);
  const [videoId, setVideoId] = useState(directId);
  const [error, setError] = useState("");

  useEffect(() => {
    setVideoId(directId);
    setError("");
    if (directId || !jobId) return;
    let cancelled = false;
    void getAnalysisJob(jobId)
      .then((job) => {
        if (cancelled) return;
        if (job.videoId) setVideoId(job.videoId);
        else setError(ev.errors.notFound);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(evidenceError(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [directId, jobId]);

  const back = () => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) router.back();
    else router.replace(listHref);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {videoId ? (
        <VideoDetailContent videoId={videoId} role={role} canRequestAnalysis={canRequestAnalysis} onBack={back} />
      ) : (
        <>
          <VideoScreenHeader title={media.detailTitle} onBack={back} />
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {jobId && !error ? <SkeletonCards count={1} lines={3} /> : null}
            {!jobId || error ? (
              <>
                <Text style={{ color: c.ink, fontSize: 15 }}>{error || ev.noVideoId}</Text>
                <Pressable accessibilityRole="button" onPress={() => router.replace(listHref)} hitSlop={8}>
                  <Text style={{ color: c.accent, fontWeight: "700" }}>{ev.openVideoList}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}
