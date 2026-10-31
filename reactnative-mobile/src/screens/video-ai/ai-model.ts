import type { AiCoachingState, AiHealthAlert, AiJob, AiMovementReviews, AiVideo } from "@/api/video-ai.types";
import { jointLabelVi } from "@/components/body3d/regions";
import { vai } from "@/i18n/video-ai";
import type { ChipSpec } from "@/screens/coach/readonly/ro-format";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { media } from "@/i18n/media";

/** Backend trả tối đa 100 job cho GET /jobs; đúng 100 → có thể còn cũ hơn. */
export const JOBS_CAP = 100;
export const POLL_MS = 15_000;

export type StatusFilter = "ALL" | "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export const STATUS_FILTERS: readonly StatusFilter[] = ["ALL", "PENDING", "PROCESSING", "DONE", "FAILED"];

/** Chip trạng thái job/video (luôn có icon + chữ). PENDING dùng màu chữ thường (không xám) để đủ tương phản. */
export function jobChip(status: string | null | undefined): ChipSpec {
  switch (status) {
    case "PROCESSING":
      return { label: vai.status.PROCESSING!, tone: "info", icon: "retry" };
    case "DONE":
      return { label: vai.status.DONE!, tone: "success", icon: "success" };
    case "FAILED":
      return { label: vai.status.FAILED!, tone: "danger", icon: "xCircle" };
    case "PENDING":
      return { label: vai.status.PENDING!, tone: "neutral", icon: "schedule" };
    default:
      return { label: vai.notAnalyzed, tone: "neutral", icon: "circle" };
  }
}

export const REVIEW_CHIP: ChipSpec = { label: vai.needsReview, tone: "attention", icon: "alertCircle" };
export const IMPAIRMENT_CHIP: ChipSpec = { label: vai.impairment, tone: "danger", icon: "warning" };

const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEV_TEXT: Record<string, string> = { low: "Thấp", medium: "Trung bình", high: "Cao", critical: "Nghiêm trọng" };

export function severityKey(s: string): string {
  return (s ?? "").toLowerCase();
}
export function severityRank(s: string): number {
  return SEV_RANK[severityKey(s)] ?? 0;
}
export function severityLabel(s: string): string {
  return SEV_TEXT[severityKey(s)] ?? "Chưa rõ mức";
}
/** Thấp/trung bình = warning, cao/nghiêm trọng = danger. */
export function severityTone(s: string): "attention" | "danger" {
  return severityRank(s) >= 2 ? "danger" : "attention";
}
export function severityChip(s: string): ChipSpec {
  return { label: severityLabel(s), tone: severityTone(s), icon: severityTone(s) === "danger" ? "warning" : "alertCircle" };
}

const STATE_TEXT: Record<string, string> = {
  HEALTHY: "Bình thường",
  SUSPECTED: "Nghi ngờ",
  SUSPECTED_AVOIDANCE: "Nghi né tránh",
  CONFIRMED_IMPAIRMENT: "Suy giảm",
};
export function jointStateText(s: string): string {
  return STATE_TEXT[s] ?? "Chưa rõ";
}
export function jointText(joint: string): string {
  return joint ? jointLabelVi(joint) : vai.jointUnknown;
}

export function mmss(ms: number | null | undefined): string {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Thời lượng ngắn: "1:42" (m:ss) hoặc "1:02:03". */
export function durationShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Thời gian tương đối tiếng Việt; quá 7 ngày → dd/mm/yyyy. */
export function relTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return vnDate(iso);
}

/** Điểm hiển thị nguyên như backend trả (không "/100"); chỉ khi DONE, còn lại "–". */
export function scoreText(job: Pick<AiJob, "status" | "score">): string {
  return job.status === "DONE" && job.score != null ? String(job.score) : "–";
}

export function newestFirst<T extends { createdAt: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Lọc trên máy + sắp: job chờ HLV duyệt lên đầu, rồi mới nhất. */
export function arrangeJobs(
  jobs: readonly AiJob[],
  q: { status: StatusFilter; fighterId?: string },
  pending: ReadonlySet<string> = new Set(),
): AiJob[] {
  const rows = jobs.filter((j) => (q.status === "ALL" || j.status === q.status) && (!q.fighterId || j.fighterId === q.fighterId));
  return newestFirst(rows).sort((a, b) => Number(pending.has(b.id)) - Number(pending.has(a.id)));
}

/** Đúng 100 bản ghi từ backend → hiện dòng "Đang hiện 100 phân tích gần nhất". */
export function isCapped(total: number): boolean {
  return total === JOBS_CAP;
}

/** Job mới nhất của một video. */
export function latestJobFor(jobs: readonly AiJob[], videoId: string): AiJob | null {
  return newestFirst(jobs.filter((j) => j.videoId === videoId))[0] ?? null;
}

/** Nhãn loại tập / góc quay; mã lạ → chuỗi rỗng (không lộ mã thô). */
export function trainingText(code: string): string {
  return (media.training as Record<string, string>)[code] ?? "";
}
export function angleText(code: string): string {
  return (media.anglePhrase as Record<string, string>)[code] ?? "";
}

export function videoInfo(v: Pick<AiVideo, "trainingType" | "cameraAngle" | "durationMs" | "createdAt">, fighter: string): string[] {
  return [fighter, trainingText(v.trainingType), angleText(v.cameraAngle), durationShort(v.durationMs), vnDate(v.createdAt)].filter(Boolean);
}

/** Bước hiện tại trong tiến trình 4 bước (0..3). PENDING = 0, PROCESSING = 1 (worker chưa báo bước chi tiết). */
export function currentStep(status: string): number {
  if (status === "DONE") return 4;
  if (status === "PROCESSING") return 1;
  return 0;
}

export type AlertGroup = { joint: string; label: string; worst: string; items: AiHealthAlert[] };
/** Nhóm theo khớp: mức cao nhất, số lần; nhóm nặng nhất lên trước; trong nhóm theo thời điểm. */
export function groupByJoint(alerts: readonly AiHealthAlert[]): AlertGroup[] {
  const map = new Map<string, AlertGroup>();
  for (const a of alerts) {
    const g = map.get(a.joint) ?? { joint: a.joint, label: jointText(a.joint), worst: a.severity, items: [] };
    if (severityRank(a.severity) > severityRank(g.worst)) g.worst = a.severity;
    g.items.push(a);
    map.set(a.joint, g);
  }
  const out = [...map.values()];
  for (const g of out) g.items.sort((x, y) => x.triggerTimeMs - y.triggerTimeMs);
  return out.sort((a, b) => severityRank(b.worst) - severityRank(a.worst) || b.items.length - a.items.length);
}

/** Người duyệt: không bao giờ hiện id/tên; trùng người đang đăng nhập → "Bạn đã duyệt". */
export function reviewerText(reviewerId: string | null | undefined, createdAt: string, meId: string | null | undefined): string {
  const d = vnDate(createdAt);
  return meId && reviewerId && reviewerId === meId ? vai.reviewedByYou(d) : vai.reviewedBy(d);
}

export function decisionText(d: string): string {
  return vai.decision[d] ?? vai.decisionOther;
}
export function decisionChip(d: string): ChipSpec {
  if (d === "rejected") return { label: decisionText(d), tone: "neutral", icon: "xCircle" };
  if (d === "corrected") return { label: decisionText(d), tone: "info", icon: "info" };
  return { label: decisionText(d), tone: "success", icon: "success" };
}

export type ReviewItem = {
  id: string;
  decision: string;
  correctedLabel: string | null;
  notes: string;
  segment: string | null;
  rating: number | null;
  by: string;
  createdAt: string;
};

/** Gộp quan sát (finding reviews), nhận xét (corrections) và duyệt chuyển động; mới nhất trước. */
export function reviewItems(state: AiCoachingState | null, moves: AiMovementReviews | null, meId: string | null): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const r of state?.findingReviews ?? []) {
    out.push({ id: `f-${r.id}`, decision: r.status, correctedLabel: r.correctedLabel, notes: r.notes ?? "", segment: null, rating: null, by: reviewerText(r.coachId, r.createdAt, meId), createdAt: r.createdAt });
  }
  for (const c of state?.corrections ?? []) {
    out.push({ id: `c-${c.id}`, decision: "corrected", correctedLabel: null, notes: c.reviewText, segment: null, rating: c.techniqueRating, by: reviewerText(c.coachId, c.createdAt, meId), createdAt: c.createdAt });
  }
  for (const m of moves?.reviews ?? []) {
    const seg = m.startMs != null && m.endMs != null ? vai.segment(mmss(m.startMs), mmss(m.endMs)) : null;
    out.push({ id: `m-${m.id}`, decision: m.decision, correctedLabel: null, notes: m.notes, segment: seg, rating: null, by: reviewerText(m.reviewerId, m.createdAt, meId), createdAt: m.createdAt });
  }
  return newestFirst(out);
}

/** HLV đã có review (quan sát hoặc nhận xét) cho job này chưa. */
export function hasCoachReview(state: Pick<AiCoachingState, "findingReviews" | "corrections"> | null): boolean {
  return Boolean(state && (state.findingReviews.length > 0 || state.corrections.length > 0));
}

export type ImpairmentRow = { jobId: string; videoId: string | null; fighterId: string; joint: string; severity: string; createdAt: string };
/** Một dòng / job suy giảm: khớp nặng nhất (theo jointStates hoặc cảnh báo), mới nhất trước. */
export function impairmentRows(jobs: readonly AiJob[], alerts: Record<string, AiHealthAlert[] | undefined>): ImpairmentRow[] {
  return newestFirst(jobs)
    .filter((j) => j.fighterId)
    .map((j) => {
      const list = alerts[j.id] ?? [];
      const worst = [...list].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
      return { jobId: j.id, videoId: j.videoId, fighterId: j.fighterId!, joint: worst?.joint ?? "", severity: worst?.severity ?? "", createdAt: j.createdAt };
    });
}
