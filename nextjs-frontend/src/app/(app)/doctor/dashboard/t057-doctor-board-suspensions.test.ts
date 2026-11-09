import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Fighter, User } from "@/lib/domain/types";
import { mockDoctors, mockUsers } from "@/lib/mocks/people";
import {
    loadDoctorBoard,
    loadDoctorRow,
    suspensionBoardState,
    triageOf,
    type BoardItem,
    type BoardRow,
    type DoctorBoard,
} from "@/lib/services/doctor-board";
import DoctorDashboardPage from "./page";

const baseThu = mockUsers.find((u) => u.id === "u-thu-le")!;
const thuDoctor = mockDoctors.find((d) => d.userId === "u-thu-le")!;
const mockThuDoctor: User = {
    ...baseThu,
    effectiveCapabilities: ["fighters:read", "medical:read", "medical:write"],
    assignmentScope: {
        fighterIds: [...thuDoctor.fighterIds],
    },
};

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        requireRole: vi.fn(async () => mockThuDoctor),
    };
});

vi.mock("@/lib/services/doctor-board", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/doctor-board")>();
    return {
        ...actual,
        loadDoctorBoard: vi.fn(actual.loadDoctorBoard),
    };
});

function createMockFighter(id: string, name: string): Fighter {
    return {
        id,
        userId: `u-${id}`,
        name,
        nickname: null,
        sex: "male",
        dateOfBirth: "1998-01-01",
        nationality: "VN",
        heightCm: 175,
        reachCm: 175,
        weightKg: 70,
        targetWeightKg: 70,
        bodyFatPct: null,
        restingHeartRate: null,
        weightClass: "lightweight",
        stance: "orthodox",
        level: "professional",
        primaryDiscipline: "MMA",
        record: null,
        coachIds: [],
        primaryCoachId: null,
        doctorIds: ["d-thu-le"],
        healthStatus: "healthy",
        joinedAt: "2026-01-01T00:00:00Z",
        upcomingBout: null,
    };
}

type BuildRowOverrides = Omit<Partial<BoardRow>, "summary"> & {
    fighterId?: string;
    name?: string;
    summary?: Partial<BoardRow["summary"]>;
};

function buildRow(overrides: BuildRowOverrides): BoardRow {
    const id = overrides.fighterId ?? "f-1";
    const fighter = overrides.fighter ?? createMockFighter(id, overrides.name ?? "Võ Sĩ Một");
    const { summary: summaryOverride, ...restOverrides } = overrides;
    return {
        fighter,
        training: { scope: "TRAINING", eligible: true, reasons: [] },
        competition: null,
        dossier: null,
        tag: "green",
        items: [],
        ...restOverrides,
        summary: {
            fighter,
            clearance: null,
            clearanceState: "full",
            activeInjuries: [],
            activeRecoveryPlan: null,
            latestExamination: null,
            needsBaseline: false,
            nextFollowUp: null,
            openReviewRequests: [],
            ...summaryOverride,
        } as BoardRow["summary"],
    };
}

function buildBoard(rows: BoardRow[], reviews = 0, now = "2026-11-05T08:00:00Z"): DoctorBoard {
    const blocked = rows.filter((r) => r.tag === "red").length;
    return {
        rows,
        alerts: [],
        alertsAvailable: false,
        warningDays: 7,
        counts: {
            blocked,
            reviews,
            alerts: 0,
        },
        now,
    };
}

describe("T-057: Bảng phân loại của bác sĩ phải tính đình chỉ", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        vi.clearAllMocks();
    });

    // ─── Lớp S: Unit hàm thuần suspensionBoardState ─────────────────────────

    it("S1: MEDICAL startsOn 11-05, endsOn 11-18, requiresClearance false, maxAllowedTier 1 -> tag 'red'; item.date '2026-11-18'; item.text chứa 'Y tế', '18/11' và 'bậc 1'", () => {
        const suspensions = [
            {
                reason: "MEDICAL" as const,
                startsOn: "2026-11-05",
                endsOn: "2026-11-18",
                requiresClearance: false,
                maxAllowedTier: 1,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("red");
        expect(res.item?.date).toBe("2026-11-18");
        expect(res.item?.text).toContain("Y tế");
        expect(res.item?.text).toContain("18/11");
        expect(res.item?.text).toContain("bậc 1");
        expect(res.item?.graded).toBeUndefined();
    });

    it("S2: KO endsOn 11-03, requiresClearance true, chưa xác nhận (AWAITING_CLEARANCE) -> tag 'red'; item.text chứa 'chờ xác nhận'", () => {
        const suspensions = [
            {
                reason: "KO" as const,
                startsOn: "2026-10-04",
                endsOn: "2026-11-03",
                requiresClearance: true,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("red");
        expect(res.item?.text).toContain("chờ xác nhận");
    });

    it("S3: MANDATORY_REST startsOn 11-04, endsOn 11-10 -> tag 'amber'; item khác null", () => {
        const suspensions = [
            {
                reason: "MANDATORY_REST" as const,
                startsOn: "2026-11-04",
                endsOn: "2026-11-10",
                requiresClearance: false,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("amber");
        expect(res.item).not.toBeNull();
    });

    it("S4: DQ đã hết hạn (endsOn 11-01, requiresClearance false) -> tag null, item null", () => {
        const suspensions = [
            {
                reason: "DQ" as const,
                startsOn: "2026-10-25",
                endsOn: "2026-11-01",
                requiresClearance: false,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBeNull();
        expect(res.item).toBeNull();
    });

    it("S5 (sửa): KO đã ENDED, gradedReturn { ceiling 3, fullReturnOn 11-07 } -> tag 'amber'; item.text chứa 'tập lại theo bậc' và 'bậc 3'; item.date '2026-11-06'", () => {
        const suspensions = [
            {
                reason: "KO" as const,
                startsOn: "2026-10-04",
                endsOn: "2026-11-03",
                requiresClearance: false,
                clearedAt: "2026-11-03T10:00:00.000Z",
                gradedReturn: { ceiling: 3 as const, fullReturnOn: "2026-11-07" },
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("amber");
        expect(res.item?.text).toContain("tập lại theo bậc");
        expect(res.item?.text).toContain("bậc 3");
        expect(res.item?.date).toBe("2026-11-06");
        expect(res.item?.graded).toBe(true);
    });

    it("S6: KO đã ENDED, fullReturnOn 11-04 (đã qua) -> tag null, item null", () => {
        const suspensions = [
            {
                reason: "KO" as const,
                startsOn: "2026-10-04",
                endsOn: "2026-11-01",
                requiresClearance: false,
                clearedAt: "2026-11-01T10:00:00.000Z",
                gradedReturn: { ceiling: 3 as const, fullReturnOn: "2026-11-04" },
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBeNull();
        expect(res.item).toBeNull();
    });

    it("S7: hai đình chỉ còn hiệu lực: MANDATORY_REST endsOn 11-20 và MEDICAL endsOn 11-12 -> tag 'red'; item.date '2026-11-12' (đình chỉ MEDICAL thuộc nhóm đỏ nên được chọn, dù MANDATORY_REST kết thúc muộn hơn)", () => {
        const suspensions = [
            {
                reason: "MANDATORY_REST" as const,
                startsOn: "2026-11-04",
                endsOn: "2026-11-20",
                requiresClearance: false,
                clearedAt: null,
            },
            {
                reason: "MEDICAL" as const,
                startsOn: "2026-11-04",
                endsOn: "2026-11-12",
                requiresClearance: false,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("red");
        expect(res.item?.date).toBe("2026-11-12");
    });

    it("S8: mảng rỗng -> tag null, item null", () => {
        const res = suspensionBoardState([], "2026-11-05");
        expect(res.tag).toBeNull();
        expect(res.item).toBeNull();
    });

    it("S9: hai đình chỉ còn hiệu lực nhóm đỏ: MEDICAL endsOn 11-12, KO endsOn 11-20 requiresClearance true -> tag 'red'; item.date '2026-11-20'", () => {
        const suspensions = [
            {
                reason: "MEDICAL" as const,
                startsOn: "2026-11-01",
                endsOn: "2026-11-12",
                requiresClearance: false,
                clearedAt: null,
            },
            {
                reason: "KO" as const,
                startsOn: "2026-10-20",
                endsOn: "2026-11-20",
                requiresClearance: true,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("red");
        expect(res.item?.date).toBe("2026-11-20");
    });

    it("S10: hai đình chỉ còn hiệu lực nhóm vàng: MANDATORY_REST endsOn 11-10, DQ endsOn 11-15 -> tag 'amber'; item.date '2026-11-15'", () => {
        const suspensions = [
            {
                reason: "MANDATORY_REST" as const,
                startsOn: "2026-11-01",
                endsOn: "2026-11-10",
                requiresClearance: false,
                clearedAt: null,
            },
            {
                reason: "DQ" as const,
                startsOn: "2026-11-01",
                endsOn: "2026-11-15",
                requiresClearance: false,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("amber");
        expect(res.item?.date).toBe("2026-11-15");
    });

    it("S11: TKO startsOn 11-04, endsOn 11-12, requiresClearance true -> tag 'red'", () => {
        const suspensions = [
            {
                reason: "TKO" as const,
                startsOn: "2026-11-04",
                endsOn: "2026-11-12",
                requiresClearance: true,
                clearedAt: null,
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("red");
    });

    it("S12: KO đã ENDED, gradedReturn { ceiling 3, fullReturnOn 11-05 } (đúng hôm nay) -> tag 'amber'; item.date '2026-11-04'", () => {
        const suspensions = [
            {
                reason: "KO" as const,
                startsOn: "2026-10-01",
                endsOn: "2026-10-31",
                requiresClearance: false,
                clearedAt: "2026-10-31T10:00:00.000Z",
                gradedReturn: { ceiling: 3 as const, fullReturnOn: "2026-11-05" },
            },
        ];
        const res = suspensionBoardState(suspensions, "2026-11-05");
        expect(res.tag).toBe("amber");
        expect(res.item?.date).toBe("2026-11-04");
    });

    it("S13: MEDICAL còn hiệu lực maxAllowedTier 2; và KO đã ENDED gradedReturn { ceiling 2, fullReturnOn 11-07 } -> dòng thứ nhất chứa 'bậc 2'; dòng thứ hai chứa 'bậc 2' và item.date '2026-11-06'", () => {
        const sMedical = [
            {
                reason: "MEDICAL" as const,
                startsOn: "2026-11-05",
                endsOn: "2026-11-18",
                requiresClearance: false,
                maxAllowedTier: 2,
                clearedAt: null,
            },
        ];
        const resMedical = suspensionBoardState(sMedical, "2026-11-05");
        expect(resMedical.item?.text).toContain("bậc 2");

        const sGraded = [
            {
                reason: "KO" as const,
                startsOn: "2026-10-04",
                endsOn: "2026-11-03",
                requiresClearance: false,
                clearedAt: "2026-11-03T10:00:00.000Z",
                gradedReturn: { ceiling: 2 as const as 3 | 4, fullReturnOn: "2026-11-07" },
            },
        ];
        const resGraded = suspensionBoardState(sGraded, "2026-11-05");
        expect(resGraded.item?.text).toContain("bậc 2");
        expect(resGraded.item?.date).toBe("2026-11-06");
    });

    // ─── Lớp B: Unit triageOf/loadRow qua service demo thật ─────────────────

    it("B1: Hoàng Long (f-hoang-long), seed demo, bác sĩ Thu -> row.tag 'red'; row.items có một dòng kind 'suspension'", async () => {
        const board = await loadDoctorBoard(mockThuDoctor);
        const hoangRow = board.rows.find((r) => r.fighter.id === "f-hoang-long")!;
        expect(hoangRow).toBeDefined();
        expect(hoangRow.tag).toBe("red");
        const suspItems = hoangRow.items.filter((item) => item.kind === "suspension");
        expect(suspItems).toHaveLength(1);
        expect(suspItems[0]?.graded).toBeUndefined();
    });

    it("B2 (sửa): Sofia (f-sofia-kowalski), seed demo -> row.tag 'red' và row.items có dòng kind 'suspension' chứa 'Y tế'", async () => {
        const board = await loadDoctorBoard(mockThuDoctor);
        const sofiaRow = board.rows.find((r) => r.fighter.id === "f-sofia-kowalski")!;
        expect(sofiaRow).toBeDefined();
        expect(sofiaRow.tag).toBe("red");
        const suspItem = sofiaRow.items.find((item) => item.kind === "suspension");
        expect(suspItem).toBeDefined();
        expect(suspItem?.text).toContain("Y tế");
    });

    it("B3 (sửa): Linh (f-linh-pham), seed demo (KO đã xác nhận, tập lại bậc 3) -> row.tag không phải 'green' và có dòng kind 'suspension' chứa 'tập lại theo bậc'", async () => {
        const board = await loadDoctorBoard(mockThuDoctor);
        const linhRow = board.rows.find((r) => r.fighter.id === "f-linh-pham")!;
        expect(linhRow).toBeDefined();
        expect(linhRow.tag).not.toBe("green");
        const suspItem = linhRow.items.find((item) => item.kind === "suspension");
        expect(suspItem).toBeDefined();
        expect(suspItem?.text).toContain("tập lại theo bậc");
        expect(suspItem?.graded).toBe(true);
    });

    it("B4: Emma (f-emma-lindqvist), không có đình chỉ -> row.tag như trước ticket này (không đổi); row.items không có dòng suspension", async () => {
        const board = await loadDoctorBoard(mockThuDoctor);
        const emmaRow = board.rows.find((r) => r.fighter.id === "f-emma-lindqvist")!;
        expect(emmaRow).toBeDefined();
        expect(emmaRow.tag).toBe("green");
        expect(emmaRow.items.filter((item) => item.kind === "suspension")).toHaveLength(0);
    });

    it("B5: một võ sĩ thuộc phạm vi Thu không có đình chỉ nào -> Kết quả tag đúng như triageOf cũ cho võ sĩ đó", async () => {
        const board = await loadDoctorBoard(mockThuDoctor);
        const emmaRow = board.rows.find((r) => r.fighter.id === "f-emma-lindqvist")!;
        expect(emmaRow).toBeDefined();
        const oldTag = triageOf(emmaRow.summary, emmaRow.training, emmaRow.items.filter((i) => i.kind !== "suspension"));
        expect(emmaRow.tag).toBe(oldTag);
    });

    it("B6: listSuspensions bị làm lỗi (ném lỗi) trong lúc loadDoctorBoard chạy trên seed demo -> bảng vẫn trả đủ hàng, không dòng nào có kind 'suspension', không ném lỗi", async () => {
        const { ApiError } = await import("@/lib/api/client");
        const suspensionsModule = await import("@/lib/services/suspensions");
        const spy = vi.spyOn(suspensionsModule, "listSuspensions").mockRejectedValue(
            new ApiError({ message: "Service unavailable", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" }),
        );
        try {
            const board = await loadDoctorBoard(mockThuDoctor);
            expect(board.rows.length).toBeGreaterThan(0);
            for (const row of board.rows) {
                expect(row.items.some((i) => i.kind === "suspension")).toBe(false);
            }
        } finally {
            spy.mockRestore();
        }
    });

    it("B7: listSuspensions bị làm lỗi (ném ApiError 503) trong lúc gọi loadDoctorRow cho Hoàng Long, seed demo -> không ném lỗi; trả về hàng không có dòng kind 'suspension'", async () => {
        const { ApiError } = await import("@/lib/api/client");
        const suspensionsModule = await import("@/lib/services/suspensions");
        const spy = vi.spyOn(suspensionsModule, "listSuspensions").mockRejectedValue(
            new ApiError({ message: "Service unavailable", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" }),
        );
        try {
            const hoangFighter = createMockFighter("f-hoang-long", "Hoàng Long");
            const row = await loadDoctorRow(hoangFighter);
            expect(row).toBeDefined();
            expect(row).not.toBeNull();
            expect(row?.items.some((i) => i.kind === "suspension")).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });

    // ─── Lớp R: Render tĩnh trang dashboard ─────────────────────────────────

    it("R1: dashboard với một hàng đỏ có dòng suspension -> Thẻ nằm trong làn đỏ, hiện chữ dòng việc, không có data-compact='true'", async () => {
        const redRow = buildRow({
            fighterId: "f-red",
            name: "Hoàng Long",
            tag: "red",
            items: [{ kind: "suspension", text: "Đình chỉ Y tế đến 18/11 · tối đa bậc 1", date: "2026-11-18" }],
        });
        vi.mocked(loadDoctorBoard).mockResolvedValueOnce(buildBoard([redRow]));

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        const redLaneMatch = html.match(/<section[^>]*data-tag="red"[^>]*>([\s\S]*?)<\/section>/);
        expect(redLaneMatch).toBeTruthy();
        expect(redLaneMatch![1]).toContain("Đình chỉ Y tế đến 18/11 · tối đa bậc 1");
        expect(redLaneMatch![1]).not.toContain('data-compact="true"');
    });

    it("R2: dashboard với một hàng xanh có dòng suspension (dựng bằng tay, trường hợp không xảy ra nhưng không được thu gọn) -> Không có data-compact='true'", async () => {
        const greenRow = buildRow({
            fighterId: "f-green",
            name: "Võ Sĩ Xanh",
            tag: "green",
            items: [{ kind: "suspension", text: "Đang tập lại theo bậc: tối đa bậc 3 đến 06/11", date: "2026-11-06" }],
        });
        vi.mocked(loadDoctorBoard).mockResolvedValueOnce(buildBoard([greenRow]));

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).not.toMatch(/data-tag="green"[^>]*data-compact="true"/);
        expect(html).not.toContain('data-compact="true"');
    });

    it("R3: dashboard với dòng suspension có date trong 7 ngày -> Chip 'Hết đình chỉ' trong khối td-week ở đúng ngày", async () => {
        const now = "2026-11-05T08:00:00Z";
        const suspRow = buildRow({
            fighterId: "f-hoang",
            name: "Hoàng Long",
            tag: "red",
            items: [{ kind: "suspension", text: "Đình chỉ Y tế đến 07/11 · tối đa bậc 1", date: "2026-11-07" }],
        });
        vi.mocked(loadDoctorBoard).mockResolvedValueOnce(buildBoard([suspRow], 0, now));

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        const weekMatch = html.match(/<ol class="td-week[^"]*">([\s\S]*?)<\/ol>/);
        expect(weekMatch).toBeTruthy();
        const days = weekMatch![1].match(/<li[^>]*class="[^"]*td-day[^"]*"[\s\S]*?<\/li>/g) ?? [];
        expect(days).toHaveLength(7);

        // Day index 2 is 2026-11-07 (since now is 2026-11-05, d=2)
        const targetDay = days[2];
        expect(targetDay).toContain("Hết đình chỉ");
        expect(targetDay).toContain("<b>Long</b>");

        // Other days do not contain "Hết đình chỉ"
        const otherDays = days.filter((_, idx) => idx !== 2);
        for (const d of otherDays) {
            expect(d).not.toContain("Hết đình chỉ");
        }
    });

    it("R4: dashboard với dòng suspension có graded true và date trong 7 ngày -> khối td-week chứa 'Hết lộ trình tập lại' tại ngày đó; dòng không có graded thì chứa 'Hết đình chỉ'", async () => {
        const now = "2026-11-05T08:00:00Z";
        const gradedRow = buildRow({
            fighterId: "f-graded",
            name: "Linh Phạm",
            tag: "amber",
            items: [
                {
                    kind: "suspension",
                    text: "Lộ trình bậc 3 đến 06/11", // does NOT contain "tập lại"
                    date: "2026-11-06",
                    graded: true,
                } as unknown as BoardItem,
            ],
        });
        const regularRow = buildRow({
            fighterId: "f-regular",
            name: "Hoàng Long",
            tag: "red",
            items: [
                {
                    kind: "suspension",
                    text: "Đình chỉ y tế tập lại đến 07/11", // contains "tập lại" but NO graded: true
                    date: "2026-11-07",
                },
            ],
        });
        vi.mocked(loadDoctorBoard).mockResolvedValueOnce(buildBoard([gradedRow, regularRow], 0, now));

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        const weekMatch = html.match(/<ol class="td-week[^"]*">([\s\S]*?)<\/ol>/);
        expect(weekMatch).toBeTruthy();
        const days = weekMatch![1].match(/<li[^>]*class="[^"]*td-day[^"]*"[\s\S]*?<\/li>/g) ?? [];
        expect(days).toHaveLength(7);

        // Day index 1 is 2026-11-06 (d=1 from 2026-11-05) -> must contain "Hết lộ trình tập lại"
        const day1 = days[1];
        expect(day1).toContain("Hết lộ trình tập lại");
        expect(day1).toContain("<b>Phạm</b>");

        // Day index 2 is 2026-11-07 (d=2 from 2026-11-05) -> must contain "Hết đình chỉ"
        const day2 = days[2];
        expect(day2).toContain("Hết đình chỉ");
        expect(day2).toContain("<b>Long</b>");
    });

    // ─── K2: Kiểm tra thẻ võ sĩ loadDoctorRow (K1 cũ đổi mã) ────────────────

    it("K2: loadDoctorRow của Hoàng Long (ca K1 cũ đổi mã) -> tag 'red' và có dòng việc suspension", async () => {
        const hoangFighter = createMockFighter("f-hoang-long", "Hoàng Long");
        const row = await loadDoctorRow(hoangFighter);
        expect(row).toBeDefined();
        expect(row?.tag).toBe("red");
        expect(row?.items.some((i) => i.kind === "suspension")).toBe(true);
    });
});
