import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULED_ROUNDS, SCHEDULED_ROUND_CHOICES } from "./bout";

describe("scheduled round choices (T-075)", () => {
    it("C1: offers 2, 3 and 5 rounds in ascending order", () => {
        expect([...SCHEDULED_ROUND_CHOICES]).toEqual([2, 3, 5]);
    });

    it("C2: defaults to 3 rounds, which is one of the choices", () => {
        expect(DEFAULT_SCHEDULED_ROUNDS).toBe(3);
        expect(SCHEDULED_ROUND_CHOICES).toContain(DEFAULT_SCHEDULED_ROUNDS);
    });
});
