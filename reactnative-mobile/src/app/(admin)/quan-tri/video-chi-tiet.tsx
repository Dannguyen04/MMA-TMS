import { useLocalSearchParams, type Href } from "expo-router";

import { ADMIN_VIDEOS } from "@/screens/admin/tools/admin-paths";
import { EvidenceRoute } from "@/screens/media/evidence/evidence-route";

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The admin video page (redesign step 23): the shared video page, `?id=<videoId>` and/or `?jobId=` (old links send `job`). */
export default function AdminVideoPageRoute() {
  const params = useLocalSearchParams<{ id?: string; jobId?: string; job?: string }>();
  const jobId = one(params.jobId) || one(params.job);
  return <EvidenceRoute role="admin" params={{ id: one(params.id) || undefined, jobId: jobId || undefined }} listHref={ADMIN_VIDEOS as Href} canRequestAnalysis />;
}
