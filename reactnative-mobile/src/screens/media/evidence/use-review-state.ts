import { useCallback, useEffect, useState } from "react";

import { getCoachingState, getMovementReviews, type CoachingState, type MovementReviewState } from "@/api/evidence";
import { getJobHealthAlerts, type HealthAlert } from "@/api/media";
import type { EvidenceRole } from "@/screens/media/video-detail";

/**
 * Review data next to the result. Doctors never call /coaching/jobs/:id/state (the route
 * excludes them); only doctors load health alerts. A 403 on any part just hides that part.
 */
export function useReviewState(jobId: string | null, done: boolean, role: EvidenceRole) {
  const [coaching, setCoaching] = useState<CoachingState | null>(null);
  const [movement, setMovement] = useState<MovementReviewState | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!jobId || !done) return;
    let cancelled = false;
    const quiet = <T,>(p: Promise<T>) => p.catch((): null => null);
    if (role !== "doctor") void quiet(getCoachingState(jobId)).then((v) => !cancelled && setCoaching(v));
    void quiet(getMovementReviews(jobId)).then((v) => !cancelled && setMovement(v));
    if (role === "doctor") void quiet(getJobHealthAlerts(jobId)).then((v) => !cancelled && setAlerts(v?.healthAlerts ?? null));
    return () => {
      cancelled = true;
    };
  }, [jobId, done, role, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { coaching, movement, alerts, reload };
}
