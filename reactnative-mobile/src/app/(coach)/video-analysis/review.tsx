import { Stack, useLocalSearchParams } from "expo-router";

import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";

/** `/video-analysis/review?id=<videoId>` — video, khung xương, duyệt bằng chứng. */
export default function CoachVideoReviewRoute() {
  const params = useLocalSearchParams<{ id?: string; jobId?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EvidenceRoute role="coach" params={params} listHref="/video-analysis" canRequestAnalysis />
    </>
  );
}
