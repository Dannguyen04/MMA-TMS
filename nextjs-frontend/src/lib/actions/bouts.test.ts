import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

const ROSTER = ["f-minh-tran", "f-aigerim-sadykova", "f-kenji-morita", "f-diego-alvarez", "f-linh-pham", "f-marcus-hale", "f-tariq-haddad", "f-emma-lindqvist"];

const coach = vi.hoisted(() => ({
    current: null as User | null,
}));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/auth/session")>()),
    requireRole: vi.fn(async () => coach.current),
}));
// The actions read the viewer's language from a cookie; outside a request the tests use English.
vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator } = await import("@/lib/i18n/translate");
    return { getTranslator: async () => ({ locale: "en", t: createTranslator("en") }) };
});

import { addDaysToKey, dayKey } from "@/lib/format";
import { db } from "@/lib/mocks/db";
import { getDemoBout, listDemoBouts, recordDemoWeighIn, resetDemoCampStore } from "@/lib/services/bouts.demo";
import { createBoutAction, createSuspensionAction, enterFightWeekAction, recordResultAction, recordWeighInAction, updateRequirementAction } from "./bouts";
import { IDLE } from "./state";

function rafael(fighterIds = ROSTER): User {
    return {
        id: "u-rafael-costa",
        email: "rafael@example.com",
        name: "Rafael Costa",
        role: "coach",
        title: "Head Coach — Striking",
        phone: null,
        status: "active",
        createdAt: "2024-01-01T00:00:00.000Z",
        lastActiveAt: null,
        profileId: "c-rafael-costa",
        effectiveCapabilities: ["fighters:read"],
        assignmentScope: { fighterIds },
    };
}

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

const today = () => dayKey(new Date());
const at = (days: number, time: string) => `${addDaysToKey(today(), days)}T${time}`;

const newBout = (overrides: Record<string, string> = {}) =>
    form({
        fighterId: "f-minh-tran",
        rulesetId: "rs-vmmaf-2021",
        weightClassCode: "60",
        weightLimitKg: "",
        event: "Lotus Fight Night 18",
        venue: "",
        opponent: "Arman Petrosyan",
        weighInAt: at(2, "10:00"),
        boutAt: at(3, "19:00"),
        ...overrides,
    });

describe("bout actions in demo mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "demo");
        coach.current = rafael();
        navigation.redirect.mockClear();
        resetDemoCampStore();
        // Results save their suspensions in the suspensions store; start it from its seed too.
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
    });

    it("refuses a bout that starts before its weigh-in, at the bout field, and saves nothing", async () => {
        const before = listDemoBouts().length;
        await expect(createBoutAction(IDLE, newBout({ boutAt: at(2, "09:00") }))).resolves.toMatchObject({
            status: "error",
            fieldErrors: { boutAt: "The bout must start after the weigh-in." },
        });
        expect(listDemoBouts()).toHaveLength(before);
        expect(navigation.redirect).not.toHaveBeenCalled();
    });

    it("refuses a fighter who is not on the coach's roster", async () => {
        coach.current = rafael(ROSTER.filter((id) => id !== "f-minh-tran"));
        await expect(createBoutAction(IDLE, newBout())).resolves.toMatchObject({ status: "error", fieldErrors: { fighterId: "Choose a fighter on your roster." } });
    });

    it("creates a scheduled bout and opens it", async () => {
        await expect(createBoutAction(IDLE, newBout({ rulesetId: "rs-custom", weightClassCode: "", weightLimitKg: "63,5" }))).rejects.toThrow(/^redirect:\/coach\/bouts\/b-minh-tran-\d+\?notice=created$/);
        const created = listDemoBouts(["f-minh-tran"])[0];
        expect(created).toMatchObject({ phase: "SCHEDULED", limitKg: 63.5, weightClassLabel: "63.5 kg", rulesetName: "Tự nhập" });
    });

    it("keeps a bout in camp when Gate 1 refuses fight week, and lists the missing document", async () => {
        await expect(enterFightWeekAction({ status: "idle" }, form({ boutId: "b-emma-nordic" }))).resolves.toEqual({
            status: "error",
            message: "Gate 1 is not met. The bout stays in camp.",
            data: { lines: ["Chụp CT não: missing"] },
        });
        expect(getDemoBout("b-emma-nordic")?.phase).toBe("CAMP");
    });

    it("answers a bout outside the roster as not found", async () => {
        coach.current = rafael(ROSTER.filter((id) => id !== "f-emma-lindqvist"));
        await expect(enterFightWeekAction({ status: "idle" }, form({ boutId: "b-emma-nordic" }))).resolves.toMatchObject({ status: "error", message: "That bout is not on your roster." });
    });

    it("needs a valid-until date to mark a document provided", async () => {
        await expect(
            updateRequirementAction(IDLE, form({ boutId: "b-emma-nordic", code: "BRAIN_CT", state: "PROVIDED", issuedOn: today(), validUntil: "", statusReason: "" })),
        ).resolves.toMatchObject({ status: "error", fieldErrors: { validUntil: "Enter the date this document is valid until." } });
        expect(getDemoBout("b-emma-nordic")?.requirements.find((item) => item.code === "BRAIN_CT")?.state).toBe("MISSING");
    });

    it("asks for a decision after a failed hydration check and a catchweight above the original limit (T-006 §3)", async () => {
        const dry = { boutId: "b-linh-saigon", weightKg: "59,8", hydrationCheck: "FAILED", note: "Agreed with the promoter" };
        await expect(recordWeighInAction(IDLE, form(dry))).resolves.toMatchObject({ status: "error", fieldErrors: { decision: expect.any(String) } });
        await expect(recordWeighInAction(IDLE, form({ ...dry, decision: "CATCHWEIGHT", catchweightKg: "59,9" }))).resolves.toMatchObject({
            status: "error",
            fieldErrors: { catchweightKg: "The catchweight must be above the original limit of 60.0 kg." },
        });
        expect(getDemoBout("b-linh-saigon")?.phase).toBe("FIGHT_WEEK");
        await expect(recordWeighInAction(IDLE, form({ ...dry, decision: "CATCHWEIGHT", catchweightKg: "60,5" }))).resolves.toMatchObject({ status: "success" });
        expect(getDemoBout("b-linh-saigon")).toMatchObject({ phase: "WEIGHED_IN", catchweightKg: 60.5 });
    });

    it("takes a knockout's suspension days in the result form and saves the suspension with the result, as API mode does", async () => {
        const koLoss = { boutId: "bout-weighed-in", result: "LOSS", method: "KO", round: "2", lossOfConsciousness: "UNDER_1_MIN" };
        // VMMAF 2021 suggests no length, so the days are required, at the field; the bout stays weighed in.
        await expect(recordResultAction(IDLE, form({ ...koLoss, suspensionDays: "" }))).resolves.toMatchObject({
            status: "error",
            message: "This bout's ruleset suggests no suspension length. Enter the days the event rules set, then save again.",
            fieldErrors: { suspensionDays: expect.any(String) },
        });
        expect(getDemoBout("bout-weighed-in")?.phase).toBe("WEIGHED_IN");

        await expect(recordResultAction(IDLE, form({ ...koLoss, suspensionDays: "30" }))).resolves.toMatchObject({ status: "success" });
        expect(getDemoBout("bout-weighed-in")?.phase).toBe("COMPLETED");
        const saved = db().suspensions.filter((item) => item.boutId === "bout-weighed-in");
        expect(saved).toEqual([expect.objectContaining({ reason: "KO", startsOn: today(), endsOn: addDaysToKey(today(), 29), requiresClearance: true, status: "ACTIVE" })]);

        // The bout page has nothing left to confirm: a second suspension for the bout is refused.
        const confirm = form({ boutId: "bout-weighed-in", reason: "KO", startsOn: today(), days: "30", overrideReason: "", note: "" });
        confirm.append("blockedSessionTypes", "sparring");
        await expect(createSuspensionAction(IDLE, confirm)).resolves.toMatchObject({ status: "error", message: "This bout already has a suspension." });
        expect(db().suspensions.filter((item) => item.boutId === "bout-weighed-in")).toHaveLength(1);
    });

    it("refuses days that differ from the ruleset's suggestion, and uses the suggestion when they are left empty", async () => {
        recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: null, decision: null, catchweightKg: null, note: null }, { name: "Rafael Costa" }, new Date());
        // AIBA: Linh's KO five weeks ago makes this her second within 90 days.
        const koLoss = { boutId: "b-linh-saigon", result: "LOSS", method: "KO", round: "2", lossOfConsciousness: "NONE" };
        await expect(recordResultAction(IDLE, form({ ...koLoss, suspensionDays: "45" }))).resolves.toMatchObject({
            status: "error",
            fieldErrors: { suspensionDays: "This bout's ruleset suggests 90 days of suspension. Leave the days empty to use them, or enter 90." },
        });
        await expect(recordResultAction(IDLE, form({ ...koLoss, suspensionDays: "" }))).resolves.toMatchObject({ status: "success" });
        expect(db().suspensions.filter((item) => item.boutId === "b-linh-saigon")).toEqual([expect.objectContaining({ reason: "KO", suggestedDays: 90 })]);
    });
});
