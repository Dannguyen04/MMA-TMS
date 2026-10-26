import { describe, expect, it } from "vitest";

import { GLOSSARY, GLOSSARY_SECTIONS } from "./index";

describe("glossary", () => {
    it("keeps keys unique across sections", () => {
        const keys = Object.values(GLOSSARY_SECTIONS).flatMap((section) => Object.keys(section));
        expect(new Set(keys).size).toBe(keys.length);
        expect(Object.keys(GLOSSARY)).toHaveLength(keys.length);
    });

    it("keeps every definition short enough for a tooltip", () => {
        for (const [key, entry] of Object.entries(GLOSSARY)) {
            expect(entry.term.trim(), key).not.toBe("");
            expect(entry.definition.trim(), key).not.toBe("");
            expect(entry.definition.length, key).toBeLessThanOrEqual(220);
        }
    });
});
