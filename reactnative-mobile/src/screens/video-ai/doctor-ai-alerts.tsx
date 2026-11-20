import { useCallback } from "react";

import { videoAiApi } from "@/api/video/video-ai";
import { useLoad } from "@/screens/fighter/use-load";

import { impairmentRows } from "./ai-model";

/** Tải cảnh báo suy giảm (GET /jobs/impairments + /jobs/:id/health-alerts để lấy khớp & mức nặng nhất). */
export async function loadImpairments() {
  const jobs = await videoAiApi.listImpairmentJobs();
  const res = await Promise.allSettled(jobs.map((j) => videoAiApi.getHealthAlerts(j.id)));
  const alerts = Object.fromEntries(
    jobs.map((j, i) => {
      const r = res[i]!;
      return [j.id, r.status === "fulfilled" ? r.value.alerts : []];
    }),
  );
  return impairmentRows(jobs, alerts);
}

export function useImpairments(enabled: boolean) {
  const run = useCallback(() => loadImpairments(), []);
  return useLoad(enabled, "vai-impairments", run, { keepOnError: true });
}
