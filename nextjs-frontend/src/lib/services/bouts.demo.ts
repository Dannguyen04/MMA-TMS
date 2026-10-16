import "server-only";

import type { CampBout, NutritionCheckin, NutritionPhaseKey, NutritionPlan } from "@/lib/domain/bout";
import { isRunningPhase } from "@/lib/domain/bout";
import type { PlanAdherence } from "@/lib/domain/weight-chart";
import { buildWeightTrack, type WeightTrack } from "@/lib/domain/weight-track";
import { academyWallClockToIso, addDaysToKey, dayKey } from "@/lib/format";
import type { WriteResult } from "@/lib/domain/write-result";

interface DemoMeasurement {
    fighterId: string;
    academyDate: string;
    kg: number;
    recordedAt: string;
}

interface CampStore {
    bouts: CampBout[];
    measurements: DemoMeasurement[];
    checkins: NutritionCheckin[];
}

const STATUS_ORDER = { RED: 0, YELLOW: 1, GREY: 2, GREEN: 3 } as const;

let store: CampStore | null = null;

/** The in-memory camp. Created on first read so tests can seed a fixed academy day. */
export function demoCampStore(): CampStore {
    store ??= createCampStore(dayKey(new Date()));
    return store;
}

export function resetDemoCampStore(todayOn = dayKey(new Date())): CampStore {
    store = createCampStore(todayOn);
    return store;
}

export function createCampStore(todayOn: string): CampStore {
    const campStart = addDaysToKey(todayOn, -20);
    const noteAt = academyWallClockToIso(campStart, "08:00");
    const minhPlan: NutritionPlan = {
        camp: {
            text: "Rice, grilled chicken, vegetables, and fruit. No fried food.",
            authorName: "Rafael Costa",
            updatedAt: noteAt,
        },
        fightWeek: {
            text: "Same meals, smaller portions the day before weigh-in.",
            authorName: "Rafael Costa",
            updatedAt: noteAt,
        },
        postWeighIn: {
            text: "A normal meal after the scale.",
            authorName: "Rafael Costa",
            updatedAt: noteAt,
        },
    };

    const bouts: CampBout[] = [
        {
            id: "b-minh-lotus",
            fighterId: "f-minh-tran",
            event: "Lotus Fight Night 18",
            opponent: "Arman Petrosyan",
            weightClass: "featherweight",
            limitKg: 60,
            catchweightKg: 60,
            acuteLossLimitPct: 8,
            acuteWindowDays: 7,
            weighInAt: academyWallClockToIso(addDaysToKey(todayOn, 2), "08:00"),
            boutAt: academyWallClockToIso(addDaysToKey(todayOn, 3), "19:00"),
            phase: "CAMP",
            campStartedOn: campStart,
            requirements: [
                { id: "blood", label: "Blood panel", state: "CONFIRMED" },
                { id: "ecg", label: "ECG", state: "PROVIDED" },
                { id: "mri", label: "Brain MRI", state: "MISSING" },
            ],
            nutritionPlan: minhPlan,
        },
        {
            id: "b-kenji-pacific",
            fighterId: "f-kenji-morita",
            event: "Pacific Invitational 4",
            opponent: "Ryo Tanaka",
            weightClass: "bantamweight",
            limitKg: 61.2,
            catchweightKg: null,
            acuteLossLimitPct: 8,
            acuteWindowDays: 7,
            weighInAt: academyWallClockToIso(addDaysToKey(todayOn, 21), "09:00"),
            boutAt: academyWallClockToIso(addDaysToKey(todayOn, 22), "19:00"),
            phase: "CAMP",
            campStartedOn: campStart,
            requirements: [
                { id: "blood", label: "Blood panel", state: "CONFIRMED" },
                { id: "eye", label: "Eye exam", state: "MISSING" },
            ],
            nutritionPlan: {
                camp: { text: "Fish, rice, and vegetables at the usual times.", authorName: "Rafael Costa", updatedAt: noteAt },
                fightWeek: null,
                postWeighIn: null,
            },
        },
        {
            id: "b-emma-nordic",
            fighterId: "f-emma-lindqvist",
            event: "Nordic Open 12",
            opponent: null,
            weightClass: "flyweight",
            limitKg: 56.7,
            catchweightKg: null,
            acuteLossLimitPct: 8,
            acuteWindowDays: 7,
            weighInAt: academyWallClockToIso(addDaysToKey(todayOn, 10), "08:00"),
            boutAt: academyWallClockToIso(addDaysToKey(todayOn, 11), "18:00"),
            phase: "CAMP",
            campStartedOn: campStart,
            requirements: [{ id: "blood", label: "Blood panel", state: "MISSING" }],
            nutritionPlan: { camp: null, fightWeek: null, postWeighIn: null },
        },
    ];

    const measurements: DemoMeasurement[] = [
        measure("f-minh-tran", campStart, 70, noteAt),
        measure("f-minh-tran", addDaysToKey(todayOn, -2), 67, academyWallClockToIso(addDaysToKey(todayOn, -2), "07:30")),
        measure("f-minh-tran", addDaysToKey(todayOn, -1), 66.4, academyWallClockToIso(addDaysToKey(todayOn, -1), "07:30")),
        measure("f-minh-tran", todayOn, 66, academyWallClockToIso(todayOn, "07:30")),
        measure("f-kenji-morita", campStart, 70, noteAt),
        measure("f-kenji-morita", todayOn, 69, academyWallClockToIso(todayOn, "07:45")),
        measure("f-emma-lindqvist", addDaysToKey(todayOn, -4), 58, academyWallClockToIso(addDaysToKey(todayOn, -4), "07:30")),
    ];

    const checkins: NutritionCheckin[] = [
        checkin("b-minh-lotus", addDaysToKey(todayOn, -2), "WAY_OFF", null),
        checkin("b-minh-lotus", addDaysToKey(todayOn, -1), "WAY_OFF", null),
        checkin("b-minh-lotus", todayOn, "ON_PLAN", null),
    ];

    return { bouts, measurements, checkins };
}

export function listDemoBouts(): CampBout[] {
    return demoCampStore().bouts.map(cloneBout);
}

export function getDemoBout(boutId: string): CampBout | null {
    const bout = demoCampStore().bouts.find((item) => item.id === boutId);
    return bout ? cloneBout(bout) : null;
}

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
    return buildWeightTrack({
        limitKg: bout.catchweightKg ?? bout.limitKg,
        acuteLossLimitPct: bout.acuteLossLimitPct,
        acuteWindowDays: bout.acuteWindowDays,
        campStartedOn: bout.campStartedOn,
        weighInOn: dayKey(bout.weighInAt),
        todayOn,
        points: camp.measurements
            .filter((item) => item.fighterId === bout.fighterId)
            .map((item) => ({ date: item.academyDate, kg: item.kg, adherence: adherenceByDay.get(item.academyDate) ?? null })),
    });
}

export interface DemoWeightAlert {
    bout: CampBout;
    track: WeightTrack;
    wayOff: number;
}

export function listDemoWeightAlerts(fighterIds: string[] | "all", now = new Date()): DemoWeightAlert[] {
    const todayOn = dayKey(now);
    return listDemoBouts()
        .filter((bout) => isRunningPhase(bout.phase))
        .filter((bout) => fighterIds === "all" || fighterIds.includes(bout.fighterId))
        .flatMap((bout) => {
            const track = demoWeightTrack(bout.id, now);
            if (!track || track.status === "GREEN") return [];
            const wayOff = campCheckins(bout.id).filter((item) => {
                const age = daysFrom(item.loggedOn, todayOn);
                return age >= 0 && age < 3 && item.adherence === "WAY_OFF";
            }).length;
            return [{ bout, track, wayOff }];
        })
        .sort((a, b) => STATUS_ORDER[a.track.status] - STATUS_ORDER[b.track.status] || (a.bout.weighInAt < b.bout.weighInAt ? -1 : 1));
}

/** One self-reported weight per fighter per academy day. A second save replaces the first. */
export function recordDemoSelfWeight(fighterId: string, kg: number, now = new Date()): void {
    const camp = demoCampStore();
    const academyDate = dayKey(now);
    const existing = camp.measurements.find((item) => item.fighterId === fighterId && item.academyDate === academyDate);
    if (existing) {
        existing.kg = kg;
        existing.recordedAt = now.toISOString();
        return;
    }
    camp.measurements.push({ fighterId, academyDate, kg, recordedAt: now.toISOString() });
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

export function saveDemoNutritionPlan(
    boutId: string,
    texts: Record<NutritionPhaseKey, string>,
    authorName: string,
    now = new Date(),
): WriteResult {
    const bout = demoCampStore().bouts.find((item) => item.id === boutId);
    if (!bout) return { ok: false, message: "That bout no longer exists." };
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

export function demoCheckinsFor(boutId: string): NutritionCheckin[] {
    return campCheckins(boutId).map((item) => ({ ...item }));
}

function campCheckins(boutId: string): NutritionCheckin[] {
    return demoCampStore().checkins.filter((item) => item.boutId === boutId);
}

function measure(fighterId: string, academyDate: string, kg: number, recordedAt: string): DemoMeasurement {
    return { fighterId, academyDate, kg, recordedAt };
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

function daysFrom(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function cloneBout(bout: CampBout): CampBout {
    return {
        ...bout,
        requirements: bout.requirements.map((item) => ({ ...item })),
        nutritionPlan: {
            camp: bout.nutritionPlan.camp ? { ...bout.nutritionPlan.camp } : null,
            fightWeek: bout.nutritionPlan.fightWeek ? { ...bout.nutritionPlan.fightWeek } : null,
            postWeighIn: bout.nutritionPlan.postWeighIn ? { ...bout.nutritionPlan.postWeighIn } : null,
        },
    };
}
