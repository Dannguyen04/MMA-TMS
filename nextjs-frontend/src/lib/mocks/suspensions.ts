import { DEFAULT_MANUAL_BLOCKED_SESSION_TYPES } from "@/lib/domain/intensity-tiers";
import type { Suspension } from "@/lib/domain/types";
import { addDaysToDate } from "@/lib/domain/suspension-rules";
import { MOCK_ANCHOR_MS, TODAY_KEY } from "@/lib/mocks/time";

/**
 * Builds the demo seed suspensions covering all 5 required business cases (B2-7):
 * 1. Đang đình chỉ KO: Marcus Hale (`f-marcus-hale`)
 * 2. Chờ xác nhận: Diego Alvarez (`f-diego-alvarez`)
 * 3. Đang tập lại bậc 3 hôm nay: Lucas Ferreira (`f-lucas-ferreira`)
 * 4. Nghỉ bắt buộc có buổi chờ xếp lại: Tariq Haddad (`f-tariq-haddad`)
 * 5. Sẵn sàng: Emma Lindqvist (`f-emma-lindqvist`, không có đình chỉ)
 */
export function buildMockSuspensions(): Suspension[] {
    const today = TODAY_KEY;
    const startOfDayMs = new Date(`${today}T00:00:01+07:00`).getTime();
    const clearedAtMs = Math.max(startOfDayMs, MOCK_ANCHOR_MS - 30 * 60_000);
    const clearedAt = new Date(clearedAtMs).toISOString();

    return [
        // 1. Đang đình chỉ KO (Marcus Hale)
        {
            id: "susp-active-ko",
            fighterId: "f-marcus-hale",
            boutId: null,
            reason: "KO",
            startsOn: addDaysToDate(today, -10),
            endsOn: addDaysToDate(today, 19), // 30 days total
            lossOfConsciousness: "OVER_1_MIN",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
            maxAllowedTier: 1,
            requiresClearance: true,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "u-coach-rafael",
            createdAt: `${addDaysToDate(today, -10)}T08:00:00.000Z`,
            updatedAt: `${addDaysToDate(today, -10)}T08:00:00.000Z`,
            status: "ACTIVE",
            gradedReturn: null,
        },
        // 2. Chờ xác nhận (Diego Alvarez)
        {
            id: "susp-awaiting-clearance",
            fighterId: "f-diego-alvarez",
            boutId: null,
            reason: "TKO",
            startsOn: addDaysToDate(today, -40),
            endsOn: addDaysToDate(today, -11), // 30 days total, ended 10 days ago
            lossOfConsciousness: "NONE",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
            maxAllowedTier: 1,
            requiresClearance: true,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "u-coach-rafael",
            createdAt: `${addDaysToDate(today, -40)}T08:00:00.000Z`,
            updatedAt: `${addDaysToDate(today, -40)}T08:00:00.000Z`,
            status: "AWAITING_CLEARANCE",
            gradedReturn: null,
        },
        // 3. Đang tập lại bậc 3 hôm nay (Lucas Ferreira: KO được xác nhận hôm nay)
        {
            id: "susp-graded-return",
            fighterId: "f-lucas-ferreira",
            boutId: null,
            reason: "KO",
            startsOn: addDaysToDate(today, -35),
            endsOn: addDaysToDate(today, -6), // 30 days total, ended 5 days ago
            lossOfConsciousness: "UNDER_1_MIN",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
            maxAllowedTier: 1,
            requiresClearance: true,
            clearedAt,
            clearedById: "u-coach-rafael",
            clearanceNote: "Khám thần kinh và CT scan bình thường, bác sĩ cho phép tập lại theo lộ trình bậc.",
            createdById: "u-coach-rafael",
            createdAt: `${addDaysToDate(today, -35)}T08:00:00.000Z`,
            updatedAt: `${today}T08:00:00.000Z`,
            status: "ENDED",
            gradedReturn: {
                ceiling: 3,
                fullReturnOn: addDaysToDate(today, 2),
            },
        },
        // 4. Nghỉ bắt buộc có buổi chờ xếp lại (Tariq Haddad)
        {
            id: "susp-mandatory-rest",
            fighterId: "f-tariq-haddad",
            boutId: null,
            reason: "MANDATORY_REST",
            startsOn: addDaysToDate(today, -1),
            endsOn: addDaysToDate(today, 5), // 7 days total
            lossOfConsciousness: null,
            suggestedDays: 7,
            overrideReason: null,
            blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
            maxAllowedTier: 1,
            requiresClearance: false,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "u-coach-rafael",
            createdAt: `${addDaysToDate(today, -1)}T08:00:00.000Z`,
            updatedAt: `${addDaysToDate(today, -1)}T08:00:00.000Z`,
            status: "ACTIVE",
            gradedReturn: null,
        },
    ];
}
