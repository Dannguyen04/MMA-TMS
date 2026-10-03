import { describe, expect, it } from "vitest";

import { SESSION_TYPES } from "./medical-contract";
import { planBody, SERVICE_TRAINING_TYPES, sessionBody, sessionStatusBody, sessionTypeFor, TRAINING_TYPE_FOR } from "./training-contract";

describe("training contract", () => {
    it("maps every service session type to an interface type, and back for the types the service has", () => {
        for (const type of SESSION_TYPES) expect(TRAINING_TYPE_FOR[type]).toBeDefined();
        for (const type of SERVICE_TRAINING_TYPES) expect(TRAINING_TYPE_FOR[sessionTypeFor(type) ?? "RECOVERY"]).toBe(type);
        expect(sessionTypeFor("technical_drilling")).toBeNull();
    });

    it("sends plan dates as academy days and empty text as null", () => {
        expect(planBody({ title: "  Camp ", objective: " ", notes: "Sparring capped", startDate: "2026-08-31T17:00:00.000Z", endDate: "2026-10-01T16:59:59.999Z" })).toEqual({
            title: "Camp",
            goals: null,
            description: "Sparring capped",
            startDate: "2026-09-01",
            endDate: "2026-10-01",
        });
    });

    it("leaves a session body out for a training type the service doesn't have", () => {
        const fields = { title: "Drills", scheduledAt: "2026-09-10T10:00:00.000Z", durationMin: 45, location: "", notes: null };
        expect(sessionBody({ ...fields, type: "technical_drilling" })).toBeNull();
        expect(sessionBody({ ...fields, type: "recovery_mobility" })).toMatchObject({ sessionType: "RECOVERY", plannedDurationSec: 2700, location: null });
    });

    it("sends a cancellation reason only with a cancellation", () => {
        expect(sessionStatusBody("CANCELLED", " Coach unwell ")).toEqual({ status: "CANCELLED", cancellationReason: "Coach unwell" });
        expect(sessionStatusBody("IN_PROGRESS", "ignored")).toEqual({ status: "IN_PROGRESS" });
    });
});
