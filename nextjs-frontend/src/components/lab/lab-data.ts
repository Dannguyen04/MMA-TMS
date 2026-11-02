/**
 * Static data for the /lab prototypes. Every shape is the app's own domain type, so the prototypes
 * draw only fields the product already records: nothing here exists outside types.ts / round-advice.ts.
 */
import type { TacticOutcome, SelfScore } from "@/lib/domain/round-advice";
import type { BodyRegion, Injury, MedicalClearance, TrainingType } from "@/lib/domain/types";

export const LAB_NOW = "2026-10-29T09:00:00+07:00";

export const LAB_FIGHTER = {
    name: "Trần Minh Khang",
    nickname: "Khang “Cơn lốc”",
    weightClass: "Hạng nhẹ · 70,3 kg",
    fightDate: "2026-11-21",
    opponent: "Lê Quốc Bảo",
};

export const LAB_INJURIES: Injury[] = [
    {
        id: "inj-1",
        fighterId: "f-1",
        recordedById: "d-1",
        type: null,
        typeLabel: "Bong gân dây chằng bên trong",
        bodyRegion: "left_knee",
        severity: "moderate",
        status: "recovering",
        mechanism: "grappling",
        occurredAt: "2026-10-12",
        diagnosedAt: "2026-10-13",
        description: "Vặn gối khi tranh vật, đau mặt trong gối trái.",
        expectedReturnAt: "2026-11-05",
        resolvedAt: null,
        linkedAlertId: null,
    },
    {
        id: "inj-2",
        fighterId: "f-1",
        recordedById: "d-1",
        type: null,
        typeLabel: "Chấn động nhẹ",
        bodyRegion: "head",
        severity: "severe",
        status: "active",
        mechanism: "sparring",
        occurredAt: "2026-10-26",
        diagnosedAt: "2026-10-26",
        description: "Trúng đòn móc phải khi đấu tập, choáng khoảng 10 giây.",
        expectedReturnAt: "2026-11-09",
        resolvedAt: null,
        linkedAlertId: null,
    },
    {
        id: "inj-3",
        fighterId: "f-1",
        recordedById: "d-1",
        type: null,
        typeLabel: "Bầm xương sườn",
        bodyRegion: "ribs",
        severity: "minor",
        status: "recovering",
        mechanism: "heavy_bag",
        occurredAt: "2026-10-20",
        diagnosedAt: "2026-10-21",
        description: "Đau khi xoay người, không gãy.",
        expectedReturnAt: "2026-11-01",
        resolvedAt: null,
        linkedAlertId: null,
    },
    {
        id: "inj-4",
        fighterId: "f-1",
        recordedById: "d-1",
        type: null,
        typeLabel: "Căng cơ đùi sau",
        bodyRegion: "right_hamstring",
        severity: "minor",
        status: "resolved",
        mechanism: "strength_conditioning",
        occurredAt: "2026-09-18",
        diagnosedAt: "2026-09-18",
        description: "Đã hồi phục, tập lại đủ.",
        expectedReturnAt: "2026-10-02",
        resolvedAt: "2026-10-02",
        linkedAlertId: null,
    },
];

export const LAB_CLEARANCE: MedicalClearance = {
    id: "clr-1",
    fighterId: "f-1",
    doctorId: "d-1",
    level: "restricted",
    status: "active",
    issuedAt: "2026-10-27",
    validUntil: "2026-11-10",
    reason: "Theo dõi chấn động, gối trái đang hồi phục.",
    restrictions: [
        {
            id: "r-1",
            label: "Quy trình chấn động",
            blockedTrainingTypes: ["sparring"],
            blockedTechniques: [],
            blockedRegions: ["head", "neck"],
            maxRpe: 6,
        },
        {
            id: "r-2",
            label: "Bảo vệ gối trái",
            blockedTrainingTypes: [],
            blockedTechniques: ["kick"],
            blockedRegions: ["left_knee"],
            maxRpe: null,
        },
    ],
    examinationId: "ex-1",
    revokedAt: null,
    revokedReason: null,
};

/** The sessions the coach can try to schedule in the clearance check. RPE and loaded regions as the library records them. */
export interface LabPlannedSession {
    type: TrainingType;
    label: string;
    targetRpe: number;
    loadsRegions: BodyRegion[];
}

export const LAB_SESSIONS: LabPlannedSession[] = [
    { type: "recovery_mobility", label: "Hồi phục", targetRpe: 3, loadsRegions: ["lower_back", "left_hip", "right_hip"] },
    { type: "pad_work", label: "Đấm đích", targetRpe: 6, loadsRegions: ["left_shoulder", "right_shoulder", "left_hand", "right_hand", "ribs"] },
    { type: "grappling", label: "Vật", targetRpe: 7, loadsRegions: ["neck", "left_knee", "right_knee", "lower_back", "left_shoulder", "right_shoulder"] },
    { type: "sparring", label: "Đấu tập", targetRpe: 8, loadsRegions: ["head", "neck", "ribs", "left_hand", "right_hand", "left_shin", "right_shin"] },
];

/* ─── Bout: one recorded fight, three rounds ─────────────────────────────── */

export interface LabTactic {
    id: string;
    text: string;
}

export const LAB_TACTICS: LabTactic[] = [
    { id: "t1", text: "Jab đôi rồi đá thấp chân trước" },
    { id: "t2", text: "Ép lưới, vật hai chân khi Bảo vung tay phải" },
    { id: "t3", text: "Đổi sang southpaw, đấm thẳng trái vào thân" },
];

export interface LabRound {
    roundNo: number;
    tacticMarks: Record<string, TacticOutcome>;
    selfScore: SelfScore;
    knockdownsAgainst: number;
    stunned: boolean;
    bleeding: boolean;
    fatigued: boolean;
    note: string | null;
    /** Corner advice given in the break after this round (the R20–R24 rules write it today; T-038 will let AI draft it). */
    advice: string[] | null;
    /** Safety flag on the advice (R24): red when knockdowns or stunned rounds pile up. */
    safetyRed: boolean;
}

export const LAB_ROUNDS: LabRound[] = [
    {
        roundNo: 1,
        tacticMarks: { t1: "EFFECTIVE", t2: "NOT_USED", t3: "INEFFECTIVE" },
        selfScore: "WIN",
        knockdownsAgainst: 0,
        stunned: false,
        bleeding: false,
        fatigued: false,
        note: "Bảo chậm khi lùi về bên trái.",
        advice: ["Giữ jab đôi và đá thấp: đang ăn điểm.", "Thử ép lưới khi Bảo vung tay phải lần đầu.", "Southpaw không vào, chỉ thử thêm một lần."],
        safetyRed: false,
    },
    {
        roundNo: 2,
        tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE", t3: "INEFFECTIVE" },
        selfScore: "CLOSE",
        knockdownsAgainst: 1,
        stunned: true,
        bleeding: true,
        fatigued: false,
        note: "Dính móc phải phút thứ 4, rách cung mày trái.",
        advice: ["Bỏ southpaw: hai hiệp không hiệu quả.", "Đứng ngoài tầm tay phải, cằm thấp, lùi chéo sang trái.", "Đã choáng một lần: thêm lần nữa là bác sĩ dừng trận."],
        safetyRed: true,
    },
    {
        roundNo: 3,
        tacticMarks: { t1: "EFFECTIVE", t2: "EFFECTIVE", t3: "NOT_USED" },
        selfScore: "WIN",
        knockdownsAgainst: 0,
        stunned: false,
        bleeding: true,
        fatigued: true,
        note: "Hai lần vật ngã thành công, cuối hiệp hụt hơi.",
        advice: null,
        safetyRed: false,
    },
];

/* ─── Camp: eight weeks to the fight ─────────────────────────────────────── */

export type LabPhase = "base" | "build" | "fight_camp" | "taper";

export const LAB_CAMP = {
    start: "2026-09-27",
    fight: "2026-11-21",
    phases: [
        { phase: "base" as LabPhase, label: "Nền tảng", weeks: 2 },
        { phase: "build" as LabPhase, label: "Tăng tải", weeks: 3 },
        { phase: "fight_camp" as LabPhase, label: "Trại đấu", weeks: 2 },
        { phase: "taper" as LabPhase, label: "Giảm tải", weeks: 1 },
    ],
    suspension: { from: "2026-10-26", to: "2026-11-09", label: "Đình chỉ: chấn động khi đấu tập" },
    /** Sessions on the plan: day offset from camp start and type. */
    sessions: buildSessions(),
    weights: [
        { day: 0, kg: 76.8 },
        { day: 7, kg: 76.1 },
        { day: 14, kg: 75.6 },
        { day: 21, kg: 75.0 },
        { day: 28, kg: 74.6 },
        { day: 32, kg: 74.4 },
    ],
    targetKg: 70.3,
};

function buildSessions(): { day: number; type: TrainingType }[] {
    const week: TrainingType[] = ["pad_work", "strength_conditioning", "sparring", "grappling", "technical_drilling", "recovery_mobility"];
    const out: { day: number; type: TrainingType }[] = [];
    for (let day = 0; day < 55; day++) {
        const weekday = day % 7;
        if (weekday === 6) continue;
        out.push({ day, type: week[weekday] });
    }
    return out;
}
