import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { COACH_VIDEO_PAGE } from "@/screens/coach/video/video-model";

/** Old `review?id=` / `review?jobId=` links land on the one coach video page (redesign step 19). */
export default function CoachVideoReviewRedirect() {
  const { id, jobId } = useLocalSearchParams<{ id?: string; jobId?: string }>();
  const params = id ? { id } : jobId ? { jobId } : {};
  return <Redirect href={{ pathname: COACH_VIDEO_PAGE, params } as unknown as Href} />;
}
