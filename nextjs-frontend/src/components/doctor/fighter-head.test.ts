import { describe, expect, it } from "vitest";

import type { MedicalEligibility } from "@/lib/domain/medical-contract";
import { suspensionBoardState, type BoardItem, type SuspensionBoardInput } from "@/lib/services/doctor-board";

import { fighterTabs, headerGates } from "./fighter-head";

const TODAY = "2026-11-09";
const eligible = { eligible: true, reasons: [] } as unknown as MedicalEligibility;
const blocked = { eligible: false, reasons: ["EXAMINATION_REQUIRED"] } as unknown as MedicalEligibility;

/** The suspension item exactly as the board builds it for a fighter. */
function items(suspensions: SuspensionBoardInput[]): BoardItem[] {
    const s = suspensionBoardState(suspensions, TODAY);
    return s.item ? [{ kind: "suspension", text: s.item.text, date: s.item.date, ...(s.tag ? { tone: s.tag } : {}) }] : [];
}

const suspensionGate = (suspensions: SuspensionBoardInput[]) => headerGates(eligible, null, items(suspensions)).find((g) => g.key === "suspension");

describe("profile header gates", () => {
    it("leaves a passed gate neutral and marks a failed one as blocking", () => {
        expect(headerGates(eligible, blocked).map((g) => [g.key, g.tone])).toEqual([
            ["training", "ok"],
            ["competition", "block"],
        ]);
    });

    it("shows an in-force KO suspension as blocking", () => {
        expect(suspensionGate([{ reason: "KO", startsOn: "2026-11-01", endsOn: "2026-11-28", maxAllowedTier: 1 }])).toMatchObject({ label: "Đình chỉ", tone: "block" });
    });

    it("keeps a KO/TKO suspension blocking while it waits for the doctor's clearance", () => {
        const gate = suspensionGate([{ reason: "TKO", startsOn: "2026-10-01", endsOn: "2026-11-05", requiresClearance: true, clearedAt: null }]);
        expect(gate).toMatchObject({ tone: "block" });
        expect(gate?.text).toContain("chờ xác nhận");
    });

    it("shows a suspension that still allows training, or a graded return, as a warning", () => {
        expect(suspensionGate([{ reason: "MANDATORY_REST", startsOn: "2026-11-01", endsOn: "2026-11-20" }])).toMatchObject({ tone: "warn" });
        expect(
            suspensionGate([
                { reason: "KO", startsOn: "2026-10-01", endsOn: "2026-11-01", requiresClearance: true, clearedAt: "2026-11-02", gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-15" } as SuspensionBoardInput["gradedReturn"] },
            ]),
        ).toMatchObject({ tone: "warn" });
    });

    it("hides a suspension that has ended", () => {
        expect(suspensionGate([{ reason: "KO", startsOn: "2026-09-01", endsOn: "2026-10-01" }])).toBeUndefined();
    });
});

describe("profile tabs", () => {
    it("keep every tab inside the fighter's profile", () => {
        for (const tab of fighterTabs("f-1")) expect(tab.href.startsWith("/doctor/fighters/f-1")).toBe(true);
    });
});

describe("open profile section", () => {
    it("follows the URL under the profile, with each form under its own tab", async () => {
        const { sectionFromSegments, tabOf } = await import("./fighter-sections");
        expect(sectionFromSegments([])).toBe("overview");
        expect(sectionFromSegments(["injuries"])).toBe("injuries");
        expect(sectionFromSegments(["injuries", "inj-1"])).toBe("injuries");
        expect(sectionFromSegments(["examinations", "new"])).toBe("new-examination");
        expect(tabOf(sectionFromSegments(["examinations", "new"]))).toBe("exams");
        expect(tabOf(sectionFromSegments(["clearance", "new"]))).toBe("clearance");
        expect(sectionFromSegments(["recovery", "new"])).toBe("new-recovery");
        expect(tabOf(sectionFromSegments(["injuries", "new"]))).toBe("injuries");
    });

    it("shows each action once: in the header, for the tab it belongs to", async () => {
        const { TAB_ACTIONS } = await import("./fighter-sections");
        expect(TAB_ACTIONS.injuries).toEqual(["new-injury"]);
        expect(TAB_ACTIONS.clearance).toEqual(["new-clearance"]);
        expect(TAB_ACTIONS.exams).toEqual(["new-examination"]);
    });
});
