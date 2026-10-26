import type { CoachingState, MovementReviewState } from "@/api/evidence";
import { latestCorrection, latestFindingReview, uuidV4, windowReviewInfo } from "./review-model";

const state: CoachingState = {
  jobId: "j",
  videoId: "v",
  fighterId: "f",
  analysisId: "a",
  reviews: [
    { actionId: "act", findingId: "f1", coachId: "c", status: "approved", notes: null, correctedLabel: null, createdAt: "2026-10-01T00:00:00Z" },
    { actionId: "act", findingId: "f1", coachId: "c", status: "corrected", notes: null, correctedLabel: "Jab", createdAt: "2026-10-02T00:00:00Z" },
  ],
  corrections: [
    { coachId: "c", reviewText: "cũ", techniqueRating: 3, createdAt: "2026-10-01T00:00:00Z" },
    { coachId: "c", reviewText: "mới", techniqueRating: 4, createdAt: "2026-10-03T00:00:00Z" },
  ],
};

describe("review model", () => {
  it("picks the latest finding review and correction", () => {
    expect(latestFindingReview(state, "act", "f1")?.status).toBe("corrected");
    expect(latestFindingReview(state, "other", "f1")).toBeNull();
    expect(latestCorrection(state)?.reviewText).toBe("mới");
  });

  it("uses the caller's own revision for expectedRevision", () => {
    const mv: MovementReviewState = {
      jobId: "j",
      reviewerId: "me",
      canReview: true,
      context: null,
      reviews: [
        { id: "1", windowId: "w1", reviewerId: "me", reviewerRole: "COACH", revision: 1, decision: "confirmed", notes: "ok", startMs: null, endMs: null, createdAt: "2026-10-01T00:00:00Z" },
        { id: "2", windowId: "w1", reviewerId: "doc", reviewerRole: "DOCTOR", revision: 3, decision: "rejected", notes: "x", startMs: null, endMs: null, createdAt: "2026-10-02T00:00:00Z" },
      ],
    };
    const info = windowReviewInfo(mv, "w1");
    expect(info.myRevision).toBe(1);
    expect(info.latest?.reviewerRole).toBe("DOCTOR");
    expect(windowReviewInfo(mv, "w2")).toEqual({ latest: null, myRevision: 0 });
  });

  it("makes RFC 4122 v4 ids", () => {
    const id = uuidV4((b) => b.fill(255));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV4()).not.toBe(uuidV4());
  });
});
