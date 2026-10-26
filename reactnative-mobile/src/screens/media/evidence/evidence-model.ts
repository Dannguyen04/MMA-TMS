import type { ResultFinding, WorkerResult } from "@/components/video/pose-model";

export type FindingFilter = "all" | "fix" | "good";

export function filterFindings(findings: ResultFinding[], filter: FindingFilter): ResultFinding[] {
  const rows = [...findings].sort((a, b) => a.timeMs - b.timeMs);
  if (filter === "fix") return rows.filter((f) => f.severity === "warning" || f.severity === "critical");
  if (filter === "good") return rows.filter((f) => f.severity === "positive");
  return rows;
}

export type Metrics = { strikes: number; avgScore: number | null; peakSpeed: number | null; usablePct: number | null };

/** The four summary numbers; avg falls back to the mean of strike scores when the worker omits it. */
export function metricsOf(result: WorkerResult): Metrics {
  const scores = result.strikes.map((s) => s.score).filter((n): n is number => n != null);
  const speeds = result.strikes.map((s) => s.peakSpeed).filter((n): n is number => n != null);
  const ev = result.movementEvidence;
  return {
    strikes: result.strikes.length,
    avgScore: result.avgScore ?? (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null),
    peakSpeed: speeds.length ? Math.max(...speeds) : null,
    usablePct: ev && ev.totalFrames > 0 ? Math.round((ev.usableFrames / ev.totalFrames) * 100) : null,
  };
}

export function formatPrecise(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
