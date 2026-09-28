import { describe, expect, it } from "vitest";

import { sortTriage, type TriageSortable } from "./triage-sort";

const item = (id: string, tone: TriageSortable["tone"], at?: string) => ({ id, tone, at });

describe("sortTriage", () => {
    it("puts blocking items first, then warnings, AI observations and routine items", () => {
        const sorted = sortTriage([item("routine", "info"), item("ai", "ai"), item("soon", "warning"), item("blocked", "danger"), item("other", "neutral")]);
        expect(sorted.map((entry) => entry.id)).toEqual(["blocked", "soon", "ai", "routine", "other"]);
    });

    it("never files an overdue follow-up under a clearance that only expires soon", () => {
        const expiring = item("expiring", "warning", "2026-10-02T00:00:00.000Z");
        const overdue = item("overdue", "danger", "2026-09-20T00:00:00.000Z");
        expect(sortTriage([expiring, overdue]).map((entry) => entry.id)).toEqual(["overdue", "expiring"]);
    });

    it("orders the same urgency by due time, earliest first, undated last", () => {
        const sorted = sortTriage([item("undated", "warning"), item("later", "warning", "2026-10-09T00:00:00.000Z"), item("sooner", "warning", "2026-10-01T00:00:00.000Z")]);
        expect(sorted.map((entry) => entry.id)).toEqual(["sooner", "later", "undated"]);
    });

    it("keeps the input order for equal items and doesn't mutate it", () => {
        const input = [item("a", "danger"), item("b", "danger")];
        expect(sortTriage(input).map((entry) => entry.id)).toEqual(["a", "b"]);
        expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
    });
});
