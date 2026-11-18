import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { doctorAiListHref } from "@/screens/doctor/redesign/doctor-paths";
import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The doctor's one video page (redesign step 21): `?jobId=…` and/or `?id=<videoId>` (old links send `job`). No params: the AI list. */
export default function DoctorVideoRoute() {
  const params = useLocalSearchParams<{ id?: string; jobId?: string; job?: string }>();
  const id = one(params.id);
  const jobId = one(params.jobId) || one(params.job);
  if (!id && !jobId) return <Redirect href={doctorAiListHref() as unknown as Href}/>;
  return <EvidenceRoute role="doctor" params={{ id: id || undefined, jobId: jobId || undefined }} listHref={doctorAiListHref() as unknown as Href} canRequestAnalysis={false}/>;
}
