import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { adminVideosHref } from "@/screens/admin/tools/admin-paths";

/** Old AI job list link (step 23): now the Phân tích AI tab of Video. */
export default function AdminAiJobsLegacyRoute() {
  const { status, fighterId } = useLocalSearchParams<{ status?: string; fighterId?: string }>();
  return <Redirect href={adminVideosHref({ seg: "ai", status: status === "ALL" ? undefined : status, fighterId }) as unknown as Href} />;
}
