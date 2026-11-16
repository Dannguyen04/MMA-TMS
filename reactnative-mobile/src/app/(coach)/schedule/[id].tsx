import { Redirect, useLocalSearchParams } from "expo-router";

import { coachSessionHref } from "@/screens/coach/schedule/session-model";

/** Old links to schedule/[id] land on the one session page (redesign step 18). */
export default function CoachSessionRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={coachSessionHref(typeof id === "string" ? id : "")} />;
}
