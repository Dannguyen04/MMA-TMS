import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { clearanceCardTone, recoveryCardTone } from "./labels";

const css = readFileSync(new URL("./doctor.css", import.meta.url), "utf8");

describe("medical status card tones", () => {
    it("does not paint a still-valid not-cleared document as clinically green", () => {
        expect(clearanceCardTone("not_cleared")).toBe("red");
        expect(clearanceCardTone("restricted")).toBe("amber");
        expect(clearanceCardTone("full")).toBe("green");
    });

    it("keeps rehabilitation states in the same rail family", () => {
        expect(recoveryCardTone("active")).toBe("blue");
        expect(recoveryCardTone("completed")).toBe("green");
        expect(recoveryCardTone("paused")).toBe("amber");
        expect(recoveryCardTone("cancelled")).toBe("neutral");
    });

    it("paints status with tone, icon and words, never a coloured side stripe (9/11)", () => {
        expect(css).not.toContain(".yt-status-card");
        expect(css).not.toMatch(/border-(?:left|right|inline-start|inline-end)\s*:/);
        expect(css).not.toMatch(/::before\s*\{[^}]*width:\s*4px/);
    });
});

describe("body map light surface and legend", () => {
    it("grounds the body map on the theme surface, not the fixed navy plate", () => {
        expect(css).toMatch(/\.b3-frame \{[^}]*background: var\(--b3-bg, var\(--surface-muted\)\)/);
        expect(css).not.toContain("--plate");
    });

    it("centers the legend on one line without a horizontal scrollbar", () => {
        expect(css).toMatch(/\.b3-legend \{[^}]*justify-content: center/);
        expect(css).toMatch(/\.b3-legend \{[^}]*flex-wrap: nowrap/);
        expect(css).toMatch(/\.b3-legend \{[^}]*overflow: visible/);
        expect(css).toMatch(/\.b3-legend \{[^}]*font-size: 11px/);
        expect(css).toContain(".rm .b3-legend { justify-content: center; width: 100%; }");
        expect(css).not.toContain(".rm .b3-legend { justify-content: flex-start;");
        expect(css).not.toMatch(/\.b3-legend \{[^}]*overflow-x:\s*auto/);
    });
});
