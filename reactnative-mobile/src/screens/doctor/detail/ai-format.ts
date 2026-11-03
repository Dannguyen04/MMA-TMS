import type { AnalysisJob, HealthAlert, JobHealthAlerts } from "@/api/media";
import { jointLabelVi } from "@/components/body3d/regions";

export const aiText = {
  tab: "Video AI",
  disclaimer: "Kết quả AI chỉ để tham khảo, quyết định y tế do bác sĩ đưa ra.",
  none: "Chưa có cảnh báo AI",
  noAlerts: "Không phát hiện cảnh báo nào",
  running: "Đang phân tích, kết quả sẽ hiện khi xong",
  failed: "Phân tích không thành công",
  partial: "Một số video chưa tải được cảnh báo.",
  alerts: (n: number) => `${n} cảnh báo`,
  at: (clock: string) => `Tại ${clock} trong video`,
  rom: (pct: number) => `Biên độ còn ${pct}%`,
  video: (d: string) => `Video ngày ${d}`,
  severity: { medium: "Trung bình", high: "Cao", critical: "Nghiêm trọng" } as Record<string, string>,
  motion: { TACTICAL_FEINT: "Đòn giả", POWER_STRIKE: "Đòn mạnh", PARTIAL_STRIKE: "Đòn chưa trọn", UNKNOWN: "Chưa rõ loại đòn" } as Record<string, string>,
} as const;

const SEV_RANK: Record<string, number> = { medium: 1, high: 2, critical: 3 };
export const AI_LIMIT = 10;

/** Job của võ sĩ này, mới nhất trước, tối đa 10. */
export function fighterJobs(jobs: readonly AnalysisJob[], fighterId: string, limit: number = AI_LIMIT): AnalysisJob[] {
  return jobs
    .filter((j) => j.fighterId === fighterId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function severityText(s: string): string {
  return aiText.severity[s] ?? "Chưa rõ mức";
}

export type AlertItem = { jobId: string; jobAt: string; alert: HealthAlert };
export type JointGroup = { joint: string; label: string; worst: string; latestAt: string; items: AlertItem[] };

/** Nhóm cảnh báo theo khớp; nhóm nặng nhất (rồi mới nhất) lên trước; trong nhóm mới nhất trước. */
export function groupAlerts(rows: readonly { job: AnalysisJob; res: JobHealthAlerts }[]): JointGroup[] {
  const map = new Map<string, JointGroup>();
  for (const { job, res } of rows) {
    for (const a of res.healthAlerts ?? []) {
      const g = map.get(a.joint) ?? { joint: a.joint, label: jointLabelVi(a.joint), worst: a.severity, latestAt: job.createdAt, items: [] };
      if ((SEV_RANK[a.severity] ?? 0) > (SEV_RANK[g.worst] ?? 0)) g.worst = a.severity;
      if (Date.parse(job.createdAt) > Date.parse(g.latestAt)) g.latestAt = job.createdAt;
      g.items.push({ jobId: job.id, jobAt: job.createdAt, alert: a });
      map.set(a.joint, g);
    }
  }
  const out = [...map.values()];
  for (const g of out) g.items.sort((x, y) => Date.parse(y.jobAt) - Date.parse(x.jobAt) || x.alert.triggerTimeMs - y.alert.triggerTimeMs);
  return out.sort((a, b) => (SEV_RANK[b.worst] ?? 0) - (SEV_RANK[a.worst] ?? 0) || Date.parse(b.latestAt) - Date.parse(a.latestAt));
}

export type JobPhase = "running" | "failed" | "done";
export function jobPhase(status: string): JobPhase {
  if (status === "FAILED") return "failed";
  if (status === "DONE") return "done";
  return "running";
}
