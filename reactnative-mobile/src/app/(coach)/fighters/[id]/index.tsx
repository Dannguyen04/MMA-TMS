import { Redirect, useLocalSearchParams } from "expo-router";

import { coachFighterHref } from "@/screens/coach/fighters/fighter-model";

/** Old address of the fighter page (merged in redesign step 16): opens the one fighter page. */
export default function CoachFighterIdRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={coachFighterHref(String(id ?? ""))}/>;
}
