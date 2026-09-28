import type { MedicalHistoryEntry } from "@/api/types";
import {
  classifyMilestones,
  describeSnapshot,
  injuryFromSnapshot,
  legacyMilestoneText,
} from "@/components/medical/medical-format";
import { medical } from "@/i18n/medical";

const standard = {
  id: "m1",
  title: "Chạy nhẹ",
  criteria: "Không đau",
  targetDate: null,
  isCompleted: false,
  completedAt: null,
  notes: null,
};

function entry(recordType: MedicalHistoryEntry["recordType"], snapshot: Record<string, unknown>) {
  return {
    recordType,
    recordId: "r1",
    revision: 2,
    source: null,
    recordedAt: "2026-09-01T10:00:00.000Z",
    recordedByUserId: null,
    snapshot,
  } satisfies MedicalHistoryEntry;
}

describe("classifyMilestones", () => {
  it("returns standard only when every element matches the schema", () => {
    expect(classifyMilestones([standard])).toEqual({ kind: "standard", items: [standard] });
  });

  it("falls back to legacy, unchanged and in order, when any element differs", () => {
    const raw = [standard, "Tuần 2: tập lại", { step: 3 }];
    expect(classifyMilestones(raw)).toEqual({ kind: "legacy", items: raw });
  });

  it("treats a completed flag without completedAt as legacy", () => {
    const broken = { ...standard, isCompleted: true, completedAt: null };
    expect(classifyMilestones([broken]).kind).toBe("legacy");
  });

  it("handles non-arrays as an empty standard list", () => {
    expect(classifyMilestones(undefined)).toEqual({ kind: "standard", items: [] });
  });
});

describe("legacyMilestoneText", () => {
  it("renders primitives and objects without reinterpretation", () => {
    expect(legacyMilestoneText("Tuần 1")).toBe("Tuần 1");
    expect(legacyMilestoneText(null)).toBe("—");
    expect(legacyMilestoneText({ step: 1 })).toBe('{"step":1}');
  });
});

describe("describeSnapshot", () => {
  it("reads snake_case injury snapshots", () => {
    const view = describeSnapshot(
      entry("INJURY", {
        affected_joint: "LEFT_KNEE",
        injury_type: "Bong gân",
        status: "ACTIVE",
        severity: "MODERATE",
      }),
    );
    expect(view.title).toBe(medical.recordType.INJURY);
    expect(view.lines[0]?.value).toContain("Bong gân");
  });

  it("lists legacy recovery milestones as text", () => {
    const view = describeSnapshot(
      entry("RECOVERY_PLAN", { title: "Hồi phục gối", milestones: ["Tuần 1", "Tuần 2"] }),
    );
    const milestones = view.lines.find((line) => line.label === medical.milestones);
    expect(milestones?.value).toBe("Tuần 1\nTuần 2");
  });
});

describe("injuryFromSnapshot", () => {
  it("builds an injury from an INJURY snapshot", () => {
    const injury = injuryFromSnapshot(
      entry("INJURY", {
        id: "inj-1",
        fighter_id: "f1",
        affected_joint: "LEFT_KNEE",
        injury_type: "Bong gân",
        severity: "MILD",
        status: "ACTIVE",
        occurred_at: "2026-08-30T08:00:00.000Z",
      }),
    );
    expect(injury).toMatchObject({ id: "inj-1", fighterId: "f1", revision: 2, resolvedAt: null });
  });

  it("returns null for other record types or missing ids", () => {
    expect(injuryFromSnapshot(entry("TREATMENT", { id: "t1" }))).toBeNull();
    expect(injuryFromSnapshot(entry("INJURY", {}))).toBeNull();
  });
});
