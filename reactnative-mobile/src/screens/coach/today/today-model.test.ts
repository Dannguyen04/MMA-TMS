/// <reference types="jest" />
import type { ReadinessRow, TodoItem } from "@/api/coach/coach-today";
import type { CampBout, CampDetail } from "@/features/fight-camp/api";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { attentionRows, countdown, liveBouts, paperworkFact, readyRows, sortTodo, stageAction, todoText, weightFact } from "./today-model";

const bout = (over: Partial<CampBout>): CampBout => ({ ...previewBout, ...over });
const row = (over: Partial<ReadinessRow>): ReadinessRow => ({
  fighterId: "f1", fighterName: "Minh Trần", ready: true, status: "READY", latestWeightKg: null, latestWeightOn: null,
  activeBout: null, suspension: null, fullReturnOn: null, gradedReturn: null, ...over,
});
const item = (over: Partial<TodoItem>): TodoItem => ({ source: "CAN_ENTER_FIGHT_WEEK", phase: "BEFORE", fighterId: "f1", boutId: "b1", eventName: "Lotus", dueOn: null, count: null, ...over });

describe("Coach Hôm nay rules", () => {
  it("keeps live bouts only, nearest fight first", () => {
    const list = liveBouts([
      bout({ id: "late", status: "CAMP", boutAt: "2026-12-26T12:00:00Z" }),
      bout({ id: "done", status: "COMPLETED", boutAt: "2026-11-01T12:00:00Z" }),
      bout({ id: "soon", status: "FIGHT_WEEK", boutAt: "2026-11-14T12:00:00Z" }),
    ]);
    expect(list.map(b => b.id)).toEqual(["soon", "late"]);
  });

  it("counts academy days to the weigh-in, then to the fight once weighed in", () => {
    const now = new Date("2026-11-11T20:00:00+07:00");
    expect(countdown({ status: "FIGHT_WEEK", weighInAt: "2026-11-13T08:00:00+07:00", boutAt: "2026-11-14T19:00:00+07:00" }, now)).toEqual({ days: 2, what: "WEIGH_IN", overdue: false });
    expect(countdown({ status: "WEIGHED_IN", weighInAt: "2026-11-10T08:00:00+07:00", boutAt: "2026-11-11T19:00:00+07:00" }, now)).toEqual({ days: 0, what: "BOUT", overdue: false });
    expect(countdown({ status: "FIGHT_WEEK", weighInAt: "2026-11-09T08:00:00+07:00", boutAt: "2026-11-10T19:00:00+07:00" }, now)).toEqual({ days: 2, what: "WEIGH_IN", overdue: true });
  });

  it("picks one action per stage", () => {
    expect(stageAction("CAMP")).toBe("DETAIL");
    expect(stageAction("FIGHT_WEEK")).toBe("WEIGH");
    expect(stageAction("WEIGHED_IN")).toBe("CORNER");
    expect(stageAction("WEIGHED_IN", true)).toBe("DETAIL");
    expect(stageAction("FIGHT_WEEK", true)).toBe("WEIGH");
  });

  it("says weight against the limit in words", () => {
    const b = bout({ weightLimitKg: 77, catchweightKg: null, officialWeightKg: null });
    const d = (latestKg: number | null) => ({ ...structuredClone(previewBout), weight: { ...previewBout.weight, latestKg } }) as CampDetail;
    expect(weightFact(b, d(77.6))).toEqual({ label: "Cân gần nhất", value: "77,6 kg · vượt 0,6 kg", tone: "danger" });
    expect(weightFact(b, d(76.4))?.value).toBe("76,4 kg · trong giới hạn");
    expect(weightFact(b, d(null))?.value).toBe("Chưa ghi cân");
    expect(weightFact({ ...b, officialWeightKg: 76.9, madeWeight: true }, null)).toEqual({ label: "Cân chính thức", value: "76,9 kg · đạt", tone: "success" });
  });

  it("reports paperwork as complete or the number of open items", () => {
    const d = structuredClone(previewBout) as CampDetail;
    d.requirements = [{ code: "A", label: "Khám", required: true, status: "MISSING", validUntil: null }, { code: "B", label: "HĐ", required: true, status: "CONFIRMED", validUntil: "2026-12-31" }];
    expect(paperworkFact(d)?.value).toBe("Thiếu 1 mục");
    d.requirements[0] = { ...d.requirements[0], status: "PROVIDED", validUntil: "2026-12-31" };
    expect(paperworkFact(d)?.value).toBe("Đủ");
  });

  it("words to-do items like the website and puts urgent ones first", () => {
    expect(todoText(item({ source: "REQUIREMENTS_DUE", count: 2, dueOn: "2026-12-19" }))).toBe("Hồ sơ còn thiếu (2 mục), hạn 19/12");
    const sorted = sortTodo([item({ source: "CAN_ENTER_FIGHT_WEEK" }), item({ source: "WEIGHT_OVER_LIMIT", boutId: "b2" })]);
    expect(sorted[0].source).toBe("WEIGHT_OVER_LIMIT");
  });

  it("lists ready fighters with a graded-return note only when there is one", () => {
    const rows = readyRows([row({}), row({ fighterId: "f2", fighterName: "Kenji", gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-12" } }), row({ fighterId: "f3", status: "IN_BOUT", ready: false })]);
    expect(rows).toEqual([{ fighterId: "f1", name: "Minh Trần", why: null }, { fighterId: "f2", name: "Kenji", why: "Tập lại theo bậc, đủ từ 12/11" }]);
  });

  it("drops READY fighters the doctor has not cleared or who are injured (readiness only knows suspensions)", () => {
    const ready = [row({}), row({ fighterId: "f2", fighterName: "Kenji" }), row({ fighterId: "f3", fighterName: "Dat" })];
    const fighters = [
      { id: "f1", name: "Minh Trần", medicalStatus: "INJURED" as const },
      { id: "f2", name: "Kenji", medicalStatus: "MONITORING" as const },
      { id: "f3", name: "Dat", medicalStatus: "NOT_CLEARED" as const },
    ];
    expect(readyRows(ready, fighters).map(r => r.name)).toEqual(["Kenji"]);
    expect(readyRows(ready, null)).toHaveLength(3);
  });

  it("merges suspensions and medical flags into one row per fighter, suspension wins", () => {
    const rows = attentionRows(
      [
        row({ fighterId: "s1", fighterName: "Anh Le", status: "SUSPENDED", ready: false, suspension: { startsOn: "2026-11-01", endsOn: "2026-11-30", expectedResumeOn: "2026-12-01" } }),
        row({ fighterId: "s2", fighterName: "Dat", status: "AWAITING_CLEARANCE", ready: false }),
      ],
      [
        { id: "s1", name: "Anh Le", medicalStatus: "INJURED" },
        { id: "m1", name: "Hoa", medicalStatus: "NOT_CLEARED" },
        { id: "m2", name: "Lan", medicalStatus: "MONITORING" },
        { id: "h1", name: "Khoa", medicalStatus: "HEALTHY" },
      ],
    );
    expect(rows.map(r => [r.name, r.why])).toEqual([
      ["Anh Le", "Đình chỉ đến 30/11"], ["Dat", "Chờ xác nhận được tập lại"], ["Hoa", "Chưa cho phép tập"], ["Lan", "Đang theo dõi y tế"],
    ]);
    expect(attentionRows(null, [{ id: "m1", name: "Hoa", medicalStatus: "INJURED" }])).toHaveLength(1);
  });
});
