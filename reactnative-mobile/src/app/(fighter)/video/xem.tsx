import { useLocalSearchParams } from "expo-router";

import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";

/** `/video/xem?id=<videoId>` — video, khung xương và bằng chứng (chỉ đọc). */
export default function FighterVideoEvidenceRoute() {
  const params = useLocalSearchParams<{ id?: string; jobId?: string }>();
  return <EvidenceRoute role="fighter" params={params} listHref="/video" canRequestAnalysis />;
}
