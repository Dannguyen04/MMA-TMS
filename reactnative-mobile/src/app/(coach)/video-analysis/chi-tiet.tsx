import { Stack, useLocalSearchParams } from "expo-router";

import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";
import { COACH_VIDEOS } from "@/screens/coach/video/video-model";

/**
 * The one coach video page (redesign step 19): `chi-tiet?id=<videoId>` (or `?job=<jobId>` when only the job is known).
 * Old `[id]` and `review` links redirect here.
 */
export default function CoachVideoPageRoute() {
  const params = useLocalSearchParams<{ id?: string; job?: string; jobId?: string }>();
  const jobId = params.jobId || params.job;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EvidenceRoute role="coach" params={{ id: params.id, jobId }} listHref={COACH_VIDEOS as never} canRequestAnalysis />
    </>
  );
}
