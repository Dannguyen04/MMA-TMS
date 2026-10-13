import { describe, expect, it } from "vitest";
import { campReducer, conflicts, initialCamp, underTarget, unresolvedDiscomfort, type Action, type CampState } from "./camp-state";

const resultAction: Action = { type: "result", actor: "coach", id: "s3", result: { completedRounds: 4, successes: 8, attempts: 10, effort: 7, discomfort: true, note: "Khó chịu vai ở hiệp cuối." } };
function restrict(state = initialCamp()) {
    return campReducer(state, { type: "clinical", actor: "doctor", restriction: "upper", reviewAt: "2026-10-09", reason: "Đã đánh giá tình huống mẫu.", sharedNote: "HLV xem lại các buổi có tải thân trên.", confirmed: true });
}
describe("fight camp coaching workflow", () => {
    it("distinguishes completing all rounds from meeting the technical target", () => {
        const state = initialCamp();
        expect(state.sessions[1].result?.completedRounds).toBe(state.sessions[1].rounds);
        expect(underTarget(state).map((item) => item.id)).toEqual(["s1", "s2"]);
    });
    it("creates medical follow-up from reported discomfort without inventing a restriction", () => {
        const state = campReducer(initialCamp(), resultAction);
        expect(unresolvedDiscomfort(state).map((item) => item.id)).toEqual(["s3"]);
        expect(state.clinical.restriction).toBe("none");
        expect(underTarget(state).map((item) => item.id)).toEqual(["s1", "s2"]);
    });
    it("rejects impossible scores and duplicate completion", () => {
        const invalid = campReducer(initialCamp(), { ...resultAction, result: { ...resultAction.result, successes: 11 } });
        expect(invalid.error).toBeTruthy();
        expect(invalid.sessions[2].status).toBe("planned");
        const completed = campReducer(initialCamp(), resultAction);
        expect(campReducer(completed, resultAction).error).toBeTruthy();
    });
    it("rejects completion before the scheduled date", () => {
        expect(campReducer(initialCamp(), { ...resultAction, id: "s5" }).error).toContain("Chưa đến ngày");
    });
    it("requires a clinician decision and does not auto-clear restrictions by date", () => {
        const denied = campReducer(initialCamp(), { type: "clinical", actor: "coach", restriction: "upper", reviewAt: "2026-10-09", reason: "test", sharedNote: "", confirmed: true });
        expect(denied.error).toBeTruthy();
        const state = restrict();
        expect(conflicts("distance", state.clinical)).toBe(true);
        expect(conflicts("tactics", state.clinical)).toBe(false);
        expect(campReducer(state, resultAction).error).toContain("xung đột");
    });
    it("adjusts only the selected session and retains the original and reason", () => {
        const state = restrict();
        const changed = campReducer(state, { type: "adjust", actor: "coach", id: "s3", templateId: "tactics", rounds: 3, reason: "Đổi sang phân tích video theo hạn chế đang áp dụng." });
        expect(changed.sessions[2]).toMatchObject({ templateId: "tactics", original: "counter", rounds: 3 });
        expect(changed.sessions[3]).toEqual(state.sessions[3]);
        expect(changed.events[0].detail).toContain("4 → 3 hiệp");
    });
    it("does not revert adjusted sessions after the doctor lifts a restriction", () => {
        const adjusted = campReducer(restrict(), { type: "adjust", actor: "coach", id: "s3", templateId: "tactics", rounds: 3, reason: "Điều chỉnh theo kết luận." });
        const cleared = campReducer(adjusted, { type: "clinical", actor: "doctor", restriction: "none", reviewAt: "2026-10-12", reason: "Đã đánh giá lại trong tình huống mẫu.", sharedNote: "", confirmed: true });
        expect(cleared.clinical.restriction).toBe("none");
        expect(cleared.sessions[2].templateId).toBe("tactics");
    });
    it("does not mix video-analysis scores into physical technical performance", () => {
        const adjusted = campReducer(initialCamp(), { type: "adjust", actor: "coach", id: "s3", templateId: "tactics", rounds: 4, reason: "Phân tích lựa chọn trước khi thực hành." });
        const completed = campReducer(adjusted, { ...resultAction, result: { ...resultAction.result, successes: 1, discomfort: false } });
        expect(underTarget(completed).map((session) => session.id)).toEqual(["s1", "s2"]);
    });
    it("keeps historical target snapshots when the coach changes the next goal", () => {
        const changed = campReducer(initialCamp(), { type: "goal", actor: "coach", focus: "distance", target: 90 });
        expect(changed.target).toBe(90);
        expect(changed.sessions[0].target).toBe(80);
    });
    it("rejects overlapping schedules and incompatible replacement templates", () => {
        const state = initialCamp();
        const overlap = campReducer(state, { type: "add-session", actor: "coach", session: { ...state.sessions[2], time: "16:05" } });
        expect(overlap.error).toContain("trùng");
        expect(campReducer(restrict(), { type: "adjust", actor: "coach", id: "s3", templateId: "distance", rounds: 4, reason: "Thử phương án." }).error).toContain("xung đột");
    });
    it("closes reviewed issues but opens new issues for subsequent below-target results", () => {
        const reviewed = campReducer(initialCamp(), { type: "review-results", actor: "coach", reason: "Giảm độ phức tạp và kiểm tra lại cuối buổi." });
        expect(underTarget(reviewed)).toHaveLength(0);
        const completed = campReducer(reviewed, { ...resultAction, result: { ...resultAction.result, successes: 6, discomfort: false } });
        expect(underTarget(completed).map((item) => item.id)).toEqual(["s3"]);
    });
    it("supports a weight request, missing-information decision and resubmission", () => {
        let state = campReducer(initialCamp(), { type: "weight-request", actor: "coach", target: 70, question: "Cần rà soát mục tiêu trước thi đấu." });
        state = campReducer(state, { type: "weight-decision", actor: "doctor", status: "needs-info", reason: "Bổ sung bối cảnh cân.", followUp: "2026-10-09" });
        expect(state.weight.status).toBe("needs-info");
        state = campReducer(state, { type: "weight-request", actor: "coach", target: 70, question: "Các số đo đều được ghi buổi sáng." });
        expect(state.weight.status).toBe("requested");
        expect(state.weight.decision).toBe("");
    });
    it("replaces only the weight record for the same date without approving a goal", () => {
        const state: CampState = campReducer(initialCamp(), { type: "weight-record", actor: "fighter", date: "2026-10-06", value: 72, context: "Buổi sáng" });
        expect(state.weight.records).toHaveLength(6);
        expect(state.weight.records[5].value).toBe(72);
        expect(state.weight.status).toBe("draft");
    });
});
