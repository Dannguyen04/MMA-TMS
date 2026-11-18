import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { doctorAiListHref, doctorVideoHref } from "@/screens/doctor/redesign/doctor-paths";

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Old video page (`video?id=…&job=…`, redesign step 21): opens the one video page. */
export default function DoctorVideoOldRoute() {
  const params = useLocalSearchParams<{ id?: string; job?: string }>();
  const id = one(params.id);
  const job = one(params.job);
  if (!id && !job) return <Redirect href={doctorAiListHref() as unknown as Href}/>;
  const href = job ? doctorVideoHref(job, id || null) : { pathname: "/(doctor)/ai-alerts/xem", params: { id } };
  return <Redirect href={href as unknown as Href}/>;
}
