import { Redirect, type Href } from "expo-router";

import { doctorAiListHref } from "@/screens/doctor/redesign/doctor-paths";

/** Old AI list (redesign step 21): now the Cảnh báo AI tab of Võ sĩ. */
export default function DoctorAiAlertsOldRoute() {
  return <Redirect href={doctorAiListHref() as unknown as Href}/>;
}
