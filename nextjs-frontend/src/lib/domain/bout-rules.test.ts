import { describe, expect, it } from "vitest";

import { dayKey } from "@/lib/format";

import { BOUT_PHASES, type BoutPhase, type BoutRequirement } from "./bout";
import {
    acuteLossLimitPct,
    awaitsWeighInDecision,
    canEnterFightWeek,
    canRecordResult,
    canTransition,
    campStartedOn,
    checklistLocked,
    computeAcuteLoss,
    gate1,
    gateSummary,
    madeWeight,
    methodsFor,
    passesWeighIn,
    readDueDays,
    readWeightClass,
    requirementCode,
    requirementsDueOn,
    requirementsDueSoon,
    requirementsFromTemplates,
    requirementsOverdue,
    roundRuleFor,
    scheduleSummary,
    suggestedValidUntil,
    validateBoutSchedule,
    validateNewRequirement,
    validateOutcome,
    validateRequirementUpdate,
    wallClockIso,
} from "./bout-rules";
import { buildWeightTrack } from "./weight-track";

const RULES = { acuteLossLimitPctLong: 8, acuteLossLimitPctShort: 5 };
const VMMAF = { weightClasses: [44, 48, 52, 56, 60, 65].map((kg) => ({ code: String(kg), label: `${kg} kg`, limitKg: kg })) };
const CUSTOM = { weightClasses: [] };

function item(overrides: Partial<BoutRequirement> = {}): BoutRequirement {
    return {
        id: "BRAIN_CT",
        code: "BRAIN_CT",
        label: "Brain CT",
        required: true,
        state: "PROVIDED",
        source: "COACH",
        issuedOn: "2026-10-01",
        validUntil: "2027-04-01",
        statusReason: null,
        validityDays: 180,
        ...overrides,
    };
}

function bout(overrides: Partial<Parameters<typeof canEnterFightWeek>[0] & { requirementsDueDays: number; checklistUnlock: null }> = {}) {
    return {
        phase: "CAMP" as BoutPhase,
        weighInAt: wallClockIso("2026-10-22T10:00"),
        boutAt: wallClockIso("2026-10-23T19:00"),
        fightWeekDays: 7,
        requirementsDueDays: 7,
        requirements: [item()],
        checklistUnlock: null,
        ...overrides,
    };
}

describe("academy dates (T-003 criterion 3)", () => {
    it("reads 17:30 UTC on 20 Oct as 21 Oct in Vietnam", () => {
        expect(dayKey("2026-10-20T17:30:00Z")).toBe("2026-10-21");
    });

    it("turns an academy wall-clock value into UTC", () => {
        expect(wallClockIso("2026-10-22T10:00")).toBe("2026-10-22T03:00:00.000Z");
    });
});

describe("acute-loss limit snapshot (T-003 criterion 2)", () => {
    it.each([
        ["24 hours", "2026-10-22T10:00", "2026-10-23T10:00", 8],
        ["exactly 12 hours", "2026-10-22T07:00", "2026-10-22T19:00", 8],
        ["6 hours", "2026-10-22T13:00", "2026-10-22T19:00", 5],
    ])("weigh-in %s before the bout uses %s", (_label, weighIn, boutAt, expected) => {
        expect(acuteLossLimitPct(wallClockIso(weighIn), wallClockIso(boutAt), RULES)).toBe(expected);
    });

    it("previews days to weigh-in, the gap in hours and the limit", () => {
        expect(scheduleSummary(wallClockIso("2026-10-22T08:00"), wallClockIso("2026-10-22T18:00"), RULES, "2026-10-20")).toEqual({
            daysToWeighIn: 2,
            gapHours: 10,
            acuteLossLimitPct: 5,
        });
    });
});

describe("weight warning (T-003 criterion 1, Business flows §6)", () => {
    const base = { limitKg: 60, acuteLossLimitPct: 8, acuteWindowDays: 7, campStartedOn: "2026-10-01", weighInOn: "2026-10-22", todayOn: "2026-10-20" };

    it("is red at 66 kg two days out and green at 64.5 kg", () => {
        expect(buildWeightTrack({ ...base, points: [{ date: "2026-10-20", kg: 66 }] })).toMatchObject({ status: "RED", remainingPct: 9.1 });
        expect(buildWeightTrack({ ...base, points: [{ date: "2026-10-20", kg: 64.5 }] })).toMatchObject({ status: "GREEN", remainingPct: 7 });
    });

    it("is grey without a weight in the last three days", () => {
        expect(buildWeightTrack({ ...base, points: [{ date: "2026-10-17", kg: 64 }] }).status).toBe("GREY");
    });

    it("is yellow 20 days out when the weight is 1.5 kg above the reference line", () => {
        const points = [
            { date: "2026-10-01", kg: 66 },
            { date: "2026-10-20", kg: 0 },
        ];
        const reference = buildWeightTrack({ ...base, weighInOn: "2026-11-09", points: [points[0]] }).referencePath.find((point) => point.date === "2026-10-20")!.kg;
        points[1].kg = Math.round((reference + 1.5) * 10) / 10;
        expect(buildWeightTrack({ ...base, weighInOn: "2026-11-09", points }).status).toBe("YELLOW");
    });

    it("has no reference or remaining share for an open class", () => {
        expect(buildWeightTrack({ ...base, limitKg: null, points: [{ date: "2026-10-20", kg: 130 }] })).toMatchObject({ status: "GREEN", remainingPct: null, referencePath: [] });
    });
});

describe("Gate 1 (T-003 criterion 4, Business flows F4)", () => {
    const boutDay = "2026-10-23";

    it("lists exactly the required item that is missing", () => {
        const result = gate1([item({ code: "HEALTH", label: "Health certificate" }), item({ state: "MISSING", validUntil: null })], boutDay);
        expect(result.passed).toBe(false);
        expect(result.missing.map((gap) => [gap.requirement.label, gap.reason])).toEqual([["Brain CT", "MISSING"]]);
    });

    it("fails a provided item that runs out before the bout day", () => {
        expect(gate1([item({ validUntil: "2026-10-22" })], boutDay).missing[0]?.reason).toBe("EXPIRED");
        expect(gate1([item({ validUntil: boutDay })], boutDay).passed).toBe(true);
    });

    it("passes when an optional item is still missing", () => {
        expect(gate1([item(), item({ code: "EYE", label: "Eye exam", required: false, state: "MISSING", validUntil: null })], boutDay).passed).toBe(true);
    });

    it("fails a rejected required item", () => {
        expect(gate1([item({ state: "REJECTED", statusReason: "Blurry scan" })], boutDay).missing[0]?.reason).toBe("REJECTED");
    });

    it("summarises the checklist in one line", () => {
        const list = [item({ code: "HEALTH", label: "Health certificate" }), item({ code: "BLOOD", label: "Blood test" }), item({ state: "MISSING", validUntil: null })];
        expect(gateSummary(list, boutDay)).toBe("2 of 3 ready · Brain CT missing");
        expect(gateSummary([item({ validUntil: "2026-10-22" })], boutDay)).toBe("0 of 1 ready · Brain CT expires before the bout");
        expect(gateSummary([], boutDay)).toBe("No documents listed");
    });
});

describe("deadlines and fight week", () => {
    it("puts the documents deadline seven days before weigh-in and flags it late after that", () => {
        const late = bout({ requirements: [item({ state: "MISSING", validUntil: null })] });
        expect(requirementsDueOn(late)).toBe("2026-10-15");
        expect(requirementsOverdue(late, "2026-10-15")).toBe(false);
        expect(requirementsOverdue(late, "2026-10-16")).toBe(true);
        expect(requirementsOverdue(bout(), "2026-10-16")).toBe(false);
    });

    it("warns about missing documents from 14 days before the deadline", () => {
        const missing = bout({ requirements: [item({ state: "MISSING", validUntil: null })] });
        expect(requirementsDueSoon(missing, "2026-09-30")).toEqual([]);
        expect(requirementsDueSoon(missing, "2026-10-01")).toHaveLength(1);
        expect(requirementsDueSoon({ ...missing, phase: "FIGHT_WEEK" }, "2026-10-10")).toEqual([]);
    });

    it("opens fight week seven days before weigh-in and checks Gate 1", () => {
        expect(canEnterFightWeek(bout(), "2026-10-14")).toMatchObject({ ok: false, reason: "TOO_EARLY", opensOn: "2026-10-15" });
        expect(canEnterFightWeek(bout(), "2026-10-15")).toEqual({ ok: true });
        expect(canEnterFightWeek(bout({ requirements: [item({ state: "MISSING", validUntil: null })] }), "2026-10-20")).toMatchObject({
            ok: false,
            reason: "REQUIREMENTS_INCOMPLETE",
            missing: [expect.objectContaining({ reason: "MISSING" })],
        });
        expect(canEnterFightWeek(bout({ phase: "SCHEDULED" }), "2026-10-20")).toMatchObject({ ok: false, reason: "NOT_IN_CAMP" });
    });

    it("locks the checklist in fight week unless a coach unlocked it", () => {
        expect(checklistLocked({ phase: "CAMP", checklistUnlock: null })).toBe(false);
        expect(checklistLocked({ phase: "FIGHT_WEEK", checklistUnlock: null })).toBe(true);
        expect(checklistLocked({ phase: "FIGHT_WEEK", checklistUnlock: { at: "", by: "Rafael", reason: "Organiser asked for an ECG" } })).toBe(false);
        expect(checklistLocked({ phase: "COMPLETED", checklistUnlock: null })).toBe(true);
    });

    it("starts the camp on the linked plan's first day, or the day the bout was created", () => {
        expect(campStartedOn({ createdOn: "2026-10-20" }, { startDate: "2026-09-21T17:00:00.000Z" })).toBe("2026-09-22");
        expect(campStartedOn({ createdOn: "2026-10-20" }, null)).toBe("2026-10-20");
    });
});

describe("status transitions (T-003 criterion 5)", () => {
    it.each([
        ["SCHEDULED", "CAMP"],
        ["CAMP", "FIGHT_WEEK"],
        ["FIGHT_WEEK", "WEIGHED_IN"],
        ["WEIGHED_IN", "COMPLETED"],
        ["SCHEDULED", "CANCELLED"],
        ["CAMP", "CANCELLED"],
        ["FIGHT_WEEK", "CANCELLED"],
        ["WEIGHED_IN", "CANCELLED"],
    ] as const)("allows %s → %s", (from, to) => {
        expect(canTransition(from, to)).toBe(true);
    });

    it("refuses everything else, including COMPLETED → CANCELLED and CANCELLED → CAMP", () => {
        const allowed = new Set(["SCHEDULED>CAMP", "CAMP>FIGHT_WEEK", "FIGHT_WEEK>WEIGHED_IN", "WEIGHED_IN>COMPLETED", "SCHEDULED>CANCELLED", "CAMP>CANCELLED", "FIGHT_WEEK>CANCELLED", "WEIGHED_IN>CANCELLED"]);
        for (const from of BOUT_PHASES) {
            for (const to of BOUT_PHASES) {
                expect(canTransition(from, to), `${from} → ${to}`).toBe(allowed.has(`${from}>${to}`));
            }
        }
        expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
        expect(canTransition("CANCELLED", "CAMP")).toBe(false);
    });
});

describe("creating a bout (F1, T-004 criteria 2 and 3)", () => {
    const now = new Date("2026-10-20T01:00:00.000Z");
    const input = {
        event: " Lotus Fight Night 18 ",
        venue: "",
        opponent: "",
        weightClassCode: "60",
        weightLimitKg: "",
        weighInAt: "2026-10-22T10:00",
        boutAt: "2026-10-23T19:00",
    };

    it("accepts a preset class and leaves the opponent for later", () => {
        expect(validateBoutSchedule(input, VMMAF, now)).toEqual({
            ok: true,
            value: {
                event: "Lotus Fight Night 18",
                venue: null,
                opponent: null,
                weightClass: { code: "60", label: "60 kg", limitKg: 60 },
                weighInAt: "2026-10-22T03:00:00.000Z",
                boutAt: "2026-10-23T12:00:00.000Z",
            },
        });
    });

    it("stores a custom limit of 63,5 kg as 63.5", () => {
        const result = validateBoutSchedule({ ...input, weightClassCode: "", weightLimitKg: "63,5" }, CUSTOM, now);
        expect(result).toMatchObject({ ok: true, value: { weightClass: { code: "63.5", label: "63.5 kg", limitKg: 63.5 } } });
    });

    it("refuses a bout before its weigh-in at the bout field", () => {
        expect(validateBoutSchedule({ ...input, boutAt: "2026-10-22T09:00" }, VMMAF, now)).toEqual({ ok: false, fieldErrors: { boutAt: "The bout must start after the weigh-in." } });
        expect(validateBoutSchedule({ ...input, boutAt: "2026-10-22T10:00" }, VMMAF, now)).toMatchObject({ ok: false, fieldErrors: { boutAt: expect.any(String) } });
    });

    it("refuses a bout in the past", () => {
        expect(validateBoutSchedule({ ...input, weighInAt: "2026-10-18T10:00", boutAt: "2026-10-19T19:00" }, VMMAF, now)).toEqual({
            ok: false,
            fieldErrors: { boutAt: "The bout must be in the future." },
        });
    });

    it("needs an event name, a class from the list and both times", () => {
        const result = validateBoutSchedule({ ...input, event: "  ", weightClassCode: "61", weighInAt: "", boutAt: "tomorrow" }, VMMAF, now);
        expect(result).toEqual({
            ok: false,
            fieldErrors: {
                event: "Enter the event name.",
                weightClassCode: "Choose a weight class from the list.",
                weighInAt: "Enter the weigh-in date and time.",
                boutAt: "Enter the bout date and time.",
            },
        });
        expect(validateBoutSchedule({ ...input, event: "x".repeat(121) }, VMMAF, now)).toMatchObject({ ok: false, fieldErrors: { event: expect.any(String) } });
    });

    it.each(["0", "250", "heavy", "63.55", "-60", "63, 5"])("refuses the custom limit %s", (raw) => {
        expect(readWeightClass(CUSTOM, "", raw).ok).toBe(false);
    });

    it("reads the documents deadline as 0 to 60 whole days", () => {
        expect(readDueDays("7")).toEqual({ ok: true, value: 7 });
        expect(readDueDays("0")).toEqual({ ok: true, value: 0 });
        expect(readDueDays("61").ok).toBe(false);
        expect(readDueDays("3.5").ok).toBe(false);
    });
});

describe("medical checklist items", () => {
    it("names a code after the label, unique on the bout", () => {
        expect(requirementCode("Health certificate", [])).toBe("HEALTH_CERTIFICATE");
        expect(requirementCode("Giấy khám sức khỏe", [])).toBe("GIAY_KHAM_SUC_KHOE");
        expect(requirementCode("Brain CT", ["BRAIN_CT"])).toBe("BRAIN_CT_2");
    });

    it("needs a label, refuses duplicates and reads the validity in days", () => {
        expect(validateNewRequirement({ label: " Brain CT ", required: true, validityDays: "365" }, [])).toEqual({ ok: true, value: { label: "Brain CT", required: true, validityDays: 365 } });
        expect(validateNewRequirement({ label: "", required: true, validityDays: "" }, [])).toMatchObject({ ok: false, fieldErrors: { label: expect.any(String) } });
        expect(validateNewRequirement({ label: "brain ct", required: true, validityDays: "" }, ["Brain CT"])).toMatchObject({ ok: false, fieldErrors: { label: "This bout already lists that document." } });
        expect(validateNewRequirement({ label: "ECG", required: false, validityDays: "0" }, [])).toMatchObject({ ok: false, fieldErrors: { validityDays: expect.any(String) } });
    });

    it("needs a valid-until date for a provided document and a reason for a rejected one (T-004 criterion 4)", () => {
        expect(validateRequirementUpdate({ state: "PROVIDED", issuedOn: "2026-10-01", validUntil: "", statusReason: "" })).toEqual({
            ok: false,
            fieldErrors: { validUntil: "Enter the date this document is valid until." },
        });
        expect(validateRequirementUpdate({ state: "REJECTED", issuedOn: "", validUntil: "", statusReason: " " })).toMatchObject({ ok: false, fieldErrors: { statusReason: expect.any(String) } });
        expect(validateRequirementUpdate({ state: "PROVIDED", issuedOn: "2026-10-10", validUntil: "2026-10-01", statusReason: "" })).toMatchObject({ ok: false, fieldErrors: { validUntil: expect.any(String) } });
        expect(validateRequirementUpdate({ state: "CONFIRMED", issuedOn: "", validUntil: "2027-01-01", statusReason: "" })).toMatchObject({ ok: false, fieldErrors: { state: "Only a doctor can confirm a document." } });
    });

    it("clears the dates of a missing document and keeps a provided one's", () => {
        expect(validateRequirementUpdate({ state: "MISSING", issuedOn: "2026-10-01", validUntil: "2027-01-01", statusReason: "x" })).toEqual({
            ok: true,
            value: { state: "MISSING", issuedOn: null, validUntil: null, statusReason: null },
        });
        expect(validateRequirementUpdate({ state: "PROVIDED", issuedOn: "2026-10-01", validUntil: "2027-03-30", statusReason: "x" })).toEqual({
            ok: true,
            value: { state: "PROVIDED", issuedOn: "2026-10-01", validUntil: "2027-03-30", statusReason: null },
        });
    });

    it("suggests the valid-until date from the issue date and the validity", () => {
        expect(suggestedValidUntil("2026-10-01", 180)).toBe("2027-03-30");
        expect(suggestedValidUntil("2026-10-01", null)).toBeNull();
    });

    it("starts a ruleset's checklist with every item missing (Business flows §6)", () => {
        const items = requirementsFromTemplates({
            requirementTemplates: [
                { code: "A", label: "A", required: true, validityDays: 30 },
                { code: "B", label: "B", required: true, validityDays: null },
                { code: "C", label: "C", required: false, validityDays: null },
            ],
        });
        expect(items).toHaveLength(3);
        expect(items.every((entry) => entry.state === "MISSING" && entry.source === "PRESET")).toBe(true);
        expect(requirementsFromTemplates({ requirementTemplates: [] })).toEqual([]);
    });
});

describe("result (F6)", () => {
    const base = { result: "WIN", method: "DECISION", round: "", knockedDown: false, lossOfConsciousness: "", stoppedByHeadStrikes: "", injuryNote: "", notes: "" };

    it("records a decision without a round", () => {
        expect(validateOutcome(base, "MMA", "2026-10-23T15:00:00.000Z")).toMatchObject({ ok: true, value: { result: "WIN", method: "DECISION", round: null } });
    });

    it("asks about consciousness after a KO loss and about head strikes after a TKO loss (H3)", () => {
        expect(validateOutcome({ ...base, result: "LOSS", method: "KO", round: "2" }, "MMA", "")).toMatchObject({ ok: false, fieldErrors: { lossOfConsciousness: expect.any(String) } });
        expect(validateOutcome({ ...base, result: "LOSS", method: "TKO", round: "2", lossOfConsciousness: "NONE" }, "MMA", "")).toMatchObject({
            ok: false,
            fieldErrors: { stoppedByHeadStrikes: expect.any(String) },
        });
        expect(validateOutcome({ ...base, result: "LOSS", method: "TKO", round: "2", lossOfConsciousness: "NONE", stoppedByHeadStrikes: "no" }, "MMA", "")).toMatchObject({
            ok: true,
            value: { stoppedByHeadStrikes: false, lossOfConsciousness: "NONE" },
        });
    });

    it("allows a submission only in MMA and a round from 1 to 12", () => {
        expect(methodsFor("BOXING")).not.toContain("SUBMISSION");
        expect(validateOutcome({ ...base, method: "SUBMISSION" }, "BOXING", "")).toMatchObject({ ok: false, fieldErrors: { method: "A submission ends MMA bouts only." } });
        expect(validateOutcome({ ...base, round: "13" }, "MMA", "")).toMatchObject({ ok: false, fieldErrors: { round: expect.any(String) } });
    });

    it("names the round of a stoppage and none for a decision (T-006 criterion 12)", () => {
        expect(roundRuleFor("KO")).toBe("REQUIRED");
        expect(roundRuleFor("SUBMISSION")).toBe("REQUIRED");
        expect(roundRuleFor("DECISION")).toBe("NOT_ALLOWED");
        expect(roundRuleFor("DQ")).toBe("OPTIONAL");
        expect(validateOutcome({ ...base, result: "WIN", method: "KO" }, "MMA", "")).toMatchObject({ ok: false, fieldErrors: { round: "Enter the round the bout was stopped in." } });
        expect(validateOutcome({ ...base, round: "3" }, "MMA", "")).toMatchObject({ ok: false, fieldErrors: { round: "A decision goes the distance: leave the round empty." } });
        expect(validateOutcome({ ...base, method: "DQ" }, "MMA", "")).toMatchObject({ ok: true, value: { round: null } });
        expect(validateOutcome({ ...base, method: "DQ", round: "2" }, "MMA", "")).toMatchObject({ ok: true, value: { round: 2 } });
    });

    it("is recorded from the bout day, once weighed in", () => {
        const weighed = { phase: "WEIGHED_IN" as BoutPhase, boutAt: wallClockIso("2026-10-23T19:00") };
        expect(canRecordResult(weighed, "2026-10-22")).toEqual({ ok: false, reason: "BOUT_NOT_STARTED" });
        expect(canRecordResult(weighed, "2026-10-23")).toEqual({ ok: true });
        expect(canRecordResult({ ...weighed, phase: "FIGHT_WEEK" }, "2026-10-23")).toEqual({ ok: false, reason: "NOT_WEIGHED_IN" });
    });
});

describe("official weigh-in (T-006 §3, R17–R19)", () => {
    it("makes weight at the limit exactly, and misses just over it (T-006 criterion 5)", () => {
        expect(madeWeight(60, 60)).toBe(true);
        expect(madeWeight(59.8, 60)).toBe(true);
        expect(madeWeight(60.5, 60)).toBe(false);
        expect(madeWeight(0.1 + 0.2, 0.3)).toBe(true);
        expect(madeWeight(95, null)).toBe(true);
    });

    it("counts a failed hydration check as a miss even on the limit (T-006 criterion 6)", () => {
        expect(passesWeighIn(59.8, 60, "FAILED")).toBe(false);
        expect(passesWeighIn(59.8, 60, "PASSED")).toBe(true);
        expect(passesWeighIn(59.8, 60, null)).toBe(true);
        expect(passesWeighIn(60.5, 60, "PASSED")).toBe(false);
    });

    it("waits for the coach's choice after a miss the service holds", () => {
        const weighIn = { weightKg: 60.5, madeWeight: false, hydrationCheck: null, recordedAt: "", catchweightNote: null, acuteLoss: null };
        expect(awaitsWeighInDecision({ phase: "FIGHT_WEEK", weighIn })).toBe(true);
        expect(awaitsWeighInDecision({ phase: "FIGHT_WEEK", weighIn: { ...weighIn, weightKg: 59.8, madeWeight: true, hydrationCheck: "FAILED" } })).toBe(true);
        expect(awaitsWeighInDecision({ phase: "WEIGHED_IN", weighIn })).toBe(false);
        expect(awaitsWeighInDecision({ phase: "FIGHT_WEEK", weighIn: null })).toBe(false);
    });

    describe("acute loss (T-006 criterion 3)", () => {
        const weights = [
            { on: "2026-10-14", kg: 67.5 },
            { on: "2026-10-16", kg: 66.0 },
            { on: "2026-10-20", kg: 62.4 },
        ];

        it("measures from the earliest weight in the window", () => {
            expect(computeAcuteLoss(weights, 60.8, "2026-10-23", 7, 8)).toEqual({ status: "WITHIN", startKg: 66, startOn: "2026-10-16", lossPct: 7.9, limitPct: 8 });
            expect(computeAcuteLoss(weights, 60.0, "2026-10-23", 7, 8)).toMatchObject({ status: "EXCEEDED", lossPct: 9.1 });
        });

        it("has no data without a weight in the window", () => {
            expect(computeAcuteLoss([{ on: "2026-10-01", kg: 70 }], 60, "2026-10-23", 7, 8)).toEqual({ status: "NO_DATA", startKg: null, startOn: null, lossPct: null, limitPct: 8 });
        });
    });
});
