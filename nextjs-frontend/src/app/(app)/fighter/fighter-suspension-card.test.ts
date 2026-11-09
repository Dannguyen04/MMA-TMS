import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_MANUAL_BLOCKED_SESSION_TYPES } from "@/lib/domain/intensity-tiers";
import type { Suspension } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { enFighterToday } from "@/lib/i18n/messages/fighter-today.en";
import type { Locale } from "@/lib/i18n/config";
import { FighterSuspensionCard } from "./fighter-suspension-card";

const TODAY = "2026-11-09";

function suspension(overrides: Partial<Suspension> & Pick<Suspension, "id">): Suspension {
    return {
        fighterId: "f-tariq-haddad",
        boutId: null,
        reason: "MANDATORY_REST",
        startsOn: "2026-11-08",
        endsOn: "2026-11-14",
        lossOfConsciousness: null,
        suggestedDays: 7,
        overrideReason: null,
        blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
        maxAllowedTier: 1,
        requiresClearance: false,
        clearedAt: null,
        clearedById: null,
        clearanceNote: null,
        createdById: "u-rafael-costa",
        createdAt: "2026-11-08T01:00:00.000Z",
        updatedAt: "2026-11-08T01:00:00.000Z",
        status: "ACTIVE",
        gradedReturn: null,
        issuedBy: "CLUB",
        issuerReference: null,
        earlyEndExaminationId: null,
        liftReference: null,
        ...overrides,
    };
}

const mandatoryRest = suspension({ id: "susp-mandatory-rest" });
const koGraded = suspension({
    id: "susp-graded-return",
    reason: "KO",
    startsOn: "2026-10-05",
    endsOn: "2026-11-03",
    requiresClearance: true,
    clearedAt: "2026-11-09T02:00:00.000Z",
    status: "ENDED",
    gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-11" },
});
const awaiting = suspension({ id: "susp-awaiting", reason: "TKO", startsOn: "2026-10-01", endsOn: "2026-10-30", requiresClearance: true, status: "AWAITING_CLEARANCE" });

function render(suspensions: Suspension[] | null, locale: Locale = "vi", href?: string): string {
    return renderToStaticMarkup(createElement(FighterSuspensionCard, { suspensions, today: TODAY, locale, href }));
}

/** What a person reads: the text between tags and the labels a screen reader announces. */
function visibleText(html: string): string {
    const labels = [...html.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map((match) => match[1]);
    return [html.replace(/<[^>]+>/g, " "), ...labels].join(" ").replace(/\s+/g, " ");
}

describe("T-048 fighter suspension card", () => {
    it("F3: MANDATORY_REST in force with maxAllowedTier 1 → until {formatShortDate}, its reason, 1 of 5 tiers allowed", () => {
        const html = render([mandatoryRest]);
        expect(html).toContain(`Đang đình chỉ đến ${formatShortDate("2026-11-14", "vi")}`);
        expect(html).toContain("Lý do: Nghỉ bắt buộc");
        expect(html).toContain("Được tập: hồi phục, vật lý trị liệu");
        // The ladder's five segments, one allowed.
        expect(html.match(/sr-only">Bậc \d, [^<]+: được tập</g)).toHaveLength(1);
        expect(html.match(/sr-only">Bậc \d, [^<]+: bị chặn</g)).toHaveLength(4);
        // Status in tone, icon and words: the badge says day 2 of 7.
        expect(html).toContain("Đang đình chỉ · ngày 2/7");
        // No clearance sentence: a mandatory rest ends on its own.
        expect(html).not.toContain("bác sĩ xác nhận");
    });

    it("a KO still in force says that a doctor must clear the fighter after the end date", () => {
        const html = render([suspension({ id: "susp-ko", reason: "KO", requiresClearance: true })]);
        expect(html).toContain(`Đang đình chỉ đến ${formatShortDate("2026-11-14", "vi")}`);
        expect(html).toContain("Hết ngày này vẫn cần bác sĩ xác nhận rồi mới được tập lại.");
    });

    it("F4: KO in graded return with ceiling 3 → the graded-return sentence, today's types and the steps", () => {
        const html = render([koGraded]);
        expect(html).toContain(`Đang tập lại theo bậc, tập đầy đủ từ ${formatShortDate("2026-11-11", "vi")}`);
        expect(html).toContain("Lý do: KO");
        expect(html).toContain("Hôm nay được tập: hồi phục, vật lý trị liệu, thể lực, đánh bóng, đấm đích, bao cát");
        expect(html).toContain('aria-label="Lộ trình tập lại theo bậc"');
        expect(html.match(/sr-only">Bậc \d, [^<]+: bị chặn hôm nay</g)).toHaveLength(2);
        expect(html).toContain("Tập lại bậc 3/5");
    });

    it("F5: past endsOn and not cleared → waiting for the doctor", () => {
        const html = render([awaiting]);
        expect(html).toContain("Chờ bác sĩ xác nhận được tập lại");
        expect(html).toContain("Lý do: TKO");
        expect(html).toContain("Được tập: hồi phục, vật lý trị liệu");
    });

    it("F6: no live suspension → nothing at all", () => {
        expect(render([])).toBe("");
        expect(render([suspension({ id: "ended", reason: "DQ", endsOn: "2026-10-01", status: "ENDED" })])).toBe("");
    });

    it("F7: KO in graded return and OTHER without it → the OTHER card, and 1 more", () => {
        const other = suspension({ id: "susp-other", reason: "OTHER", endsOn: "2026-11-20" });
        const html = render([koGraded, other]);
        expect(html).toContain('data-suspension-id="susp-other"');
        expect(html).toContain("Lý do: Khác");
        expect(html).toContain("và 1 đình chỉ khác");
        expect(html).not.toContain("Đang tập lại theo bậc");
    });

    it("UPCOMING alone → when it starts and what will be allowed from then", () => {
        const html = render([suspension({ id: "susp-upcoming", startsOn: "2026-11-20", endsOn: "2026-11-26", status: "UPCOMING" })]);
        expect(html).toContain(`Sắp đình chỉ từ ${formatShortDate("2026-11-20", "vi")} đến ${formatShortDate("2026-11-26", "vi")}`);
        expect(html).toContain(`Từ ${formatShortDate("2026-11-20", "vi")} được tập: hồi phục, vật lý trị liệu`);
    });

    it("F8: in Vietnamese there is no English, no raw reason code and no YYYY-MM-DD date on the card", () => {
        // Each English text up to its first placeholder, when that much is still a phrase.
        const english = Object.values(enFighterToday)
            .map((text) => text.replace(/\{[^}]+\}.*$/, "").trim())
            .filter((text) => /[A-Za-z]{4,}/.test(text));
        for (const html of [render([mandatoryRest, koGraded]), render([koGraded]), render([awaiting]), render(null)]) {
            const text = visibleText(html);
            expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
            expect(text).not.toMatch(/MANDATORY_REST|MEDICAL|OTHER|AWAITING_CLEARANCE|GRADED_RETURN|RECOVERY|PHYSICAL_THERAPY/);
            for (const sentence of english) expect(text).not.toContain(sentence);
            expect(text).not.toMatch(/\b(Suspended|Reason|You may|Tier|allowed|blocked)\b/);
        }
    });

    it("English locale reads in English", () => {
        const html = render([mandatoryRest], "en");
        expect(html).toContain(`Suspended until ${formatShortDate("2026-11-14", "en")}`);
        expect(html).toContain("Reason: Mandatory rest");
        expect(html).toContain("You may train: recovery, physical therapy");
    });

    it("read only: no button; Today links to the full card on Health", () => {
        expect(render([mandatoryRest])).not.toMatch(/<button|<form/);
        const html = render([mandatoryRest], "vi", "/fighter/health");
        expect(html).toContain('href="/fighter/health"');
        expect(html).toContain("Chi tiết");
    });

    it("a suspensions service that didn't answer shows a warning instead of hiding the suspension", () => {
        const html = render(null);
        expect(html).toContain('role="note"');
        expect(html).toContain("Chưa tải được trạng thái đình chỉ");
    });
});
