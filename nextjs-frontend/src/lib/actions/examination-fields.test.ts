import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkFollowUpDate, scat6Field, scat6Issues } from "./examination-fields";

describe("examination fields", () => {
    it("reports a bad alternate-row number on the row's text field, other SCAT6 issues where they are", () => {
        const scat6 = scat6Field.safeParse(
            JSON.stringify({ status: "ADMINISTERED", dualTaskGait: { performed: true, sequence: { kind: "ALTERNATE", startingInteger: 90, responses: [83, 76.5], trial: { completed: false } } } }),
        );
        const paths = scat6Issues(scat6).map((issue) => issue.path.join("."));
        expect(paths).toContain("scat6.dualTaskGait.sequence.responses");
        expect(paths.some((path) => /responses\.\d/.test(path))).toBe(false);
        expect(paths).toContain("scat6.examinerAttestation");
    });

    it("books a follow-up after the examination day", () => {
        const schema = z.object({ followUpDate: z.string(), examinedAt: z.string() }).superRefine((input, ctx) => checkFollowUpDate(input.followUpDate, input.examinedAt, ctx));
        expect(schema.safeParse({ followUpDate: "2026-09-01", examinedAt: "2026-09-01T09:00" }).error?.issues).toMatchObject([
            { path: ["followUpDate"], message: "Schedule the follow-up after the examination day." },
        ]);
        expect(schema.safeParse({ followUpDate: "2026-09-02", examinedAt: "2026-09-01T09:00" }).success).toBe(true);
        expect(schema.safeParse({ followUpDate: "", examinedAt: "2026-09-01T09:00" }).success).toBe(true);
    });
});
