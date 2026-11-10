import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CampBout } from "@/lib/domain/bout";
import type { TrainingSession } from "@/lib/domain/types";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { CoachHero } from "./coach-hero";
import type { ActiveSuspensionLine } from "./coach-todo-card";

const NOW = "2026-11-10T03:00:00Z";
const t = createTranslator("vi");

/** A bout whose weigh-in is at noon academy time on `weighInOn`, fought the next day. */
function bout(id: string, weighInOn: string, phase: CampBout["phase"], event = `Event ${id}`): CampBout {
    const fightOn = new Date(Date.parse(`${weighInOn}T05:00:00Z`) + 86_400_000).toISOString();
    return { id, fighterId: "f-1", event, phase, weighInAt: `${weighInOn}T05:00:00Z`, boutAt: fightOn } as CampBout;
}

function line(fighterId: string): ActiveSuspensionLine {
    return { suspensionId: `s-${fighterId}`, fighterId, reason: "KO", endsOn: "2026-11-25", daysLeft: 16, maxAllowedTier: 1 };
}

function render(props: {
    bouts?: CampBout[] | null;
    suspensions?: ActiveSuspensionLine[];
    sessions?: Pick<TrainingSession, "status">[];
}): string {
    return renderToStaticMarkup(
        createElement(CoachHero, {
            bouts: props.bouts === undefined ? [] : props.bouts,
            suspensions: props.suspensions ?? [],
            roster: [],
            todaySessions: props.sessions ?? [],
            fighterNames: new Map([["f-1", "Hoàng Long"]]),
            now: NOW,
            t,
            locale: "vi",
        }),
    );
}

/** The number in the stat cell whose label is `label`. */
function stat(html: string, label: string): string | undefined {
    return html.match(new RegExp(`${label}</span>[\\s\\S]*?tabular-nums">([^<]+)<`))?.[1];
}

describe("T-064: coach hero", () => {
    it("H1", () => {
        const html = render({ bouts: [bout("b-1", "2026-11-20", "CAMP", "Lion Championship 25")] });
        expect(html).toMatch(/class="[^"]*font-display[^"]*">10</);
        expect(html).toContain("Lion Championship 25");
    });

    it("H2", () => {
        for (const bouts of [[], null]) {
            const html = render({ bouts });
            expect(html).toContain("Chưa có trận nào trong camp");
            expect(html).toContain(`href="${routes.coach.newBout}"`);
        }
    });

    it("H3", () => {
        const html = render({ suspensions: [line("f-1"), line("f-2")] });
        expect(stat(html, "Đang đình chỉ")).toBe("2");
    });

    it("H4", () => {
        const html = render({ sessions: [{ status: "completed" }, { status: "cancelled" }, { status: "scheduled" }] });
        expect(stat(html, "Buổi tập hôm nay")).toBe("1/2");
    });

    it("H5", () => {
        const html = render({ bouts: [bout("b-1", "2026-11-20", "CAMP")], suspensions: [line("f-1")], sessions: [{ status: "completed" }] });
        expect(html).toContain("bg-hero-bg");
        expect(html).toContain("cage-hatch");
        expect(html).not.toContain("slate-");
        expect(html).not.toContain("rounded-2xl");
        expect(html).not.toContain("editorial");
        expect(html).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    });

    it("H6", () => {
        const html = render({ bouts: [bout("b-1", "2026-11-20", "CAMP", "Lion Championship 25")] });
        const numbers = [...html.matchAll(/<(\w+)[^>]*class="([^"]*)"[^>]*>(\d+(?:\/\d+)?)<\//g)];
        // The countdown and the four stats.
        expect(numbers.length).toBeGreaterThanOrEqual(5);
        for (const [, , classes] of numbers) expect(classes).toContain("tabular-nums");
    });

    it("H7", () => {
        const html = render({
            bouts: [bout("b-late", "2026-11-25", "CAMP", "Late Event"), bout("b-near", "2026-11-14", "FIGHT_WEEK", "Near Event"), bout("b-done", "2026-11-12", "COMPLETED", "Done Event")],
        });
        expect(html).toContain("Near Event");
        expect(html).not.toContain("Done Event");
        expect(html).toMatch(/class="[^"]*font-display[^"]*">4</);
        expect(stat(html, "Trận đang chạy")).toBe("2");
    });
});
