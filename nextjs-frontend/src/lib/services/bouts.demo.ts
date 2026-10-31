import type {
    OpponentAnalysis,
    RoundRecord,
} from "@/lib/domain/round-advice";
import type { CoachTodo, WeightFeasibility } from "@/lib/domain/types";
import { buildDemoCoachTodo } from "@/lib/domain/coach-todo";
import { boutGate1, calculateWeightFeasibility, feasibilityWarnings, computeWeighInReminder, requirementsDueOn } from "@/lib/domain/bout-rules";
import type { FeasibilityInput } from "./bouts";
import "server-only";

import {
    boutLimitKg,
    isActivePhase,
    isRunningPhase,
    type BoutHistoryEntry,
    type BoutOutcome,
    type BoutPhase,
    type BoutRequirement,
    type CampBout,
    type CancelReason,
    type CompetitionRuleset,
    type HydrationCheck,
    type NutritionCheckin,
    type NutritionPhaseKey,
    type NutritionPlan,
    type Suspension,
    type WeightClassOption,
} from "@/lib/domain/bout";
import {
    acuteLossLimitPct,
    boutOn,
    canCancel,
    canEditSchedule,
    canEnterFightWeek,
    canRecordResult,
    canTransition,
    checklistLocked,
    computeAcuteLoss,
    madeWeight,
    passesWeighIn,
    requirementCode,
    requirementsFromTemplates,
    type Gate1Gap,
    type RequirementUpdate,
} from "@/lib/domain/bout-rules";
import { BOUT_PHASE_LABELS, CANCEL_REASON_LABELS, GATE1_REASON_LABELS } from "@/lib/domain/labels";
import { blockingSuspensions, isSuspensionActive, suspensionEndsOn, type SuspensionDraft } from "@/lib/domain/suspension-rules";
import { wayOffCount } from "@/lib/domain/nutrition";
import type { TrainingPlan, TrainingType } from "@/lib/domain/types";
import type { PlanAdherence } from "@/lib/domain/weight-chart";
import { buildWeightTrack, type WeightTrack } from "@/lib/domain/weight-track";
import type { WriteResult } from "@/lib/domain/write-result";
import { academyWallClockToIso, addDaysToKey, dayKey, daysBetweenKeys, formatDate } from "@/lib/format";
import { AIBA_REFERENCE_ID, CUSTOM_RULESET_ID, mockRulesets, VMMAF_2021_ID } from "@/lib/mocks/rulesets";
import { TODAY_KEY } from "@/lib/mocks/time";
import { round } from "@/lib/utils";

/**
 * The demo's bouts, camp weights, plan answers and suspensions. One in-memory store per server process, seeded
 * relative to the academy day it is first read on; restart the dev server to reset it. Every rule comes from
 * `lib/domain/bout-rules.ts` and `suspension-rules.ts`, the same functions the pages use.
 *
 * Seed (review 2, option a): Minh has no bout, so the coach creates one live. Kenji is red with a complete
 * checklist and can enter fight week; Aigerim is yellow; Emma is grey, and Gate 1 stops her fight week on a missing
 * "Chụp CT não" past the documents deadline (T-008a F3).
 * Linh is in fight week with weigh-in and bout today, for the official weigh-in and result. Diego has a
 * hand-entered suspension after a knockout in sparring.
 */

export type DemoBoutRecord = CampBout & {
    scheduledRounds?: number | null;
    opponentAnalysis?: OpponentAnalysis;
    boutRounds?: RoundRecord[];
};

type MeasurementContext = "SELF_REPORTED" | "WEIGH_IN";

interface DemoMeasurement {
    fighterId: string;
    academyDate: string;
    kg: number;
    recordedAt: string;
    context: MeasurementContext;
}

interface CampStore {
    rulesets: CompetitionRuleset[];
    bouts: DemoBoutRecord[];
    measurements: DemoMeasurement[];
    checkins: NutritionCheckin[];
    suspensions: Suspension[];
    sequence: number;
}

export interface Actor {
    name: string;
}

export type CreateResult = { ok: true; boutId: string; warning: string | null } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type FightWeekResult = { ok: true } | { ok: false; message: string; lines: string[] };

const STATUS_ORDER = { OVER_LIMIT: 0, ABOVE_TARGET: 1, NOT_WEIGHED: 2, ON_TRACK: 3, NEUTRAL: 4 } as const;

const RAFAEL_ID = "c-rafael-costa";
const RAFAEL = "Rafael Costa";

const STORE_KEY = Symbol.for("mma-tms.demo-camp-store");
const holder = globalThis as typeof globalThis & { [STORE_KEY]?: CampStore };

/** The in-memory camp, seeded on the same anchor day as the other mocks (the linked training plans). */
export function demoCampStore(): CampStore {
    holder[STORE_KEY] ??= createCampStore(TODAY_KEY);
    return holder[STORE_KEY];
}

export function resetDemoCampStore(todayOn = dayKey(new Date())): CampStore {
    holder[STORE_KEY] = createCampStore(todayOn);
    return holder[STORE_KEY];
}

/* ─── Seed ────────────────────────────────────────────────────────────────── */

const EMPTY_PLAN: NutritionPlan = { camp: null, fightWeek: null, postWeighIn: null };

function ruleset(id: string): CompetitionRuleset {
    const found = mockRulesets.find((item) => item.id === id);
    if (!found) throw new Error(`Unknown ruleset ${id}`);
    return found;
}

function weightClassOf(rulesetId: string, code: string): WeightClassOption {
    const found = ruleset(rulesetId).weightClasses.find((item) => item.code === code);
    if (!found) throw new Error(`Unknown weight class ${code} in ${rulesetId}`);
    return found;
}

/** Seed documents keep the codes their English names gave them; the labels are what the coach typed. */
interface SeedDocument {
    code: string;
    label: string;
}

const HEALTH_CERTIFICATE: SeedDocument = { code: "HEALTH_CERTIFICATE", label: "Giấy khám sức khoẻ" };
const BLOOD_TEST: SeedDocument = { code: "BLOOD_TEST", label: "Xét nghiệm máu" };
const BRAIN_CT: SeedDocument = { code: "BRAIN_CT", label: "Chụp CT não" };

function provided({ code, label }: SeedDocument, issuedOn: string, validityDays: number): BoutRequirement {
    return {
        id: code,
        code,
        label,
        required: true,
        state: "PROVIDED",
        source: "COACH",
        issuedOn,
        validUntil: addDaysToKey(issuedOn, validityDays),
        statusReason: null,
        validityDays,
    };
}

function missing({ code, label }: SeedDocument, validityDays: number | null, required = true): BoutRequirement {
    return { id: code, code, label, required, state: "MISSING", source: "COACH", issuedOn: null, validUntil: null, statusReason: null, validityDays };
}

/** Daily weights from `fromOn` to `toOn`, evenly from `fromKg` to `toKg`, logged at 07:00 (T-008a). */
export function weightSeries(fighterId: string, fromOn: string, toOn: string, fromKg: number, toKg: number): DemoMeasurement[] {
    const days = daysBetweenKeys(fromOn, toOn);
    return Array.from({ length: days + 1 }, (_, index) => {
        const academyDate = addDaysToKey(fromOn, index);
        const kg = round(days === 0 ? toKg : fromKg + ((toKg - fromKg) * index) / days, 1);
        return { fighterId, academyDate, kg, recordedAt: academyWallClockToIso(academyDate, "07:00"), context: "SELF_REPORTED" as const };
    });
}

interface SeedBout {
    id: string;
    fighterId: string;
    rulesetId: string;
    weightClass: WeightClassOption;
    event: string;
    venue: string | null;
    opponent: string | null;
    weighIn: [number, string];
    bout: [number, string];
    phase: BoutPhase;
    trainingPlanId: string;
    campStartDay: number;
    createdDay: number;
    requirements: BoutRequirement[];
    nutritionPlan?: NutritionPlan;
    /** Day offsets of each move after creation, in order. */
    moves: [BoutPhase, number][];
    weighInRecord?: CampBout["weighIn"];
    scheduledRounds?: number | null;
    opponentAnalysis?: OpponentAnalysis;
    boutRounds?: RoundRecord[];
}

function seedBout(spec: SeedBout, todayOn: string): DemoBoutRecord {
    const rules = ruleset(spec.rulesetId);
    const weighInAt = academyWallClockToIso(addDaysToKey(todayOn, spec.weighIn[0]), spec.weighIn[1]);
    const boutAt = academyWallClockToIso(addDaysToKey(todayOn, spec.bout[0]), spec.bout[1]);
    const createdOn = addDaysToKey(todayOn, spec.createdDay);
    let from: BoutPhase = "SCHEDULED";
    const history: BoutHistoryEntry[] = [{ at: academyWallClockToIso(createdOn, "16:00"), by: RAFAEL, from: null, to: "SCHEDULED" }];
    for (const [to, day] of spec.moves) {
        history.push({ at: academyWallClockToIso(addDaysToKey(todayOn, day), "16:30"), by: RAFAEL, from, to });
        from = to;
    }
    return {
        id: spec.id,
        fighterId: spec.fighterId,
        coachId: RAFAEL_ID,
        rulesetId: rules.id,
        rulesetName: rules.name,
        rulesetVerified: rules.verified,
        sport: rules.sport,
        event: spec.event,
        venue: spec.venue,
        opponent: spec.opponent,
        weightClassCode: spec.weightClass.code,
        weightClassLabel: spec.weightClass.label,
        limitKg: spec.weightClass.limitKg,
        catchweightKg: null,
        acuteLossLimitPct: acuteLossLimitPct(weighInAt, boutAt, rules),
        acuteWindowDays: rules.acuteWindowDays,
        requirementsDueDays: rules.requirementsDueDays,
        fightWeekDays: rules.fightWeekDays,
        weighInAt,
        boutAt,
        phase: spec.phase,
        trainingPlanId: spec.trainingPlanId,
        campStartedOn: addDaysToKey(todayOn, spec.campStartDay),
        createdOn,
        notes: null,
        cancelReason: null,
        cancelNote: null,
        requirements: spec.requirements,
        nutritionPlan: spec.nutritionPlan ?? { ...EMPTY_PLAN },
        history,
        weighIn: spec.weighInRecord ?? null,
        outcome: null,
        checklistUnlock: null,
        ...(spec.scheduledRounds !== undefined ? { scheduledRounds: spec.scheduledRounds } : {}),
        ...(spec.opponentAnalysis !== undefined ? { opponentAnalysis: spec.opponentAnalysis } : {}),
        ...(spec.boutRounds !== undefined ? { boutRounds: spec.boutRounds } : {}),
    };
}

export function createCampStore(todayOn: string): CampStore {
    const day = (offset: number) => addDaysToKey(todayOn, offset);
    const noteAt = academyWallClockToIso(day(-20), "08:00");

    const bouts: DemoBoutRecord[] = [
        seedBout(
            {
                id: "b-kenji-pacific",
                fighterId: "f-kenji-morita",
                rulesetId: VMMAF_2021_ID,
                weightClass: weightClassOf(VMMAF_2021_ID, "56"),
                event: "Pacific Invitational 4",
                venue: "Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh",
                opponent: "Ryo Tanaka",
                weighIn: [3, "10:00"],
                bout: [4, "19:00"],
                phase: "CAMP",
                trainingPlanId: "tp-kenji-fight-camp",
                campStartDay: -35,
                createdDay: -40,
                moves: [["CAMP", -35]],
                requirements: [provided(HEALTH_CERTIFICATE, day(-20), 180), provided(BLOOD_TEST, day(-10), 90), provided(BRAIN_CT, day(-15), 365)],
                nutritionPlan: {
                    camp: { text: "Cá, cơm và rau đúng giờ như thường lệ. Không uống nước ngọt.", authorName: RAFAEL, updatedAt: noteAt },
                    fightWeek: null,
                    postWeighIn: null,
                },
            },
            todayOn,
        ),
        seedBout(
            {
                id: "b-aigerim-asian",
                fighterId: "f-aigerim-sadykova",
                rulesetId: AIBA_REFERENCE_ID,
                weightClass: weightClassOf(AIBA_REFERENCE_ID, "51"),
                event: "Asian Combat Series 9",
                venue: "Almaty Arena",
                opponent: "Mai Hoshino",
                weighIn: [27, "08:00"],
                bout: [27, "18:00"],
                phase: "CAMP",
                trainingPlanId: "tp-aigerim-camp",
                campStartDay: -43,
                createdDay: -45,
                moves: [["CAMP", -43]],
                requirements: [provided(HEALTH_CERTIFICATE, day(-12), 180), missing(BLOOD_TEST, 90, false)],
            },
            todayOn,
        ),
        seedBout(
            {
                id: "b-emma-nordic",
                fighterId: "f-emma-lindqvist",
                rulesetId: CUSTOM_RULESET_ID,
                weightClass: { code: "57", label: "57 kg", limitKg: 57 },
                event: "Nordic Open 12",
                venue: "Stockholm",
                opponent: null,
                weighIn: [5, "09:00"],
                bout: [6, "19:00"],
                phase: "CAMP",
                trainingPlanId: "tp-emma-nordic-camp",
                campStartDay: -30,
                createdDay: -32,
                moves: [["CAMP", -30]],
                requirements: [provided(HEALTH_CERTIFICATE, day(-25), 180), provided(BLOOD_TEST, day(-6), 90), missing(BRAIN_CT, 365)],
            },
            todayOn,
        ),
        seedBout(
            {
                id: "b-linh-saigon",
                fighterId: "f-linh-pham",
                rulesetId: AIBA_REFERENCE_ID,
                weightClass: weightClassOf(AIBA_REFERENCE_ID, "60"),
                event: "Saigon Amateur Night 5",
                venue: "Trung tâm Thể thao Quận 1, TP. Hồ Chí Minh",
                opponent: "Vũ Mai Anh",
                weighIn: [0, "07:00"],
                bout: [0, "18:00"],
                phase: "FIGHT_WEEK",
                trainingPlanId: "tp-linh-fight-camp",
                campStartDay: -28,
                createdDay: -30,
                moves: [
                    ["CAMP", -28],
                    ["FIGHT_WEEK", -5],
                ],
                requirements: [provided(HEALTH_CERTIFICATE, day(-40), 180), provided(BLOOD_TEST, day(-9), 90)],
                nutritionPlan: {
                    camp: { text: "Ba bữa chính bình thường, ăn thêm trái cây sau buổi tập.", authorName: RAFAEL, updatedAt: noteAt },
                    fightWeek: { text: "Ăn như giai đoạn chuẩn bị. Giữ khẩu phần ổn định, tuần này không thử món mới.", authorName: RAFAEL, updatedAt: noteAt },
                    postWeighIn: { text: "Ăn sáng bình thường sau khi cân, rồi ăn trưa nhẹ.", authorName: RAFAEL, updatedAt: noteAt },
                },
            },
            todayOn,
        ),
        seedBout(
            {
                id: "bout-weighed-in",
                fighterId: "f-diego-alvarez",
                rulesetId: VMMAF_2021_ID,
                weightClass: weightClassOf(VMMAF_2021_ID, "65"),
                event: "Vietnam MMA Open 2026",
                venue: "Nhà thi đấu Quân khu 7, TP. Hồ Chí Minh",
                opponent: "Lê Hoàng Nam",
                weighIn: [-1, "09:00"],
                bout: [0, "20:00"],
                phase: "WEIGHED_IN",
                trainingPlanId: "tp-diego-camp",
                campStartDay: -35,
                createdDay: -40,
                moves: [
                    ["CAMP", -35],
                    ["FIGHT_WEEK", -7],
                    ["WEIGHED_IN", -1],
                ],
                requirements: [provided(HEALTH_CERTIFICATE, day(-25), 180), provided(BLOOD_TEST, day(-15), 90)],
                weighInRecord: {
                    weightKg: 64.8,
                    madeWeight: true,
                    hydrationCheck: "PASSED",
                    recordedAt: academyWallClockToIso(day(-1), "09:15"),
                    catchweightNote: null,
                    acuteLoss: {
                        startKg: 66.0,
                        startOn: day(-6),
                        lossPct: 1.8,
                        limitPct: 8.0,
                        status: "WITHIN",
                    },
                },
                scheduledRounds: 3,
                opponentAnalysis: {
                    profile: {
                        wins: 6,
                        losses: 2,
                        draws: 0,
                        stance: "SOUTHPAW",
                        style: "STRIKER",
                        heightCm: 174,
                        reachCm: 176,
                        source: "Tapology & băng hình giải CLB 2025",
                    },
                    observations: [
                        {
                            id: "obs-1",
                            kind: "HABIT",
                            text: "Hạ tay phải sau khi tung đòn đá thấp chân sau (left low kick)",
                            evidenceUrl: "https://www.youtube.com/watch?v=dKw5POIXlsI&t=105s",
                            evidenceTime: "01:45",
                            evidenceNote: "Lặp lại ở hiệp 1 và hiệp 2 trận bán kết 2025",
                            confidence: "REPEATED",
                        },
                        {
                            id: "obs-2",
                            kind: "OPENING",
                            text: "Di chuyển lùi thẳng về phía lồng khi bị áp sát bằng đòn tay",
                            evidenceUrl: null,
                            evidenceTime: null,
                            evidenceNote: "Trận gặp Nguyễn Vũ (2025), hiệp 2",
                            confidence: "REPEATED",
                        },
                        {
                            id: "obs-3",
                            kind: "STRENGTH",
                            text: "Đòn móc trái phản công rất nặng ở cự ly gần khi đối phương lao vào",
                            evidenceUrl: "https://www.youtube.com/watch?v=dKw5POIXlsI&t=32s",
                            evidenceTime: "00:32",
                            evidenceNote: "Thắng TKO hiệp 1 nhờ đòn phản công này",
                            confidence: "ONCE",
                        },
                        {
                            id: "obs-4",
                            kind: "HABIT",
                            text: "Nhịp thở chậm lại và đứng trụ nặng từ cuối hiệp 2",
                            evidenceUrl: null,
                            evidenceTime: null,
                            evidenceNote: "Ghi chép góc đài tại giải mở rộng",
                            confidence: "ONCE",
                        },
                    ],
                    tactics: [
                        {
                            id: "tac-1",
                            text: "Bước chéo sang trái, phản đòn móc trái ngay khi đối thủ thu chân đá thấp",
                            round: null,
                            observationIds: ["obs-1"],
                            sessionIds: ["ts-1"],
                            partnerBrief: "Bạn tập đứng southpaw, đá low kick chân sau rồi hạ nhẹ tay phải",
                        },
                        {
                            id: "tac-2",
                            text: "Ép góc bằng chuỗi jab - đấm thẳng rồi cắt góc ngang không cho lùi thẳng",
                            round: 1,
                            observationIds: ["obs-2"],
                            sessionIds: [],
                            partnerBrief: "Bạn tập lùi thẳng về lồng khi bị áp sát liên tiếp",
                        },
                        {
                            id: "tac-3",
                            text: "Giữ tay phải cao che hàm khi thoát áp sát, không đổi đòn tay cự ly ngắn",
                            round: 2,
                            observationIds: ["obs-3"],
                            sessionIds: ["ts-2"],
                            partnerBrief: "Bạn tập chờ đối phương vào gần rồi tung móc trái phản công",
                        },
                        {
                            id: "tac-4",
                            text: "Tăng nhịp đòn vào vùng bụng và đổi tầng vật từ giữa hiệp 2",
                            round: null,
                            observationIds: ["obs-4"],
                            sessionIds: [],
                            partnerBrief: null,
                        },
                    ],
                    updatedAt: academyWallClockToIso(day(-2), "18:00"),
                    updatedById: "u-rafael-costa",
                },
                boutRounds: [],
            },
            todayOn,
        ),
    ];

    const measurements: DemoMeasurement[] = [
        // Minh logs from the start of his camp plan until four days ago, so he is grey until he logs on stage.
        ...weightSeries("f-minh-tran", day(-28), day(-4), 70, 67.2),
        ...weightSeries("f-kenji-morita", day(-14), day(-1), 64.4, 62.8),
        ...weightSeries("f-aigerim-sadykova", day(-14), day(-1), 55, 55.6),
        ...weightSeries("f-emma-lindqvist", day(-20), day(-4), 59.5, 57.6),
        ...weightSeries("f-linh-pham", day(-14), day(-1), 59.6, 58.4),
    ];

    const checkins: NutritionCheckin[] = [
        checkin("b-kenji-pacific", day(-2), "WAY_OFF", "Ăn ngoài sau buổi đấu tập."),
        checkin("b-kenji-pacific", day(-1), "WAY_OFF", null),
        checkin("b-kenji-pacific", todayOn, "SLIGHTLY_OFF", null),
    ];

    const suspensions: Suspension[] = [
        {
            id: "sus-diego-sparring",
            fighterId: "f-diego-alvarez",
            boutId: null,
            reason: "KO",
            startsOn: day(-6),
            endsOn: suspensionEndsOn(day(-6), 30),
            lossOfConsciousness: "UNDER_1_MIN",
            suggestedDays: null,
            overrideReason: null,
            blockedSessionTypes: ["sparring", "grappling"],
            requiresClearance: true,
            clearedAt: null,
            clearedBy: null,
            clearanceNote: null,
            createdBy: RAFAEL,
            createdAt: academyWallClockToIso(day(-6), "19:10"),
            note: "Bị knock-out khi đấu tập. Tập lại từng bước theo hướng dẫn của bác sĩ thể thao.",
        },
    ];

    return { rulesets: mockRulesets.map(cloneRuleset), bouts, measurements, checkins, suspensions, sequence: 1 };
}

function checkin(boutId: string, loggedOn: string, adherence: PlanAdherence, note: string | null): NutritionCheckin {
    return {
        boutId,
        loggedOn,
        academyDate: addDaysToKey(loggedOn, -1),
        adherence,
        note,
        recordedAt: academyWallClockToIso(loggedOn, "07:40"),
    };
}

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export function listDemoRulesets(): CompetitionRuleset[] {
    return demoCampStore().rulesets.map(cloneRuleset);
}

export function getDemoRuleset(id: string): CompetitionRuleset | null {
    const found = demoCampStore().rulesets.find((item) => item.id === id);
    return found ? cloneRuleset(found) : null;
}

export function listDemoBouts(fighterIds: string[] | "all" = "all"): CampBout[] {
    return demoCampStore()
        .bouts.filter((bout) => fighterIds === "all" || fighterIds.includes(bout.fighterId))
        .map(cloneBout);
}

export function getDemoBout(boutId: string): CampBout | null {
    const bout = findBout(boutId);
    return bout ? cloneBout(bout) : null;
}

/** The fighter's running bout with the earliest weigh-in. */
export function getDemoCurrentBout(fighterId: string): CampBout | null {
    const running = demoCampStore()
        .bouts.filter((bout) => bout.fighterId === fighterId && isRunningPhase(bout.phase))
        .sort((a, b) => (a.weighInAt < b.weighInAt ? -1 : 1));
    return running[0] ? cloneBout(running[0]) : null;
}

export function demoWeightTrack(boutId: string, now = new Date()): WeightTrack | null {
    const camp = demoCampStore();
    const bout = camp.bouts.find((item) => item.id === boutId);
    if (!bout) return null;
    const todayOn = dayKey(now);
    const adherenceByDay = new Map(camp.checkins.filter((item) => item.boutId === bout.id).map((item) => [item.loggedOn, item.adherence]));
    const track = buildWeightTrack({
        limitKg: boutLimitKg(bout),
        acuteLossLimitPct: bout.acuteLossLimitPct,
        acuteWindowDays: bout.acuteWindowDays,
        campStartedOn: bout.campStartedOn,
        weighInOn: dayKey(bout.weighInAt),
        todayOn,
        points: camp.measurements
            .filter((item) => item.fighterId === bout.fighterId)
            .map((item) => ({ date: item.academyDate, kg: item.kg, adherence: adherenceByDay.get(item.academyDate) ?? null })),
    });
    return { ...track, status: ["WEIGHED_IN", "COMPLETED", "CANCELLED"].includes(bout.phase) ? "NEUTRAL" : track.status };
}

export interface DemoWeightAlert {
    bout: CampBout;
    track: WeightTrack;
    wayOff: number;
}

export function listDemoWeightAlerts(fighterIds: string[] | "all", now = new Date()): DemoWeightAlert[] {
    const todayOn = dayKey(now);
    return listDemoBouts(fighterIds)
        .filter((bout) => isRunningPhase(bout.phase))
        .flatMap((bout) => {
            const track = demoWeightTrack(bout.id, now);
            if (!track || (track.status === "ON_TRACK" || track.status === "NEUTRAL")) return [];
            return [{ bout, track, wayOff: wayOffCount(campCheckins(bout.id), todayOn) }];
        })
        .sort((a, b) => STATUS_ORDER[a.track.status] - STATUS_ORDER[b.track.status] || (a.bout.weighInAt < b.bout.weighInAt ? -1 : 1));
}

export function demoCheckinsFor(boutId: string): NutritionCheckin[] {
    return campCheckins(boutId).map((item) => ({ ...item }));
}

export function listDemoSuspensions(fighterIds: string[] | "all" = "all"): Suspension[] {
    return demoCampStore()
        .suspensions.filter((item) => fighterIds === "all" || fighterIds.includes(item.fighterId))
        .map(cloneSuspension);
}

/** Gate 2: the suspensions that stop this fighter doing this kind of session on `day`. */
export function demoBlockingSuspensions(fighterId: string, type: TrainingType, day: string): Suspension[] {
    return blockingSuspensions(demoCampStore().suspensions, fighterId, type, day).map(cloneSuspension);
}

/* ─── Weigh-ins and plan answers ──────────────────────────────────────────── */

/** One weight per fighter per academy day. A second save replaces the first. */
export function recordDemoSelfWeight(fighterId: string, kg: number, now = new Date()): void {
    recordMeasurement(fighterId, kg, now, "SELF_REPORTED");
}

function recordMeasurement(fighterId: string, kg: number, now: Date, context: MeasurementContext): void {
    const camp = demoCampStore();
    const academyDate = dayKey(now);
    const existing = camp.measurements.find((item) => item.fighterId === fighterId && item.academyDate === academyDate);
    if (existing) {
        existing.kg = kg;
        existing.recordedAt = now.toISOString();
        existing.context = context;
        return;
    }
    camp.measurements.push({ fighterId, academyDate, kg, recordedAt: now.toISOString(), context });
}

/**
 * One plan answer per bout per academy day. `academyDate` is yesterday, the day the
 * question asks about. A second answer on the same day replaces the first.
 */
export function recordDemoCheckin(fighterId: string, adherence: PlanAdherence, note: string | null, now = new Date()): WriteResult {
    const bout = getDemoCurrentBout(fighterId);
    if (!bout) return { ok: false, message: "There is no upcoming bout to attach this answer to." };
    const camp = demoCampStore();
    const loggedOn = dayKey(now);
    const academyDate = addDaysToKey(loggedOn, -1);
    const existing = camp.checkins.find((item) => item.boutId === bout.id && item.academyDate === academyDate);
    if (existing) {
        existing.adherence = adherence;
        existing.note = note;
        existing.loggedOn = loggedOn;
        existing.recordedAt = now.toISOString();
        return { ok: true };
    }
    camp.checkins.push({ boutId: bout.id, academyDate, loggedOn, adherence, note, recordedAt: now.toISOString() });
    return { ok: true };
}

export function saveDemoNutritionPlan(boutId: string, texts: Record<NutritionPhaseKey, string>, authorName: string, now = new Date()): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (!isRunningPhase(bout.phase)) return { ok: false, message: "This bout is over, so its meal plan can no longer change." };
    const updatedAt = now.toISOString();
    (Object.keys(texts) as NutritionPhaseKey[]).forEach((key) => {
        const text = texts[key];
        const current = bout.nutritionPlan[key];
        if (!text) {
            bout.nutritionPlan[key] = null;
            return;
        }
        if (current && current.text === text) return;
        bout.nutritionPlan[key] = { text, authorName, updatedAt };
    });
    return { ok: true };
}

/* ─── Creating and changing a bout ────────────────────────────────────────── */

const BOUT_GONE = "That bout no longer exists.";

export interface NewBout {
    fighterId: string;
    fighterName: string;
    rulesetId: string;
    event: string;
    venue: string | null;
    opponent: string | null;
    weightClass: WeightClassOption;
    weighInAt: string;
    boutAt: string;
    scheduledRounds?: number | null;
    coachId: string;
}

/** F1: a new bout starts scheduled, with the ruleset's checklist and its thresholds copied onto it. */
export function createDemoBout(input: NewBout, actor: Actor, now = new Date()): CreateResult {
    const camp = demoCampStore();
    const rules = camp.rulesets.find((item) => item.id === input.rulesetId);
    if (!rules) return { ok: false, message: "Choose a ruleset.", fieldErrors: { rulesetId: "Choose a ruleset from the list." } };
    const todayOn = dayKey(now);
    const id = `b-${input.fighterId.replace(/^f-/, "")}-${camp.sequence++}`;
    const bout: DemoBoutRecord = {
        id,
        fighterId: input.fighterId,
        coachId: input.coachId,
        scheduledRounds: input.scheduledRounds ?? null,
        rulesetId: rules.id,
        rulesetName: rules.name,
        rulesetVerified: rules.verified,
        sport: rules.sport,
        event: input.event,
        venue: input.venue,
        opponent: input.opponent,
        weightClassCode: input.weightClass.code,
        weightClassLabel: input.weightClass.label,
        limitKg: input.weightClass.limitKg,
        catchweightKg: null,
        acuteLossLimitPct: acuteLossLimitPct(input.weighInAt, input.boutAt, rules),
        acuteWindowDays: rules.acuteWindowDays,
        requirementsDueDays: rules.requirementsDueDays,
        fightWeekDays: rules.fightWeekDays,
        weighInAt: input.weighInAt,
        boutAt: input.boutAt,
        phase: "SCHEDULED",
        trainingPlanId: null,
        campStartedOn: todayOn,
        createdOn: todayOn,
        notes: null,
        cancelReason: null,
        cancelNote: null,
        requirements: requirementsFromTemplates(rules),
        nutritionPlan: { ...EMPTY_PLAN },
        history: [{ at: now.toISOString(), by: actor.name, from: null, to: "SCHEDULED" }],
        weighIn: null,
        outcome: null,
        checklistUnlock: null,
    };
    camp.bouts.push(bout);

    // F1: warn, but still create, when a suspension runs past the bout day.
    const bOn = boutOn(bout);
    const blocking = camp.suspensions.find((item) => item.fighterId === input.fighterId && isSuspensionActive(item, bOn));
    const warning = blocking ? `${input.fighterName} is suspended until ${formatDate(blocking.endsOn)}, after the bout day.` : null;
    return { ok: true, boutId: id, warning };
}

export interface BoutEdit {
    event: string;
    venue: string | null;
    opponent: string | null;
    notes: string | null;
    weightClass: WeightClassOption;
    weighInAt: string;
    boutAt: string;
    requirementsDueDays: number;
    changeReason: string | null;
}

/** F8: details change any time before a result; dates, class and the deadline only until the official weigh-in. */
export function updateDemoBout(boutId: string, edit: BoutEdit, actor: Actor, now = new Date()): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (!canEditSchedule(bout.phase)) return { ok: false, message: `A ${BOUT_PHASE_LABELS[bout.phase].toLowerCase()} bout can't be edited.` };
    const classChanged = edit.weightClass.code !== bout.weightClassCode;
    if (classChanged && !edit.changeReason) {
        return { ok: false, message: "Say why the weight class changed.", fieldErrors: { changeReason: "Say why the weight class changed." } };
    }
    const rules = demoCampStore().rulesets.find((item) => item.id === bout.rulesetId);
    const datesChanged = edit.weighInAt !== bout.weighInAt || edit.boutAt !== bout.boutAt;
    if (classChanged) {
        bout.history.push({
            at: now.toISOString(),
            by: actor.name,
            from: bout.phase,
            to: bout.phase,
            reason: `Weight class ${bout.weightClassLabel} → ${edit.weightClass.label}: ${edit.changeReason}`,
        });
    }
    if (datesChanged) {
        bout.history.push({ at: now.toISOString(), by: actor.name, from: bout.phase, to: bout.phase, reason: "Weigh-in or bout date changed" });
    }
    Object.assign(bout, {
        event: edit.event,
        venue: edit.venue,
        opponent: edit.opponent,
        notes: edit.notes,
        weightClassCode: edit.weightClass.code,
        weightClassLabel: edit.weightClass.label,
        limitKg: edit.weightClass.limitKg,
        weighInAt: edit.weighInAt,
        boutAt: edit.boutAt,
        requirementsDueDays: edit.requirementsDueDays,
        acuteLossLimitPct: rules ? acuteLossLimitPct(edit.weighInAt, edit.boutAt, rules) : bout.acuteLossLimitPct,
    });
    return { ok: true };
}

/** F2: link an existing fight-camp plan of the same fighter and start the camp. One active bout per fighter. */
export function linkDemoCamp(boutId: string, plan: TrainingPlan | null, actor: Actor, now = new Date()): WriteResult {
    const camp = demoCampStore();
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (!canTransition(bout.phase, "CAMP")) return { ok: false, message: "Only a scheduled bout can start its camp." };
    const field = (message: string): WriteResult => ({ ok: false, message, fieldErrors: { trainingPlanId: message } });
    if (!plan) return field("Choose a camp plan.");
    if (plan.fighterId !== bout.fighterId) return field("That plan belongs to another fighter.");
    if (plan.phase !== "fight_camp") return field("Choose a plan in the fight-camp phase.");
    if (plan.status === "archived") return field("That plan is archived. Choose a current one.");
    const active = camp.bouts.find((item) => item.id !== bout.id && item.fighterId === bout.fighterId && isActivePhase(item.phase));
    if (active) return { ok: false, message: `This fighter already has a bout in ${BOUT_PHASE_LABELS[active.phase].toLowerCase()}: ${active.event}. Finish or cancel it first.` };
    bout.trainingPlanId = plan.id;
    bout.campStartedOn = dayKey(plan.startDate);
    move(bout, "CAMP", actor, now);
    return { ok: true };
}

/** Gate 1 with the reason in words, one line per item. */
export function gateLines(missing: Gate1Gap[]): string[] {
    return missing.map((gap) => `${gap.requirement.label}: ${GATE1_REASON_LABELS[gap.reason]}`);
}

/** CAMP → FIGHT_WEEK when fight week has opened and Gate 1 passes. A refusal leaves the bout as it was. */
export function enterDemoFightWeek(boutId: string, actor: Actor, now = new Date()): FightWeekResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE, lines: [] };
    const check = canEnterFightWeek(bout, dayKey(now));
    if (!check.ok) {
        if (check.reason === "NOT_IN_CAMP") return { ok: false, message: "Only a bout in camp can enter fight week.", lines: [] };
        if (check.reason === "TOO_EARLY") {
            return { ok: false, message: `Fight week opens on ${formatDate(check.opensOn)}.`, lines: gateLines(check.missing) };
        }
        return { ok: false, message: "Gate 1 is not met. The bout stays in camp.", lines: gateLines(check.missing) };
    }
    move(bout, "FIGHT_WEEK", actor, now);
    return { ok: true };
}

export function cancelDemoBout(boutId: string, reason: CancelReason, note: string | null, actor: Actor, now = new Date()): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (!canCancel(bout.phase)) return { ok: false, message: `A ${BOUT_PHASE_LABELS[bout.phase].toLowerCase()} bout can't be cancelled.` };
    bout.cancelReason = reason;
    bout.cancelNote = note;
    move(bout, "CANCELLED", actor, now, note ? `${CANCEL_REASON_LABELS[reason]}: ${note}` : CANCEL_REASON_LABELS[reason]);
    return { ok: true };
}

/* ─── Medical checklist ───────────────────────────────────────────────────── */

const LOCKED = "The checklist is locked for fight week. Unlock it with a reason first.";

export function addDemoRequirement(boutId: string, item: { label: string; required: boolean; validityDays: number | null }): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (checklistLocked(bout)) return { ok: false, message: LOCKED };
    const code = requirementCode(item.label, bout.requirements.map((requirement) => requirement.code));
    bout.requirements.push({
        id: code,
        code,
        label: item.label,
        required: item.required,
        state: "MISSING",
        source: "COACH",
        issuedOn: null,
        validUntil: null,
        statusReason: null,
        validityDays: item.validityDays,
    });
    return { ok: true };
}

export function updateDemoRequirement(boutId: string, code: string, update: RequirementUpdate & { required?: boolean }): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (checklistLocked(bout)) return { ok: false, message: LOCKED };
    const item = bout.requirements.find((requirement) => requirement.code === code);
    if (!item) return { ok: false, message: "That document is no longer on the checklist." };
    if (item.state === "CONFIRMED") return { ok: false, message: "A doctor confirmed this document, so it can't be changed here." };
    Object.assign(item, update);
    return { ok: true };
}

export function removeDemoRequirement(boutId: string, code: string): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (checklistLocked(bout)) return { ok: false, message: LOCKED };
    const item = bout.requirements.find((requirement) => requirement.code === code);
    if (!item) return { ok: true };
    if (item.state === "CONFIRMED") return { ok: false, message: "A doctor confirmed this document, so it can't be removed here." };
    bout.requirements = bout.requirements.filter((requirement) => requirement.code !== code);
    return { ok: true };
}

/** F5: reopening the checklist in fight week needs a reason, kept on the bout. */
export function unlockDemoChecklist(boutId: string, reason: string, actor: Actor, now = new Date()): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (bout.phase !== "FIGHT_WEEK" && bout.phase !== "WEIGHED_IN") return { ok: false, message: "Only a fight-week checklist is locked." };
    bout.checklistUnlock = { at: now.toISOString(), by: actor.name, reason };
    return { ok: true };
}

/* ─── Official weigh-in and result (T-006) ────────────────────────────────── */

export interface WeighInEntry {
    weightKg: number;
    hydrationCheck: HydrationCheck | null;
    /** After a miss: go on at a catchweight, or cancel. Ignored when the fighter made weight. */
    decision: "CATCHWEIGHT" | "CANCEL" | null;
    catchweightKg: number | null;
    note: string | null;
}

/** F5: the official weight is also a measurement of the day (context WEIGH_IN). */
export function recordDemoWeighIn(boutId: string, entry: WeighInEntry, actor: Actor, now = new Date()): WriteResult {
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    if (bout.phase !== "FIGHT_WEEK") return { ok: false, message: "The official weigh-in is recorded in fight week." };
    const onScale = madeWeight(entry.weightKg, boutLimitKg(bout));
    const made = passesWeighIn(entry.weightKg, boutLimitKg(bout), entry.hydrationCheck);
    if (!made && !entry.decision) return { ok: false, message: "Choose what happens after the miss.", fieldErrors: { decision: "Choose catchweight or cancel." } };

    // R19 reads the morning weights before the official one replaces the day's entry.
    const acuteLoss = demoAcuteLoss(bout, entry.weightKg);
    recordMeasurement(bout.fighterId, entry.weightKg, now, "WEIGH_IN");
    if (!made && entry.decision === "CANCEL") {
        bout.weighIn = { weightKg: entry.weightKg, madeWeight: onScale, hydrationCheck: entry.hydrationCheck, recordedAt: now.toISOString(), catchweightNote: null, acuteLoss };
        bout.cancelReason = "MISSED_WEIGHT";
        bout.cancelNote = entry.note;
        move(bout, "CANCELLED", actor, now, CANCEL_REASON_LABELS.MISSED_WEIGHT);
        return { ok: true };
    }
    if (!made) bout.catchweightKg = entry.catchweightKg;
    bout.weighIn = {
        weightKg: entry.weightKg,
        madeWeight: onScale,
        hydrationCheck: entry.hydrationCheck,
        recordedAt: now.toISOString(),
        catchweightNote: made ? null : entry.note,
        acuteLoss,
    };
    move(bout, "WEIGHED_IN", actor, now, made ? null : `Catchweight ${entry.catchweightKg} kg`);
    return { ok: true };
}

/** R19 on the demo's daily weights: the official weigh-in itself never counts as the starting weight. */
function demoAcuteLoss(bout: CampBout, officialKg: number) {
    const weights = demoCampStore()
        .measurements.filter((item) => item.fighterId === bout.fighterId && item.context !== "WEIGH_IN")
        .map((item) => ({ on: item.academyDate, kg: item.kg }));
    return computeAcuteLoss(weights, officialKg, dayKey(bout.weighInAt), bout.acuteWindowDays, bout.acuteLossLimitPct);
}

/** F6: WEIGHED_IN → COMPLETED from the bout day; a mandatory rest from the ruleset follows every bout. */
export function recordDemoResult(boutId: string, outcome: BoutOutcome, actor: Actor, now = new Date()): WriteResult {
    const camp = demoCampStore();
    const bout = findBout(boutId);
    if (!bout) return { ok: false, message: BOUT_GONE };
    const check = canRecordResult(bout, dayKey(now));
    if (!check.ok) {
        return {
            ok: false,
            message: check.reason === "BOUT_NOT_STARTED" ? `The result can be recorded from ${formatDate(bout.boutAt)}.` : "Record the official weigh-in first.",
        };
    }
    bout.outcome = outcome;
    move(bout, "COMPLETED", actor, now);
    const rules = camp.rulesets.find((item) => item.id === bout.rulesetId);
    if (rules && rules.restDaysAfterBout > 0) {
        const startsOn = boutOn(bout);
        camp.suspensions.push({
            id: `sus-${camp.sequence++}`,
            fighterId: bout.fighterId,
            boutId: bout.id,
            reason: "MANDATORY_REST",
            startsOn,
            endsOn: suspensionEndsOn(startsOn, rules.restDaysAfterBout),
            lossOfConsciousness: null,
            suggestedDays: rules.restDaysAfterBout,
            overrideReason: null,
            blockedSessionTypes: [...rules.defaultBlockedSessionTypes],
            requiresClearance: false,
            clearedAt: null,
            clearedBy: null,
            clearanceNote: null,
            createdBy: actor.name,
            createdAt: now.toISOString(),
            note: null,
        });
    }
    return { ok: true };
}

/* ─── Suspensions (T-007) ─────────────────────────────────────────────────── */

export function createDemoSuspension(fighterId: string, boutId: string | null, draft: SuspensionDraft, actor: Actor, now = new Date()): WriteResult {
    const camp = demoCampStore();
    if (boutId) {
        const bout = findBout(boutId);
        if (!bout || bout.fighterId !== fighterId) return { ok: false, message: BOUT_GONE };
        if (camp.suspensions.some((item) => item.boutId === boutId && item.reason !== "MANDATORY_REST")) {
            return { ok: false, message: "This bout already has a suspension." };
        }
    }
    camp.suspensions.push({
        id: `sus-${camp.sequence++}`,
        fighterId,
        boutId,
        reason: draft.reason,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        lossOfConsciousness: boutId ? (findBout(boutId)?.outcome?.lossOfConsciousness ?? null) : null,
        suggestedDays: draft.suggestedDays,
        overrideReason: draft.overrideReason,
        blockedSessionTypes: draft.blockedSessionTypes,
        requiresClearance: draft.requiresClearance,
        clearedAt: null,
        clearedBy: null,
        clearanceNote: null,
        createdBy: actor.name,
        createdAt: now.toISOString(),
        note: draft.note,
    });
    return { ok: true };
}

export function clearDemoSuspension(id: string, note: string, actor: Actor, now = new Date()): WriteResult {
    const suspension = demoCampStore().suspensions.find((item) => item.id === id);
    if (!suspension) return { ok: false, message: "That suspension no longer exists." };
    if (suspension.clearedAt) return { ok: false, message: "This suspension needs no clearance." };
    if (note.trim().length < 3 || note.trim().length > 500) return { ok: false, message: "A clearance note of 3–500 characters is required." };
    suspension.clearedAt = now.toISOString();
    suspension.clearedBy = actor.name;
    suspension.clearanceNote = note;
    return { ok: true };
}

/** Start days of the fighter's earlier KO/TKO suspensions, for the next suggestion. */
export function demoKnockoutHistory(fighterId: string): string[] {
    return demoCampStore()
        .suspensions.filter((item) => item.fighterId === fighterId && (item.reason === "KO" || item.reason === "TKO"))
        .map((item) => item.startsOn);
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function findBout(boutId: string): DemoBoutRecord | undefined {
    return demoCampStore().bouts.find((item) => item.id === boutId);
}

function move(bout: CampBout, to: BoutPhase, actor: Actor, now: Date, reason: string | null = null): void {
    bout.history.push({ at: now.toISOString(), by: actor.name, from: bout.phase, to, ...(reason ? { reason } : {}) });
    bout.phase = to;
}

function campCheckins(boutId: string): NutritionCheckin[] {
    return demoCampStore().checkins.filter((item) => item.boutId === boutId);
}

function cloneRuleset(item: CompetitionRuleset): CompetitionRuleset {
    return {
        ...item,
        weightClasses: item.weightClasses.map((option) => ({ ...option })),
        requirementTemplates: item.requirementTemplates.map((template) => ({ ...template })),
        suspensionRules: item.suspensionRules.map((rule) => ({ ...rule })),
        defaultBlockedSessionTypes: [...item.defaultBlockedSessionTypes],
    };
}

function cloneSuspension(item: Suspension): Suspension {
    return { ...item, blockedSessionTypes: [...item.blockedSessionTypes] };
}

function cloneBout(bout: DemoBoutRecord): DemoBoutRecord {
    return {
        ...bout,
        requirements: bout.requirements.map((item) => ({ ...item })),
        nutritionPlan: {
            camp: bout.nutritionPlan.camp ? { ...bout.nutritionPlan.camp } : null,
            fightWeek: bout.nutritionPlan.fightWeek ? { ...bout.nutritionPlan.fightWeek } : null,
            postWeighIn: bout.nutritionPlan.postWeighIn ? { ...bout.nutritionPlan.postWeighIn } : null,
        },
        history: bout.history.map((entry) => ({ ...entry })),
        weighIn: bout.weighIn ? { ...bout.weighIn, acuteLoss: bout.weighIn.acuteLoss ? { ...bout.weighIn.acuteLoss } : null } : null,
        outcome: bout.outcome ? { ...bout.outcome } : null,
        checklistUnlock: bout.checklistUnlock ? { ...bout.checklistUnlock } : null,
    };
}

export async function getFeasibility(input: FeasibilityInput): Promise<WeightFeasibility | null> {
    const rules = getDemoRuleset(input.rulesetId);
    if (!rules) return null;
    const store = demoCampStore();
    const today = dayKey(new Date());
    const latest = store.measurements.filter(m => m.fighterId === input.fighterId && m.academyDate <= today).sort((a,b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1);
    const result = calculateWeightFeasibility({ limitKg: input.weightLimitKg, acuteLossLimitPct: acuteLossLimitPct(input.weighInAt, input.boutAt, rules), acuteWindowDays: rules.acuteWindowDays, weighInAt: input.weighInAt, latest: latest ? { date: latest.academyDate, kg: latest.kg } : null });
    return { ...result, warnings: feasibilityWarnings(result.status) };
}
export async function getCoachTodo(scope: string[] | "all"): Promise<CoachTodo> {
    const now = new Date();
    const bouts = listDemoBouts(scope).map(bout => {
        const weight = demoWeightTrack(bout.id, now);
        const gate = boutGate1(bout);
        return { ...bout, status: bout.phase, deletedAt: null, eventName: bout.event, requirementsDueOn: requirementsDueOn(bout), gate1: { passed: gate.passed, missing: gate.missing.map(gap => gap.requirement.code), expiring: [] }, weight: weight ?? undefined, canEnterFightWeek: canEnterFightWeek(bout, dayKey(now)).ok, weightReminder: computeWeighInReminder({ status: bout.phase, latestOn: weight?.latestOn ?? null, now }) };
    });
    return { items: buildDemoCoachTodo(bouts, now), truncated: false };
}
