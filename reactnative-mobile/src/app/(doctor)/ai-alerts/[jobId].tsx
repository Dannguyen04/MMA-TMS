import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { doctorAiListHref, doctorVideoHref } from "@/screens/doctor/redesign/doctor-paths";

/** Old alert page (redesign step 21): opens the one video page for the job. */
export default function DoctorAiAlertOldRoute() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const id = typeof jobId === "string" ? jobId : "";
  return <Redirect href={(id ? doctorVideoHref(id) : doctorAiListHref()) as unknown as Href}/>;
}
