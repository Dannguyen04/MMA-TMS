import { Redirect, useLocalSearchParams } from "expo-router";

import { coachPlanHref } from "@/screens/coach/plans/plan-model";

/** Old address of the editable plan page (merged in redesign step 17): opens the one plan page. */
export default function CoachPlanIdRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={coachPlanHref(String(id ?? ""))}/>;
}
