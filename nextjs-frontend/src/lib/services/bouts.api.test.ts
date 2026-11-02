import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/api/client")>();
    return { ...original, authenticatedApiRequest, authenticatedMutableApiRequest };
});
const locale = vi.hoisted(() => ({ current: "en" as "en" | "vi" }));
vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator } = await import("@/lib/i18n/translate");
    return { getTranslator: async () => ({ locale: locale.current, t: createTranslator(locale.current) }) };
});

import { ApiError } from "@/lib/api/client";
import {
    addApiRequirement,
    enterApiFightWeek,
    linkApiCamp,
    listApiRulesets,
    recordApiResult,
    recordApiWeighIn,
    removeApiRequirement,
    updateApiRequirement,
} from "./bouts.api";

const refused = (status: number, code: string, details?: unknown) => new ApiError({ message: "Refused in English", kind: "http", status, code, details });
const failedWeighIn = { weighIn: { outcome: "FAILED", reason: "OVER_LIMIT", overByKg: 0.5, overByPct: 0.8, options: ["CATCHWEIGHT", "CANCEL"] } };
const passedWeighIn = { weighIn: { outcome: "PASSED", reason: null, overByKg: null, overByPct: null, options: [] } };
const miss = { weightKg: 60.5, hydrationCheck: null, catchweightKg: null, note: null };

describe("bouts API adapter", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        locale.current = "en";
    });

    it("says the service isn't there yet on 403 or 404, instead of throwing", async () => {
        authenticatedMutableApiRequest.mockRejectedValue(new ApiError({ message: "Forbidden", kind: "http", status: 403 }));
        await expect(linkApiCamp("b-1", "tp-1")).resolves.toEqual({ ok: false, message: "Bouts are not available from the server yet." });
        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "Not found", kind: "http", status: 404 }));
        await expect(listApiRulesets()).resolves.toEqual([]);
    });

    it("passes the service's own message when Gate 1 refuses fight week", async () => {
        authenticatedMutableApiRequest.mockRejectedValue(new ApiError({ message: "Brain CT is missing.", kind: "http", status: 409, code: "BOUT_REQUIREMENTS_INCOMPLETE" }));
        await expect(enterApiFightWeek("b-1")).resolves.toEqual({ ok: false, message: "Brain CT is missing.", lines: [] });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/fight-week", expect.anything(), { method: "POST" });
    });

    it("patches a requirement by code", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({});
        await expect(updateApiRequirement("b-1", "BRAIN_CT", { state: "PROVIDED", issuedOn: null, validUntil: "2027-01-01", statusReason: null })).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/requirements/BRAIN_CT", expect.anything(), {
            method: "PATCH",
            body: JSON.stringify({ status: "PROVIDED", issuedOn: null, validUntil: "2027-01-01", statusReason: null }),
        });
    });

    it("weighs in once when the fighter makes weight", async () => {
        authenticatedMutableApiRequest.mockResolvedValue(passedWeighIn);
        await expect(recordApiWeighIn("b-1", { ...miss, weightKg: 59.8, decision: null }, false)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledTimes(1);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/weigh-in", expect.anything(), { method: "POST", body: JSON.stringify({ weightKg: 59.8 }) });
    });

    it("agrees the catchweight right after a miss (T-006 criteria 5 and 7)", async () => {
        authenticatedMutableApiRequest.mockResolvedValueOnce(failedWeighIn).mockResolvedValueOnce({});
        await expect(recordApiWeighIn("b-1", { ...miss, decision: "CATCHWEIGHT", catchweightKg: 61, note: "20% purse" }, false)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenLastCalledWith("/bouts/b-1/catchweight", expect.anything(), {
            method: "POST",
            body: JSON.stringify({ catchweightKg: 61, note: "20% purse" }),
        });
    });

    it("cancels a held miss without weighing again", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({});
        await expect(recordApiWeighIn("b-1", { ...miss, decision: "CANCEL", note: "Over by 0.5 kg" }, true)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledTimes(1);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/cancel", expect.anything(), { method: "POST", body: JSON.stringify({ reason: "MISSED_WEIGHT: Over by 0.5 kg" }) });
    });

    it("asks for the coach's choice when the service counts a miss the form didn't expect", async () => {
        authenticatedMutableApiRequest.mockResolvedValue(failedWeighIn);
        await expect(recordApiWeighIn("b-1", { ...miss, decision: null }, false)).resolves.toMatchObject({ ok: false, fieldErrors: { decision: expect.any(String) } });
    });

    it("says the service's refusals in the viewer's language, with its date", async () => {
        locale.current = "vi";
        authenticatedMutableApiRequest.mockRejectedValue(refused(409, "BOUT_WEIGH_IN_TOO_EARLY", { earliestOn: "2026-10-30" }));
        await expect(recordApiWeighIn("b-1", { ...miss, decision: null }, false)).resolves.toEqual({ ok: false, message: expect.stringMatching(/^Cân chính thức mở từ ngày .*30/) });
        authenticatedMutableApiRequest.mockRejectedValue(refused(422, "BOUT_RESULT_INVALID", { reason: "ROUND_REQUIRED" }));
        const ko = { result: "WIN", method: "KO", round: null, knockedDown: false, lossOfConsciousness: null, stoppedByHeadStrikes: null, injuryNote: null, notes: null, recordedAt: "" } as const;
        await expect(recordApiResult("b-1", ko)).resolves.toEqual({ ok: false, message: "Nhập hiệp mà trận đấu dừng lại." });
        authenticatedMutableApiRequest.mockRejectedValue(refused(409, "SOMETHING_NEW"));
        await expect(recordApiResult("b-1", ko)).resolves.toEqual({ ok: false, message: "Refused in English" });
    });

    it("sends the coach's unlock reason with fight-week checklist changes (T-006 §2)", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({});
        await addApiRequirement("b-1", { code: "BRAIN_CT", label: "Brain CT", required: true, validityDays: null }, "Event doctor asked again");
        expect(authenticatedMutableApiRequest).toHaveBeenLastCalledWith("/bouts/b-1/requirements", expect.anything(), {
            method: "POST",
            body: JSON.stringify({ code: "BRAIN_CT", label: "Brain CT", required: true, unlockReason: "Event doctor asked again" }),
        });
        await removeApiRequirement("b-1", "BRAIN_CT", "Wrong document");
        expect(authenticatedMutableApiRequest).toHaveBeenLastCalledWith("/bouts/b-1/requirements/BRAIN_CT?unlockReason=Wrong+document", expect.anything(), { method: "DELETE" });
        await removeApiRequirement("b-1", "BRAIN_CT");
        expect(authenticatedMutableApiRequest).toHaveBeenLastCalledWith("/bouts/b-1/requirements/BRAIN_CT", expect.anything(), { method: "DELETE" });
    });
});
