import { useLocalSearchParams } from "expo-router";

import { ImpairmentAlertDetail } from "@/screens/doctor/impairment-alerts";

export default function DoctorAiAlertDetailRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const id = typeof jobId === "string" ? jobId : "";
  return <ImpairmentAlertDetail jobId={id} />;
}
