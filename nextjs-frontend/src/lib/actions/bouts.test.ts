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
import { getDemoBout, listDemoBouts, recordDemoResult, recordDemoWeighIn, resetDemoCampStore } from "@/lib/services/bouts.demo";
import { createBoutAction, createSuspensionAction, enterFightWeekAction, updateRequirementAction } from "./bouts";
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
            data: { lines: ["Brain CT: missing"] },
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

    it("works out the suggested suspension itself and asks why the days changed", async () => {
        const now = new Date();
        recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: null, decision: null, catchweightKg: null, note: null }, { name: "Rafael Costa" }, now);
        recordDemoResult(
            "b-linh-saigon",
            { result: "LOSS", method: "KO", round: 2, knockedDown: true, lossOfConsciousness: "NONE", stoppedByHeadStrikes: null, injuryNote: null, notes: null, recordedAt: now.toISOString() },
            { name: "Rafael Costa" },
            now,
        );
        const fields = { boutId: "b-linh-saigon", reason: "KO", startsOn: today(), days: "45", overrideReason: "", note: "" };
        const data = form(fields);
        data.append("blockedSessionTypes", "sparring");
        // AIBA suggests 30 days for a first KO: 45 needs a reason.
        await expect(createSuspensionAction(IDLE, data)).resolves.toMatchObject({ status: "error", fieldErrors: { overrideReason: "Say why this differs from the 30 days the ruleset suggests." } });
        data.set("days", "30");
        await expect(createSuspensionAction(IDLE, data)).resolves.toMatchObject({ status: "success" });
    });
});
