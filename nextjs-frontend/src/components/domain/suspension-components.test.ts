import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
    computeLadderSegments,
    computeGradedReturnSteps,
    handleLadderKeyDown,
} from "@/lib/domain/intensity-tiers";
import { IntensityLadder } from "./intensity-ladder";
import { GradedReturnSteps } from "./graded-return-steps";
import {
    SessionStatusBadge,
    SuspensionStatusBadge,
    suspensionStatusBadgeLabel,
    SUSPENSION_STATUS_META,
    SESSION_STATUS_META,
} from "./status-badges";
import { formatShortDate } from "@/lib/format";

describe("T-030 B3: Shared suspension components", () => {
    // ─── B3-1 ──────────────────────────────────────────────────────────────────
    it("B3-1: IntensityLadder maxAllowedTier={3} -> 5 đoạn; đoạn 1–3 'được tập', 4–5 'bị chặn'; mỗi đoạn có nhãn cho trình đọc màn hình", () => {
        const segments = computeLadderSegments(3, undefined, "vi");
        expect(segments).toHaveLength(5);

        // Đoạn 1–3: được tập
        expect(segments[0]!.status).toBe("allowed");
        expect(segments[0]!.statusLabel).toBe("được tập");
        expect(segments[0]!.screenReaderLabel).toContain("được tập");

        expect(segments[1]!.status).toBe("allowed");
        expect(segments[1]!.statusLabel).toBe("được tập");
        expect(segments[1]!.screenReaderLabel).toContain("được tập");

        expect(segments[2]!.status).toBe("allowed");
        expect(segments[2]!.statusLabel).toBe("được tập");
        expect(segments[2]!.screenReaderLabel).toBe("Bậc 3, kỹ thuật không va chạm: được tập");

        // Đoạn 4–5: bị chặn
        expect(segments[3]!.status).toBe("blocked");
        expect(segments[3]!.statusLabel).toBe("bị chặn");
        expect(segments[3]!.screenReaderLabel).toContain("bị chặn");

        expect(segments[4]!.status).toBe("blocked");
        expect(segments[4]!.statusLabel).toBe("bị chặn");
        expect(segments[4]!.screenReaderLabel).toContain("bị chặn");

        // Render component to HTML and verify screen reader labels in DOM
        const html = renderToStaticMarkup(createElement(IntensityLadder, { maxAllowedTier: 3, locale: "vi" }));
        expect(html).toContain("Bậc 3, kỹ thuật không va chạm: được tập");
        expect(html).toContain("Bậc 4, va chạm có kiểm soát: bị chặn");
        expect(html).toContain("Bậc 5, đối kháng toàn phần: bị chặn");
    });

    // ─── B3-2 ──────────────────────────────────────────────────────────────────
    it("B3-2: maxAllowedTier={5} ceiling={3} -> Đoạn 4–5 hiện 'bị chặn hôm nay' (trần lộ trình)", () => {
        const segments = computeLadderSegments(5, 3, "vi");
        expect(segments).toHaveLength(5);

        // Đoạn 1–3: được tập
        expect(segments[0]!.status).toBe("allowed");
        expect(segments[1]!.status).toBe("allowed");
        expect(segments[2]!.status).toBe("allowed");

        // Đoạn 4–5: bị chặn hôm nay
        expect(segments[3]!.status).toBe("blocked_ceiling");
        expect(segments[3]!.statusLabel).toBe("bị chặn hôm nay");
        expect(segments[3]!.screenReaderLabel).toContain("bị chặn hôm nay");

        expect(segments[4]!.status).toBe("blocked_ceiling");
        expect(segments[4]!.statusLabel).toBe("bị chặn hôm nay");
        expect(segments[4]!.screenReaderLabel).toContain("bị chặn hôm nay");

        // Render component to HTML and verify
        const html = renderToStaticMarkup(
            createElement(IntensityLadder, { maxAllowedTier: 5, ceiling: 3, locale: "vi" }),
        );
        expect(html).toContain("bị chặn hôm nay");
        expect(html).toContain("ladder-pattern-ceiling");
    });

    // ─── B3-3 ──────────────────────────────────────────────────────────────────
    it("B3-3: interactive, đang bậc 2, nhấn mũi tên phải -> onChange(3); nhấn trái ở bậc 1 không xuống dưới 1", () => {
        const onChange = vi.fn();

        // Đang bậc 2, nhấn mũi tên phải -> onChange(3)
        const handledRight = handleLadderKeyDown("ArrowRight", 2, onChange);
        expect(handledRight).toBe(true);
        expect(onChange).toHaveBeenCalledWith(3);

        onChange.mockClear();

        // Đang bậc 2, nhấn mũi tên lên -> onChange(3)
        const handledUp = handleLadderKeyDown("ArrowUp", 2, onChange);
        expect(handledUp).toBe(true);
        expect(onChange).toHaveBeenCalledWith(3);

        onChange.mockClear();

        // Đang bậc 1, nhấn mũi tên trái -> không xuống dưới 1 (không gọi onChange)
        const handledLeft = handleLadderKeyDown("ArrowLeft", 1, onChange);
        expect(handledLeft).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        onChange.mockClear();

        // Đang bậc 5, nhấn mũi tên phải -> không vượt quá 5
        const handledMax = handleLadderKeyDown("ArrowRight", 5, onChange);
        expect(handledMax).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        // Phím Home và End
        handleLadderKeyDown("Home", 3, onChange);
        expect(onChange).toHaveBeenCalledWith(1);

        onChange.mockClear();
        handleLadderKeyDown("End", 3, onChange);
        expect(onChange).toHaveBeenCalledWith(5);

        // Render interactive ladder and check accessibility attributes
        const html = renderToStaticMarkup(
            createElement(IntensityLadder, {
                maxAllowedTier: 3,
                interactive: true,
                value: 2,
                locale: "vi",
            }),
        );
        expect(html).toContain('role="slider"');
        expect(html).toContain('aria-valuemin="1"');
        expect(html).toContain('aria-valuemax="5"');
        expect(html).toContain('aria-valuenow="2"');
        expect(html).toContain('aria-valuetext="Bậc 2: Thể lực chung"');
    });

    // ─── B3-4 ──────────────────────────────────────────────────────────────────
    it("B3-4: GradedReturnSteps gradedReturn={{ceiling:4, fullReturnOn:'2026-12-04'}} -> Bước 1 đã qua, bước 2 hiện tại, bước 3 có ngày 04/12; gradedReturn null không render", () => {
        const gradedReturn = { ceiling: 4 as const, fullReturnOn: "2026-12-04" };
        const steps = computeGradedReturnSteps(gradedReturn, "vi");
        expect(steps).toHaveLength(3);

        // Bước 1: Bậc 3 đã qua
        expect(steps[0]!.label).toBe("Bậc 3");
        expect(steps[0]!.status).toBe("passed");
        expect(steps[0]!.date).toBe("2026-12-02");

        // Bước 2: Bậc 4 hiện tại
        expect(steps[1]!.label).toBe("Bậc 4");
        expect(steps[1]!.status).toBe("current");
        expect(steps[1]!.date).toBe("2026-12-03");

        // Bước 3: Tập đầy đủ có ngày 04/12
        expect(steps[2]!.label).toBe("Tập đầy đủ");
        expect(steps[2]!.status).toBe("upcoming");
        expect(steps[2]!.date).toBe("2026-12-04");
        expect(steps[2]!.dateFormatted).toBe(formatShortDate("2026-12-04", "vi"));

        // Render to HTML
        const html = renderToStaticMarkup(
            createElement(GradedReturnSteps, {
                gradedReturn,
                locale: "vi",
            }),
        );

        // Kiểm tra bước 1 đã qua (title "Bậc 3 (đã qua)")
        expect(html).toContain("Bậc 3 (đã qua)");

        // Kiểm tra bước 2 hiện tại (aria-current="step" và ring-2)
        expect(html).toContain('aria-current="step"');
        expect(html).toContain("ring-2");
        expect(html).toContain("Bậc 4 (hôm nay)");

        // Kiểm tra bước 3 có ngày và câu tóm tắt Sparring
        const formattedDate = formatShortDate("2026-12-04", "vi");
        expect(html).toContain(formattedDate);
        expect(html).toContain(`Sparring được từ ${formattedDate}`);

        // GradedReturn null không render gì
        const emptyHtml = renderToStaticMarkup(
            createElement(GradedReturnSteps, {
                gradedReturn: null,
                locale: "vi",
            }),
        );
        expect(emptyHtml).toBe("");
    });

    // ─── B3-5 ──────────────────────────────────────────────────────────────────
    it("B3-5: SessionStatusBadge status='pending' -> Chữ 'Chờ xếp lại', có icon, khác badge 'Chờ xác nhận'", () => {
        // Kiểm tra metadata tone và variant
        expect(SESSION_STATUS_META.pending.tone).toBe("warning");
        expect(SESSION_STATUS_META.pending.variant).toBe("outline");

        // SessionStatusBadge pending
        const pendingHtml = renderToStaticMarkup(
            createElement(SessionStatusBadge, { status: "pending", locale: "vi" }),
        );
        expect(pendingHtml).toContain("Chờ xếp lại");
        // Có icon (lucide-clock svg)
        expect(pendingHtml).toContain("svg");
        // Outline variant: bg-transparent và text-warning-fg ring-warning-border
        expect(pendingHtml).toContain("bg-transparent");
        expect(pendingHtml).toContain("text-warning-fg");
        expect(pendingHtml).toContain("ring-warning-border");

        // So sánh với SuspensionStatusBadge AWAITING_CLEARANCE ("Chờ xác nhận")
        const awaitingHtml = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, { status: "AWAITING_CLEARANCE", locale: "vi" }),
        );
        expect(awaitingHtml).toContain("Chờ xác nhận");
        // Variant soft: có background soft (bg-warning-soft), không phải outline bg-transparent
        expect(awaitingHtml).toContain("bg-warning-soft");
        expect(awaitingHtml).not.toContain("bg-transparent");

        // Kiểm tra khác biệt rõ rệt giữa hai badge
        expect(pendingHtml).not.toBe(awaitingHtml);
    });

    // ─── B3-6 ──────────────────────────────────────────────────────────────────
    it("B3-6: CSS -> Có quy tắc làm transition-delay về 0 (hoặc delay chỉ nằm trong motion-safe) khi prefers-reduced-motion", () => {
        const cssPath = path.resolve(__dirname, "../../app/globals.css");
        const cssContent = fs.readFileSync(cssPath, "utf8");

        // Khối prefers-reduced-motion toàn cục
        expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");

        const reducedMotionIndex = cssContent.indexOf("@media (prefers-reduced-motion: reduce)");
        expect(reducedMotionIndex).toBeGreaterThan(-1);

        const reducedMotionBlock = cssContent.slice(
            reducedMotionIndex,
            cssContent.indexOf("}", cssContent.indexOf("transition-delay: 0s !important", reducedMotionIndex)) + 10,
        );

        // Khối reduced motion phải chứa lệnh đặt transition-delay về 0
        expect(reducedMotionBlock).toContain("transition-delay: 0s !important");
    });

    // ─── B3-7 ──────────────────────────────────────────────────────────────────
    it("B3-7: SuspensionStatusBadge GRADED_RETURN ceiling 4 hiện 'Tập lại bậc 4/5'", () => {
        expect(SUSPENSION_STATUS_META.GRADED_RETURN.tone).toBe("info");

        const labelVi = suspensionStatusBadgeLabel("GRADED_RETURN", { ceiling: 4, locale: "vi" });
        expect(labelVi).toBe("Tập lại bậc 4/5");

        const labelEn = suspensionStatusBadgeLabel("GRADED_RETURN", { ceiling: 4, locale: "en" });
        expect(labelEn).toBe("Graded return tier 4/5");

        // Render HTML
        const html = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, {
                status: "GRADED_RETURN",
                ceiling: 4,
                locale: "vi",
            }),
        );
        expect(html).toContain("Tập lại bậc 4/5");
        // Tone info
        expect(html).toContain("bg-info-soft");
        expect(html).toContain("text-info-fg");
        // Có icon (TrendingUp)
        expect(html).toContain("svg");
    });

    // ─── B3-8 ──────────────────────────────────────────────────────────────────
    it("B3-8: IntensityLadder maxAllowedTier 0 -> cả 5 đoạn bị chặn", () => {
        const segments = computeLadderSegments(0, undefined, "vi");
        expect(segments).toHaveLength(5);

        for (const seg of segments) {
            expect(seg.status).toBe("blocked");
            expect(seg.statusLabel).toBe("bị chặn");
            expect(seg.screenReaderLabel).toContain("bị chặn");
        }

        // Render to HTML and verify that all 5 have ladder-pattern-blocked
        const html = renderToStaticMarkup(createElement(IntensityLadder, { maxAllowedTier: 0, locale: "vi" }));
        const blockedMatches = html.match(/ladder-pattern-blocked/g);
        expect(blockedMatches).toHaveLength(5);
        expect(html).not.toContain("bg-success-solid");
    });

    // ─── B3-9 ──────────────────────────────────────────────────────────────────
    it("B3-9: render GradedReturnSteps với bước hiện tại: phần tử bước hiện tại có class ring và KHÔNG có class animation nào", () => {
        const gradedReturn = { ceiling: 4 as const, fullReturnOn: "2026-12-04" };
        const html = renderToStaticMarkup(
            createElement(GradedReturnSteps, {
                gradedReturn,
                locale: "vi",
            }),
        );

        // Phần tử có aria-current="step" là bước hiện tại, có class ring
        expect(html).toContain('aria-current="step"');
        expect(html).toContain("ring-2");
        expect(html).toContain("ring-info-solid");

        // KHÔNG có bất kỳ class animation nào
        expect(html).not.toMatch(/animate-[a-z0-9-]+/);
    });

    // ─── B3-10 ─────────────────────────────────────────────────────────────────
    it("B3-10: render IntensityLadder (không tương tác) với maxAllowedTier 3 ở locale 'en' và 'vi': không có thuộc tính style chứa 'color'; chữ đúng ngôn ngữ (en chứa 'Tier 3', vi chứa 'Bậc 3')", () => {
        const enHtml = renderToStaticMarkup(
            createElement(IntensityLadder, {
                maxAllowedTier: 3,
                locale: "en",
            }),
        );
        expect(enHtml).not.toContain("color");
        expect(enHtml).not.toContain("style=");
        expect(enHtml).toContain("Tier 3");

        const viHtml = renderToStaticMarkup(
            createElement(IntensityLadder, {
                maxAllowedTier: 3,
                locale: "vi",
            }),
        );
        expect(viHtml).not.toContain("color");
        expect(viHtml).not.toContain("style=");
        expect(viHtml).toContain("Bậc 3");
    });

    // ─── B3-11 ─────────────────────────────────────────────────────────────────
    it("B3-11: render IntensityLadder interactive: đúng một phần tử role='slider'; không phần tử con nào có role='button' hay tabindex", () => {
        const html = renderToStaticMarkup(
            createElement(IntensityLadder, {
                maxAllowedTier: 3,
                interactive: true,
                value: 2,
                locale: "vi",
            }),
        );

        // Đúng một phần tử role="slider"
        const sliderMatches = html.match(/role="slider"/g);
        expect(sliderMatches).toHaveLength(1);

        // Không phần tử con nào có role="button"
        expect(html).not.toContain('role="button"');

        // Đúng 1 tabindex trên cả component (thuộc về slider cha để nhận focus bàn phím)
        const tabIndexMatches = html.match(/tabindex="0"/g);
        expect(tabIndexMatches).toHaveLength(1);
    });

    // ─── B3-12 ─────────────────────────────────────────────────────────────────
    it("B3-12: SessionStatusBadge pending locale 'en' -> 'To reschedule'; không truyền locale -> giống en", () => {
        const enHtml = renderToStaticMarkup(
            createElement(SessionStatusBadge, { status: "pending", locale: "en" }),
        );
        expect(enHtml).toContain("To reschedule");

        const noLocaleHtml = renderToStaticMarkup(
            createElement(SessionStatusBadge, { status: "pending" }),
        );
        expect(noLocaleHtml).toContain("To reschedule");
    });

    // ─── B3-13 ─────────────────────────────────────────────────────────────────
    it("B3-13: SuspensionStatusBadge GRADED_RETURN không có ceiling -> không chứa '3/5'", () => {
        const viHtml = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, { status: "GRADED_RETURN", locale: "vi" }),
        );
        expect(viHtml).toContain("Tập lại");
        expect(viHtml).not.toContain("3/5");

        const enHtml = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, { status: "GRADED_RETURN", locale: "en" }),
        );
        expect(enHtml).toContain("Graded return");
        expect(enHtml).not.toContain("3/5");

        // Gọi hàm thuần trực tiếp cũng không chứa 3/5
        expect(suspensionStatusBadgeLabel("GRADED_RETURN", { locale: "vi" })).toBe("Tập lại");
        expect(suspensionStatusBadgeLabel("GRADED_RETURN", { locale: "vi" })).not.toContain("3/5");
        expect(suspensionStatusBadgeLabel("GRADED_RETURN", { locale: "en" })).toBe("Graded return");
        expect(suspensionStatusBadgeLabel("GRADED_RETURN", { locale: "en" })).not.toContain("3/5");
    });

    // ─── B3-14 ─────────────────────────────────────────────────────────────────
    it("B3-14: IntensityLadder interactive với maxAllowedTier 0 và không truyền value -> aria-valuenow = 1", () => {
        const html = renderToStaticMarkup(
            createElement(IntensityLadder, {
                maxAllowedTier: 0,
                interactive: true,
                locale: "vi",
            }),
        );
        expect(html).toContain('aria-valuenow="1"');
    });

    // ─── B3-15 ─────────────────────────────────────────────────────────────────
    it("B3-15: các hàm thuần import được từ module không có 'use client' (test đọc file nguồn và kiểm không có chuỗi 'use client')", () => {
        const sourcePath = path.resolve(__dirname, "../../lib/domain/intensity-tiers.ts");
        const fileContent = fs.readFileSync(sourcePath, "utf8");
        expect(fileContent).not.toContain("use client");

        // Xác nhận các hàm thuần hoạt động bình thường
        expect(typeof computeLadderSegments).toBe("function");
        expect(typeof computeGradedReturnSteps).toBe("function");
        expect(typeof handleLadderKeyDown).toBe("function");
    });

    // ─── B3-16 ─────────────────────────────────────────────────────────────────
    it("B3-16: GradedReturnSteps có văn bản sr-only 'đã qua' cho bước đã qua (vi)", () => {
        const gradedReturn = { ceiling: 4 as const, fullReturnOn: "2026-12-04" };
        const html = renderToStaticMarkup(
            createElement(GradedReturnSteps, {
                gradedReturn,
                locale: "vi",
            }),
        );
        expect(html).toContain('<span class="sr-only">(đã qua)</span>');
    });

    // ─── Bổ sung: SuspensionStatusBadge các trạng thái còn lại ─────────────────
    it("SuspensionStatusBadge: ACTIVE với startsOn/endsOn/today hiện 'ngày x/y', tone danger", () => {
        expect(SUSPENSION_STATUS_META.ACTIVE.tone).toBe("danger");

        const htmlWithDates = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, {
                status: "ACTIVE",
                startsOn: "2026-10-01",
                endsOn: "2026-10-10",
                today: "2026-10-03",
                locale: "vi",
            }),
        );
        expect(htmlWithDates).toContain("Đang đình chỉ · ngày 3/10");
        expect(htmlWithDates).toContain("bg-danger-solid");

        const htmlWithoutDates = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, {
                status: "ACTIVE",
                locale: "vi",
            }),
        );
        expect(htmlWithoutDates).toContain("Đang đình chỉ");
        expect(htmlWithoutDates).not.toContain("ngày");
    });

    it("SuspensionStatusBadge: ENDED hiện 'Đã hết' tone success, UPCOMING hiện 'Sắp hiệu lực' tone neutral", () => {
        expect(SUSPENSION_STATUS_META.ENDED.tone).toBe("success");
        expect(SUSPENSION_STATUS_META.UPCOMING.tone).toBe("neutral");

        const endedHtml = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, { status: "ENDED", locale: "vi" }),
        );
        expect(endedHtml).toContain("Đã hết");
        expect(endedHtml).toContain("bg-success-soft");

        const upcomingHtml = renderToStaticMarkup(
            createElement(SuspensionStatusBadge, { status: "UPCOMING", locale: "vi" }),
        );
        expect(upcomingHtml).toContain("Sắp hiệu lực");
        expect(upcomingHtml).toContain("bg-neutral-soft");
    });

    it("IntensityLadder: size 'sm' không có icon, size 'md' và 'lg' có icon, size 'lg' có chú thích tên bậc", () => {
        const smHtml = renderToStaticMarkup(
            createElement(IntensityLadder, { maxAllowedTier: 3, size: "sm", locale: "vi" }),
        );
        // Không chứa icon buổi tập ở size sm
        expect(smHtml).not.toContain("<svg");

        const mdHtml = renderToStaticMarkup(
            createElement(IntensityLadder, { maxAllowedTier: 3, size: "md", locale: "vi" }),
        );
        // Chứa 5 icon cho 5 đoạn ở size md
        expect((mdHtml.match(/<svg/g) || []).length).toBe(5);

        const lgHtml = renderToStaticMarkup(
            createElement(IntensityLadder, { maxAllowedTier: 3, size: "lg", locale: "vi" }),
        );
        // Chứa 5 icon và chú thích tên bậc ở size lg
        expect((lgHtml.match(/<svg/g) || []).length).toBe(5);
        expect(lgHtml).toContain("Hồi phục, vận động nhẹ");
        expect(lgHtml).toContain("Kỹ thuật không va chạm");
        expect(lgHtml).toContain("Đối kháng toàn phần");
    });
});
