import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { clinicalLinks } from "@/components/clinical/clinical-links";
import { earlyEndPreview, filterEarlyEndExaminations } from "@/lib/domain/suspension-rules";
import type { MedicalExamination, Suspension } from "@/lib/domain/types";
import { createTranslator } from "@/lib/i18n/translate";
import { viCoachBouts } from "@/lib/i18n/messages/coach-bouts.vi";
import { enCoachBouts } from "@/lib/i18n/messages/coach-bouts.en";
import { SuspensionEarlyEndBody } from "./suspension-early-end-dialog";

const tVi = createTranslator("vi");

const SC: Suspension = {
    id: "susp-sc",
    fighterId: "f-fighter-1",
    boutId: null,
    reason: "MEDICAL",
    startsOn: "2026-11-03",
    endsOn: "2026-11-16",
    lossOfConsciousness: null,
    suggestedDays: 14,
    overrideReason: null,
    blockedSessionTypes: ["SPARRING"],
    maxAllowedTier: 1,
    requiresClearance: false,
    clearedAt: null,
    clearedById: null,
    clearanceNote: null,
    createdById: "u-coach-c",
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
    status: "ACTIVE",
    gradedReturn: null,
    issuedBy: "CLUB",
    issuerReference: null,
    earlyEndExaminationId: null,
    liftReference: null,
};

const SO: Suspension = {
    ...SC,
    id: "susp-so",
    issuedBy: "ORGANIZER",
    issuerReference: "QĐ 12/BTC ngày 31/10",
};

const X1: MedicalExamination = {
    id: "exam-x1",
    fighterId: "f-fighter-1",
    doctorId: "d-doctor-d",
    date: "2026-11-05T02:00:00Z",
    type: "routine",
    vitals: null,
    assessments: [],
    outcome: "fit",
    summary: "Đủ điều kiện",
    recommendations: "",
    followUpDate: null,
    scope: "TRAINING",
    validUntil: null,
};

describe("T-053: Ca kiểm thử hộp thoại Kết thúc sớm đình chỉ", () => {
    // ─── P1 ─────────────────────────────────────────────────────────────────
    it("P1: endsOn 2026-11-16, today 2026-11-05 -> daysCut 11, gradedReturn { ceiling: 3, fullReturnOn: '2026-11-07' }", () => {
        const result = earlyEndPreview({ endsOn: "2026-11-16" }, "2026-11-05");
        expect(result.daysCut).toBe(11);
        expect(result.gradedReturn).toEqual({
            ceiling: 3,
            fullReturnOn: "2026-11-07",
        });
    });

    // ─── P2 ─────────────────────────────────────────────────────────────────
    it("P2: endsOn 2026-11-05, today 2026-11-05 -> daysCut 0, fullReturnOn '2026-11-07'", () => {
        const result = earlyEndPreview({ endsOn: "2026-11-05" }, "2026-11-05");
        expect(result.daysCut).toBe(0);
        expect(result.gradedReturn.fullReturnOn).toBe("2026-11-07");
    });

    // ─── P3 ─────────────────────────────────────────────────────────────────
    it("P3: endsOn 2026-11-04, today 2026-11-05 (không xảy ra vì backend chặn, nhưng hàm phải an toàn) -> daysCut 0", () => {
        const result = earlyEndPreview({ endsOn: "2026-11-04" }, "2026-11-05");
        expect(result.daysCut).toBe(0);
        expect(result.gradedReturn.fullReturnOn).toBe("2026-11-07");
    });

    // ─── R1 ─────────────────────────────────────────────────────────────────
    it("R1: CLB, MEDICAL, 03/11–16/11, một phiếu hợp lệ -> markup chứa 'Y tế', '03/11', '16/11', 'Do CLB', 'Rút ngắn 11 ngày' và vùng GradedReturnSteps", () => {
        const suspension: Suspension = {
            ...SC,
            reason: "MEDICAL",
            startsOn: "2026-11-03",
            endsOn: "2026-11-16",
            issuedBy: "CLUB",
        };
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension,
                eligibleExams: [X1],
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        expect(html).toContain("Y tế");
        expect(html).toContain("03/11");
        expect(html).toContain("16/11");
        expect(html).toContain("Do CLB");
        expect(html).toContain("Rút ngắn 11 ngày");
        expect(html).toContain(tVi("gradedReturn.regionLabel"));
    });

    // ─── R2 ─────────────────────────────────────────────────────────────────
    it("R2: ban tổ chức, issuerReference 'QĐ 12/BTC ngày 31/10' -> markup chứa 'Do ban tổ chức', chứa 'QĐ 12/BTC ngày 31/10' ở khối đình chỉ và trong gợi ý của ô văn bản gỡ; có ô lift-reference-input; có vùng GradedReturnSteps", () => {
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SO,
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        expect(html).toContain("Do ban tổ chức");

        // "QĐ 12/BTC ngày 31/10" xuất hiện ở cả khối đình chỉ và trong gợi ý của ô văn bản gỡ
        const matches = html.match(/QĐ 12\/BTC ngày 31\/10/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);

        expect(html).toContain('id="lift-reference-input"');
        expect(html).toContain(tVi("gradedReturn.regionLabel"));
    });

    // ─── R3 ─────────────────────────────────────────────────────────────────
    it("R3: CLB, 0 phiếu hợp lệ -> có link tới clinicalLinks.newExaminationFor(fighterId); không có early-end-note-textarea, không có nút type='submit', không có vùng GradedReturnSteps", () => {
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                eligibleExams: [],
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        expect(html).toContain(clinicalLinks.newExaminationFor(SC.fighterId));
        expect(html).not.toContain("early-end-note-textarea");
        expect(html).not.toContain('type="submit"');
        expect(html).not.toContain(tVi("gradedReturn.regionLabel"));
    });

    // ─── R4 ─────────────────────────────────────────────────────────────────
    it("R4: CLB, 2 phiếu hợp lệ: A (fit, validUntil 2026-12-01), B (fit_with_restrictions, không validUntil) -> 2 input type='radio' name='examinationId', không radio nào checked; markup chứa 'Đủ điều kiện', 'Đủ điều kiện, có hạn chế', 'Hiệu lực đến 01/12'; không còn <select id='examination-select'>", () => {
        const examA: MedicalExamination = {
            ...X1,
            id: "exam-a",
            outcome: "fit",
            validUntil: "2026-12-01T00:00:00Z",
        };
        const examB: MedicalExamination = {
            ...X1,
            id: "exam-b",
            outcome: "fit_with_restrictions",
            validUntil: null,
        };

        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                eligibleExams: [examA, examB],
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        const radioMatches = html.match(/<input[^>]*type="radio"[^>]*name="examinationId"[^>]*>/g);
        expect(radioMatches).not.toBeNull();
        expect(radioMatches!.length).toBe(2);

        // Không radio nào checked
        for (const radio of radioMatches!) {
            expect(radio).not.toContain("checked");
        }

        expect(html).toContain("Đủ điều kiện");
        expect(html).toContain("Đủ điều kiện, có hạn chế");
        expect(html).toContain("Hiệu lực đến 01/12");
        expect(html).not.toContain('id="examination-select"');
        expect(html).not.toContain("<select");
    });

    // ─── R5 ─────────────────────────────────────────────────────────────────
    it("R5: CLB, đúng 1 phiếu hợp lệ -> radio duy nhất có checked", () => {
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                eligibleExams: [X1],
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        const radioMatches = html.match(/<input[^>]*type="radio"[^>]*name="examinationId"[^>]*>/g);
        expect(radioMatches).not.toBeNull();
        expect(radioMatches!.length).toBe(1);
        expect(radioMatches![0]).toContain("checked");
    });

    // ─── R6 ─────────────────────────────────────────────────────────────────
    it("R6: CLB, 1 phiếu hợp lệ và 1 phiếu scope COMPETITION -> chỉ 1 radio (bộ lọc filterEarlyEndExaminations vẫn áp)", () => {
        const examComp: MedicalExamination = {
            ...X1,
            id: "exam-comp",
            scope: "COMPETITION",
        };

        // Kiểm tra hàm filter
        const filtered = filterEarlyEndExaminations([X1, examComp], SC);
        expect(filtered).toHaveLength(1);

        // Kiểm tra component render khi truyền danh sách raw qua prop examinations
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                examinations: [X1, examComp],
                today: "2026-11-05",
                locale: "vi",
            }),
        );

        const radioMatches = html.match(/<input[^>]*type="radio"[^>]*name="examinationId"[^>]*>/g);
        expect(radioMatches).not.toBeNull();
        expect(radioMatches!.length).toBe(1);
    });

    // ─── R7 ─────────────────────────────────────────────────────────────────
    it("R7: ban tổ chức và CLB có phiếu -> nút submit có chữ 'Kết thúc đình chỉ'; nhãn ô ghi chú là 'Ghi chú kết thúc'", () => {
        // Nhánh Ban tổ chức
        const htmlOrganizer = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SO,
                today: "2026-11-05",
                locale: "vi",
            }),
        );
        expect(htmlOrganizer).toContain("Kết thúc đình chỉ");
        expect(htmlOrganizer).toContain("Ghi chú kết thúc");

        // Nhánh CLB có phiếu
        const htmlClub = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                eligibleExams: [X1],
                today: "2026-11-05",
                locale: "vi",
            }),
        );
        expect(htmlClub).toContain("Kết thúc đình chỉ");
        expect(htmlClub).toContain("Ghi chú kết thúc");
    });

    // ─── I1 ─────────────────────────────────────────────────────────────────
    it("I1: từ điển vi và en -> mọi khoá suspensions.earlyEndDialog.* có ở cả hai; không còn khoá nào trong nhóm này mà code không dùng", () => {
        const viKeys = Object.keys(viCoachBouts).filter((k) =>
            k.startsWith("suspensions.earlyEndDialog."),
        );
        const enKeys = Object.keys(enCoachBouts).filter((k) =>
            k.startsWith("suspensions.earlyEndDialog."),
        );

        expect(viKeys.length).toBeGreaterThan(0);
        expect(viKeys.sort()).toEqual(enKeys.sort());

        // Đọc mã nguồn component để khẳng định mọi khoá trong nhóm này đều được code dùng
        const dialogSource = readFileSync(
            resolve(__dirname, "./suspension-early-end-dialog.tsx"),
            "utf-8",
        );

        for (const key of viKeys) {
            expect(dialogSource).toContain(key);
        }
    });

    // ─── K1 ─────────────────────────────────────────────────────────────────
    it("K1: test T-050 hiện có (W1–W11, W2b, W2c) -> vẫn qua. Ca nào khẳng định examination-select hay chữ cũ thì sửa theo thiết kế mới, giữ tên ca, ghi vào handover", () => {
        // W3 đã được cập nhật kiểm tra theo thiết kế mới: không có examination-select, không render nút submit khi 0 phiếu, có nút Đóng
        const htmlNoExams = renderToStaticMarkup(
            createElement(SuspensionEarlyEndBody, {
                suspension: SC,
                eligibleExams: [],
                today: "2026-11-05",
                locale: "vi",
            }),
        );
        expect(htmlNoExams).not.toContain("examination-select");
        expect(htmlNoExams).not.toContain('type="submit"');
        expect(htmlNoExams).toContain("Đóng");
    });
});
