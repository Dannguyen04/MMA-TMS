import { Redirect, useLocalSearchParams } from "expo-router";

import { useSelectedFighter } from "@/screens/doctor/selected-fighter";

import { doctorFighterHref, examHref, type DoctorFighterTab } from "./exam-model";

/**
 * Old doctor clinical routes (medical, clearance, injuries, recovery, records, examinations) — redesign step 20.
 * They go to the fighter page on the matching tab for the fighter picked in the old flow, else to the Võ sĩ list.
 */
export function DoctorOldRoute({ tab = "overview", exam = false }: { tab?: DoctorFighterTab; exam?: boolean }) {
  const { fighter } = useSelectedFighter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  if (!fighter) return <Redirect href={"/(doctor)/vo-si" as never}/>;
  if (exam && typeof examId === "string" && examId) return <Redirect href={examHref(examId, fighter.id) as never}/>;
  return <Redirect href={doctorFighterHref(fighter.id, tab) as never}/>;
}
