import { useLocalSearchParams } from "expo-router";

import { ApplicantDetailScreen } from "@/screens/admissions/applicant-detail";

export default function FighterAdmissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ApplicantDetailScreen id={typeof id === "string" ? id : ""} />;
}
