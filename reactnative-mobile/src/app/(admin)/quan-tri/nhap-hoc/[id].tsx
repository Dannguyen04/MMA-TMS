import { useLocalSearchParams } from "expo-router";

import { StaffDetailScreen } from "@/screens/admissions/staff-detail";

export default function AdminAdmissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StaffDetailScreen id={typeof id === "string" ? id : ""} audience="admin" />;
}
