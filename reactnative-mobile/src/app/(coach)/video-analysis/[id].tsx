import { Redirect, useLocalSearchParams } from "expo-router";

import { coachVideoHref } from "@/screens/coach/video/video-model";

/** Old links to video-analysis/[id] land on the one coach video page (redesign step 19). */
export default function CoachVideoRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={coachVideoHref(typeof id === "string" ? id : "")} />;
}
