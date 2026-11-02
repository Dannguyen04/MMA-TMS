import { useCallback, useEffect, useRef, useState } from "react";

import { getJobResult } from "@/api/evidence";
import type { WorkerResult } from "@/components/video/pose-model";
import type { PoseState } from "@/screens/media/evidence/evidence-player";
import { evidenceError } from "@/screens/media/evidence/errors";

/**
 * Loads GET /jobs/:id/result only once the job is DONE and the caller asks for it
 * (`enabled`), so the multi-MB JSON is never fetched for queued jobs or hidden screens.
 */
export function useJobResult(
  jobId: string | null,
  done: boolean,
  enabled: boolean,
  /** Nguồn dữ liệu (mặc định API thật); màn video AI truyền videoAiApi.getJobResult để theo cờ mock. */
  load: (jobId: string, options: { fresh?: boolean }) => Promise<WorkerResult> = getJobResult,
) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [result, setResult] = useState<WorkerResult | null>(null);
  const [state, setState] = useState<PoseState>("idle");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!jobId || !done || !enabled) {
      setResult(null);
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    setError("");
    void loadRef.current(jobId, { fresh: attempt > 0 })
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setState(next.frames.some((f) => f.keypoints.length > 0) ? "ready" : "missing");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult(null);
        setState("error");
        setError(evidenceError(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, done, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { result, state, error, reload };
}
