import { Redirect, useLocalSearchParams } from "expo-router";

import { coachFighterHref } from "@/screens/coach/fighters/fighter-model";

/** Old address of the coach medical page (merged in redesign step 16): opens the fighter page on Y tế. */
export default function CoachFighterMedicalRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={coachFighterHref(String(id ?? ""), "medical")}/>;
}
