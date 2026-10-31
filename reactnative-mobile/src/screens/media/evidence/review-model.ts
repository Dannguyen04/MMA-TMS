import type { CoachingState, FindingReviewStatus, MovementReviewState } from "@/api/evidence";

export type FindingReview = CoachingState["reviews"][number];
export type WindowReview = MovementReviewState["reviews"][number];

/** Latest review per finding (state rows are append-only, oldest first). */
export function latestFindingReview(state: CoachingState | null, actionId: string | null, findingId: string): FindingReview | null {
  if (!state) return null;
  let hit: FindingReview | null = null;
  for (const r of state.reviews) {
    if (r.findingId === findingId && (actionId == null || r.actionId === actionId)) {
      if (!hit || r.createdAt >= hit.createdAt) hit = r;
    }
  }
  return hit;
}

export function latestCorrection(state: CoachingState | null) {
  if (!state || state.corrections.length === 0) return null;
  return [...state.corrections].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]!;
}

/** Latest review for a window by anyone (shown) and the caller's own revision (sent as expectedRevision). */
export function windowReviewInfo(state: MovementReviewState | null, windowId: string) {
  if (!state) return { latest: null as WindowReview | null, myRevision: 0 };
  const rows = state.reviews.filter((r) => r.windowId === windowId);
  const latest = rows.reduce<WindowReview | null>((a, r) => (!a || r.createdAt >= a.createdAt ? r : a), null);
  const myRevision = rows.filter((r) => r.reviewerId === state.reviewerId).reduce((m, r) => Math.max(m, r.revision), 0);
  return { latest, myRevision };
}

export const FINDING_DECISIONS: FindingReviewStatus[] = ["approved", "corrected", "rejected"];

/** RFC 4122 v4 id for idempotent movement reviews; no uuid dependency is available. */
export function uuidV4(rand: (bytes: Uint8Array) => void = defaultRandom): string {
  const b = new Uint8Array(16);
  rand(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function defaultRandom(b: Uint8Array) {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
}
