import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAnalysisJob } from "@/api/video/media";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { fighterVideo as fv } from "@/i18n/fighter/fighter-video";
import { Action } from "@/shared/ui/camp-ui";
import { ev } from "@/i18n/video/video-evidence";
import { useThemePreference } from "@/theme";
import { evidenceError } from "@/screens/media/evidence/errors";
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
  const { colors: c } = useThemePreference();
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

  if (!videoId) {
    // Step 19: the waiting / error state in the page grammar (one line, then the link back to the list).
    return (
      <RolePage title={fv.title} onBack={back}>
        {jobId && !error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }} /> : null}
        {!jobId || error ? (
          <>
            <EmptyLine title={error || ev.noVideoId} />
            <Action label={ev.openVideoList} onPress={() => router.replace(listHref)} />
          </>
        ) : null}
      </RolePage>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <VideoDetailContent videoId={videoId} role={role} canRequestAnalysis={canRequestAnalysis} onBack={back} />
    </View>
  );
}
