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

    it("uses a thin semantic rail instead of a saturated header bar", () => {
        expect(css).toContain(".yt-status-card[data-tone=\"red\"] { --rail: var(--danger-solid)");
        expect(css).toContain(".yt-status-card[data-tone=\"blue\"] { --rail: var(--primary)");
        expect(css).toContain(".yt-status-card::before");
        expect(css).toContain("width: 4px");
        expect(css).toContain("background-color: var(--rail)");
        expect(css).toContain(".yt-status-card > header::before");
        expect(css).toContain("opacity: 0.42");
        expect(css).not.toContain("color-mix(in oklab, var(--block-soft)");
    });
});

describe("body map light surface and legend", () => {
    it("grounds the body card on the theme surface, not the fixed navy plate", () => {
        expect(css).toContain(".hs-body { --b3-bg: var(--s2); color: var(--ink); }");
        expect(css).not.toContain(".hs-body { --b3-bg: var(--plate-2);");
        expect(css).toContain(".hs-joints li {");
        expect(css).toMatch(/\.hs-joints li \{[^}]*background: var\(--s2\)/);
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
