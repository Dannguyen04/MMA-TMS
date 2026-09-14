import { describe, expect, it } from "vitest";

import { dayKey } from "@/lib/format";
import { clearanceDaysRemaining, clearanceState, currentClearance } from "@/lib/domain/rules";
import type { ClearanceLevel, HealthStatus, StrikeType } from "@/lib/domain/types";
import { STRIKE_TYPES } from "@/lib/domain/labels";

import { mockAbnormalMovementAlerts, mockAIAnalyses, mockAIJobs, mockAIModels, mockVideos } from "./ai";
import {
    mockInjuries,
    mockMedicalClearances,
    mockMedicalExaminations,
    mockMedicalRecords,
    mockRecoveryPlans,
    mockTreatments,
} from "./medical";
import { mockCoaches, mockDoctors, mockFighters, mockUsers } from "./people";
import { mockPerformanceMetrics } from "./performance";
import { mockAuditLogs, mockBroadcasts, mockNotifications } from "./platform";
import { mockCoachFeedback, mockExercises, mockGoals, mockTrainingPlans, mockTrainingSessions } from "./training";
import { MOCK_ANCHOR_MS, TODAY_KEY } from "./time";

/**
 * Referential integrity of the mock seed. Every module is written independently, so these
 * checks keep ids, links and storylines consistent across training, AI, medical and platform data.
 *
 * Each check collects violations and compares them with an empty list, so a failure names
 * every offending record instead of stopping at the first one.
 */

/** The seed is anchored to the instant it was built, so "now" for every check is the anchor. */
const ANCHOR = new Date(MOCK_ANCHOR_MS);

const idsOf = (items: { id: string }[]) => new Set(items.map((item) => item.id));

const userIds = idsOf(mockUsers);
const fighterIds = idsOf(mockFighters);
const coachIds = idsOf(mockCoaches);
const doctorIds = idsOf(mockDoctors);
const exerciseIds = idsOf(mockExercises);
const modelIds = idsOf(mockAIModels);

const fighterById = new Map(mockFighters.map((f) => [f.id, f]));
const planById = new Map(mockTrainingPlans.map((p) => [p.id, p]));
const sessionById = new Map(mockTrainingSessions.map((s) => [s.id, s]));
const videoById = new Map(mockVideos.map((v) => [v.id, v]));
const jobById = new Map(mockAIJobs.map((j) => [j.id, j]));
const analysisById = new Map(mockAIAnalyses.map((a) => [a.id, a]));
const alertById = new Map(mockAbnormalMovementAlerts.map((a) => [a.id, a]));
const injuryById = new Map(mockInjuries.map((i) => [i.id, i]));
const examinationById = new Map(mockMedicalExaminations.map((e) => [e.id, e]));

function duplicates(ids: string[]): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) dupes.add(id);
        seen.add(id);
    }
    return [...dupes];
}

/** Past events must not be later than the anchor, including earlier today. */
function isFuture(value: string | null | undefined): boolean {
    return value != null && Date.parse(value) > MOCK_ANCHOR_MS;
}

/** Date-only keys stored at local midnight are compared by calendar day. */
function isFutureDay(value: string): boolean {
    return dayKey(value) > TODAY_KEY;
}

function missing(label: string, id: string | null, known: Set<string> | Map<string, unknown>): string[] {
    if (id === null) return [];
    return known.has(id) ? [] : [`${label} → ${id}`];
}

describe("ids", () => {
    it.each([
        ["users", mockUsers],
        ["fighters", mockFighters],
        ["coaches", mockCoaches],
        ["doctors", mockDoctors],
        ["exercises", mockExercises],
        ["trainingPlans", mockTrainingPlans],
        ["trainingSessions", mockTrainingSessions],
        ["coachFeedback", mockCoachFeedback],
        ["goals", mockGoals],
        ["performanceMetrics", mockPerformanceMetrics],
        ["videos", mockVideos],
        ["aiJobs", mockAIJobs],
        ["aiAnalyses", mockAIAnalyses],
        ["alerts", mockAbnormalMovementAlerts],
        ["aiModels", mockAIModels],
        ["medicalRecords", mockMedicalRecords],
        ["examinations", mockMedicalExaminations],
        ["injuries", mockInjuries],
        ["treatments", mockTreatments],
        ["recoveryPlans", mockRecoveryPlans],
        ["clearances", mockMedicalClearances],
        ["notifications", mockNotifications],
        ["broadcasts", mockBroadcasts],
        ["auditLogs", mockAuditLogs],
    ] as const)("%s ids are unique", (_name, items: readonly { id: string }[]) => {
        expect(duplicates(items.map((item) => item.id))).toEqual([]);
    });

    it("analysis child ids are unique", () => {
        const children = mockAIAnalyses.flatMap((a) => [
            ...a.detections.map((d) => d.id),
            ...a.combinations.map((c) => c.id),
            ...a.movementEvents.map((m) => m.id),
            ...a.findings.map((f) => f.id),
        ]);
        expect(duplicates(children)).toEqual([]);
    });

    it("registry ids shared across modules exist", () => {
        const expected: [string, Set<string> | Map<string, unknown>][] = [
            ...[
                "s-minh-pads-2d",
                "s-minh-bag-today",
                "s-minh-sparring-16d",
                "s-kenji-bag-9d",
                "s-marcus-bag-11d",
                "s-diego-sparring-6d",
                "s-lucas-sparring-24d",
                "s-aigerim-pads-3d",
                "s-linh-bag-5d",
                "s-emma-sparring-1d",
                "s-sofia-pads-8d",
                "s-hoang-shadow-7d",
            ].map((id): [string, Map<string, unknown>] => [id, sessionById]),
            ...[
                "tp-minh-fight-camp",
                "tp-lucas-return",
                "tp-aigerim-camp",
                "tp-kenji-technical",
                "tp-diego-build",
                "tp-linh-championship",
                "tp-marcus-rehab-conditioning",
                "tp-sofia-camp",
                "tp-hoang-camp",
                "tp-tariq-return",
                "tp-emma-build",
                "tp-bao-foundations",
            ].map((id): [string, Map<string, unknown>] => [id, planById]),
            ...[
                "v-minh-pads-2d",
                "v-minh-bag-today",
                "v-minh-shadow-9d",
                "v-minh-sparring-16d",
                "v-kenji-bag-9d",
                "v-lucas-shadow-4d",
                "v-marcus-bag-11d",
                "v-diego-sparring-6d",
                "v-aigerim-pads-3d",
                "v-linh-bag-5d",
                "v-emma-sparring-1d",
                "v-sofia-pads-8d",
                "v-hoang-shadow-7d",
                "v-tariq-shadow-2d",
                "v-bao-shadow-3d",
            ].map((id): [string, Map<string, unknown>] => [id, videoById]),
            ...[
                "al-minh-elbow-2d",
                "al-kenji-shoulder-9d",
                "al-lucas-hip-4d",
                "al-marcus-hand-11d",
                "al-diego-balance-6d",
                "al-linh-knee-5d",
                "al-hoang-trunk-7d",
            ].map((id): [string, Map<string, unknown>] => [id, alertById]),
            ...["inj-lucas-hamstring", "inj-diego-concussion", "inj-marcus-hand", "inj-tariq-knee"].map(
                (id): [string, Map<string, unknown>] => [id, injuryById],
            ),
            ...["rp-lucas-hamstring", "rp-diego-concussion", "rp-marcus-hand", "rp-tariq-knee", "rp-emma-ankle"].map(
                (id): [string, Set<string>] => [id, idsOf(mockRecoveryPlans)],
            ),
        ];
        expect(expected.filter(([id, known]) => !known.has(id)).map(([id]) => id)).toEqual([]);
    });
});

describe("people", () => {
    it("profiles link to accounts of the matching role", () => {
        const violations = [
            ...mockFighters.flatMap((f) => [
                ...missing(`${f.id}.userId`, f.userId, userIds),
                ...f.coachIds.flatMap((id) => missing(`${f.id}.coachIds`, id, coachIds)),
                ...f.doctorIds.flatMap((id) => missing(`${f.id}.doctorIds`, id, doctorIds)),
                ...(f.coachIds.includes(f.primaryCoachId) ? [] : [`${f.id}.primaryCoachId not in coachIds`]),
            ]),
            ...mockCoaches.flatMap((c) => missing(`${c.id}.userId`, c.userId, userIds)),
            ...mockDoctors.flatMap((d) => missing(`${d.id}.userId`, d.userId, userIds)),
            ...mockUsers.flatMap((u) => {
                if (u.profileId === null) return [];
                const known = u.role === "fighter" ? fighterIds : u.role === "coach" ? coachIds : u.role === "doctor" ? doctorIds : new Set<string>();
                return missing(`${u.id}.profileId`, u.profileId, known);
            }),
        ];
        expect(violations).toEqual([]);
    });

    it("coach and doctor assignments agree in both directions", () => {
        const violations = [
            ...mockCoaches.flatMap((c) =>
                c.fighterIds.filter((id) => !fighterById.get(id)?.coachIds.includes(c.id)).map((id) => `${c.id} lists ${id}`),
            ),
            ...mockFighters.flatMap((f) =>
                f.coachIds.filter((id) => !mockCoaches.find((c) => c.id === id)?.fighterIds.includes(f.id)).map((id) => `${f.id} lists ${id}`),
            ),
            ...mockDoctors.flatMap((d) =>
                d.fighterIds.filter((id) => !fighterById.get(id)?.doctorIds.includes(d.id)).map((id) => `${d.id} lists ${id}`),
            ),
            ...mockFighters.flatMap((f) =>
                f.doctorIds.filter((id) => !mockDoctors.find((d) => d.id === id)?.fighterIds.includes(f.id)).map((id) => `${f.id} lists ${id}`),
            ),
        ];
        expect(violations).toEqual([]);
    });
});

describe("training", () => {
    it("plans, sessions, feedback and goals reference existing records", () => {
        const violations = [
            ...mockTrainingPlans.flatMap((p) => [
                ...missing(`${p.id}.fighterId`, p.fighterId, fighterIds),
                ...missing(`${p.id}.coachId`, p.coachId, coachIds),
            ]),
            ...mockTrainingSessions.flatMap((s) => [
                ...missing(`${s.id}.fighterId`, s.fighterId, fighterIds),
                ...missing(`${s.id}.coachId`, s.coachId, coachIds),
                ...missing(`${s.id}.planId`, s.planId, planById),
                ...(s.planId && planById.get(s.planId)?.fighterId !== s.fighterId ? [`${s.id} plan belongs to another fighter`] : []),
                ...s.exercises.flatMap((e) => missing(`${s.id}.exerciseId`, e.exerciseId, exerciseIds)),
                ...s.videoIds.flatMap((id) => missing(`${s.id}.videoIds`, id, videoById)),
            ]),
            ...mockCoachFeedback.flatMap((fb) => [
                ...missing(`${fb.id}.fighterId`, fb.fighterId, fighterIds),
                ...missing(`${fb.id}.coachId`, fb.coachId, coachIds),
                ...missing(`${fb.id}.sessionId`, fb.sessionId, sessionById),
                ...missing(`${fb.id}.videoId`, fb.videoId, videoById),
                ...(fb.sessionId && sessionById.get(fb.sessionId)?.fighterId !== fb.fighterId ? [`${fb.id} session belongs to another fighter`] : []),
                ...(fb.videoId && videoById.get(fb.videoId)?.fighterId !== fb.fighterId ? [`${fb.id} video belongs to another fighter`] : []),
            ]),
            ...mockGoals.flatMap((g) => [
                ...missing(`${g.id}.fighterId`, g.fighterId, fighterIds),
                ...missing(`${g.id}.coachId`, g.coachId, coachIds),
            ]),
        ];
        expect(violations).toEqual([]);
    });

    it("session video links agree with video session links", () => {
        const violations = [
            ...mockTrainingSessions.flatMap((s) =>
                s.videoIds.filter((id) => videoById.get(id)?.sessionId !== s.id).map((id) => `${s.id} lists ${id}`),
            ),
            ...mockVideos
                .filter((v) => v.sessionId !== null && !sessionById.get(v.sessionId)?.videoIds.includes(v.id))
                .map((v) => `${v.id} → ${v.sessionId} does not list it`),
        ];
        expect(violations).toEqual([]);
    });

    it("performance history covers 12 weeks per fighter (2 for Bảo)", () => {
        const weeks = new Map<string, number>();
        for (const metric of mockPerformanceMetrics) weeks.set(metric.fighterId, (weeks.get(metric.fighterId) ?? 0) + 1);
        const violations = [
            ...mockPerformanceMetrics.flatMap((m) => missing(`${m.id}.fighterId`, m.fighterId, fighterIds)),
            ...duplicates(mockPerformanceMetrics.map((m) => `${m.fighterId}@${m.weekStart}`)),
            ...mockFighters
                .filter((f) => (weeks.get(f.id) ?? 0) !== (f.id === "f-bao-nguyen" ? 2 : 12))
                .map((f) => `${f.id} has ${weeks.get(f.id) ?? 0} weeks`),
        ];
        expect(violations).toEqual([]);
    });
});

describe("video and AI", () => {
    it("videos, jobs and analyses reference existing records", () => {
        const violations = [
            ...mockVideos.flatMap((v) => [
                ...missing(`${v.id}.fighterId`, v.fighterId, fighterIds),
                ...missing(`${v.id}.uploadedById`, v.uploadedById, userIds),
                ...missing(`${v.id}.sessionId`, v.sessionId, sessionById),
                ...missing(`${v.id}.jobId`, v.jobId, jobById),
                ...missing(`${v.id}.analysisId`, v.analysisId, analysisById),
                ...(v.sessionId && sessionById.get(v.sessionId)?.fighterId !== v.fighterId ? [`${v.id} session belongs to another fighter`] : []),
            ]),
            ...mockAIJobs.flatMap((j) => [
                ...missing(`${j.id}.videoId`, j.videoId, videoById),
                ...missing(`${j.id}.fighterId`, j.fighterId, fighterIds),
                ...j.modelIds.flatMap((id) => missing(`${j.id}.modelIds`, id, modelIds)),
                ...(videoById.get(j.videoId) && videoById.get(j.videoId)?.fighterId !== j.fighterId ? [`${j.id} fighter differs from video`] : []),
            ]),
            ...mockAIAnalyses.flatMap((a) => [
                ...missing(`${a.id}.videoId`, a.videoId, videoById),
                ...missing(`${a.id}.jobId`, a.jobId, jobById),
                ...missing(`${a.id}.fighterId`, a.fighterId, fighterIds),
                ...a.alertIds.flatMap((id) => missing(`${a.id}.alertIds`, id, alertById)),
                ...(videoById.get(a.videoId) && videoById.get(a.videoId)?.fighterId !== a.fighterId ? [`${a.id} fighter differs from video`] : []),
            ]),
        ];
        expect(violations).toEqual([]);
    });

    it("video job and analysis links agree in both directions", () => {
        const violations = [
            ...mockVideos.flatMap((v) => [
                ...(v.jobId && jobById.get(v.jobId)?.videoId !== v.id ? [`${v.id}.jobId ${v.jobId} points at another video`] : []),
                ...(v.analysisId && analysisById.get(v.analysisId)?.videoId !== v.id ? [`${v.id}.analysisId ${v.analysisId} points at another video`] : []),
                ...(v.status === "completed" && v.analysisId === null ? [`${v.id} completed without analysis`] : []),
                ...(v.status !== "completed" && v.analysisId !== null ? [`${v.id} ${v.status} with analysis`] : []),
            ]),
            ...mockAIAnalyses.flatMap((a) => [
                ...(videoById.get(a.videoId)?.analysisId !== a.id ? [`${a.id} not linked from ${a.videoId}`] : []),
                ...(jobById.get(a.jobId)?.videoId !== a.videoId ? [`${a.id}.jobId ${a.jobId} belongs to another video`] : []),
                ...(jobById.get(a.jobId)?.status !== "completed" ? [`${a.id}.jobId ${a.jobId} is not completed`] : []),
            ]),
            ...mockAIJobs
                .filter((j) => !mockVideos.some((v) => v.jobId === j.id) && videoById.get(j.videoId)?.jobId === null)
                .map((j) => `${j.id} belongs to ${j.videoId}, which has no job`),
            ...mockVideos.flatMap((v) => {
                const key = v.id.replace(/^v-/, "");
                return [
                    ...(v.jobId !== null && v.jobId !== `job-${key}` ? [`${v.id}.jobId ${v.jobId} breaks the job-<key> convention`] : []),
                    ...(v.analysisId !== null && v.analysisId !== `an-${key}` ? [`${v.id}.analysisId ${v.analysisId} breaks the an-<key> convention`] : []),
                ];
            }),
        ];
        expect(violations).toEqual([]);
    });

    it("alerts and injuries match the shared registry", () => {
        const alerts: Record<string, { analysisId: string; region: string; status: string; linkedInjuryId: string | null }> = {
            "al-minh-elbow-2d": { analysisId: "an-minh-pads-2d", region: "left_elbow", status: "new", linkedInjuryId: null },
            "al-kenji-shoulder-9d": { analysisId: "an-kenji-bag-9d", region: "right_shoulder", status: "follow_up", linkedInjuryId: null },
            "al-lucas-hip-4d": { analysisId: "an-lucas-shadow-4d", region: "left_hamstring", status: "acknowledged", linkedInjuryId: "inj-lucas-hamstring" },
            "al-marcus-hand-11d": { analysisId: "an-marcus-bag-11d", region: "right_hand", status: "follow_up", linkedInjuryId: "inj-marcus-hand" },
            "al-diego-balance-6d": { analysisId: "an-diego-sparring-6d", region: "head", status: "follow_up", linkedInjuryId: "inj-diego-concussion" },
            "al-linh-knee-5d": { analysisId: "an-linh-bag-5d", region: "left_knee", status: "dismissed", linkedInjuryId: null },
            "al-hoang-trunk-7d": { analysisId: "an-hoang-shadow-7d", region: "lower_back", status: "new", linkedInjuryId: null },
        };
        const injuries: Record<string, { region: string; status: string; linkedAlertId: string | null }> = {
            "inj-lucas-hamstring": { region: "left_hamstring", status: "recovering", linkedAlertId: null },
            "inj-diego-concussion": { region: "head", status: "active", linkedAlertId: "al-diego-balance-6d" },
            "inj-marcus-hand": { region: "right_hand", status: "active", linkedAlertId: "al-marcus-hand-11d" },
            "inj-tariq-knee": { region: "left_knee", status: "recovering", linkedAlertId: null },
        };
        const violations = [
            ...Object.entries(alerts).flatMap(([id, expected]) => {
                const alert = alertById.get(id);
                const actual = alert && { analysisId: alert.analysisId, region: alert.bodyRegion, status: alert.status, linkedInjuryId: alert.linkedInjuryId };
                return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [`${id}: ${JSON.stringify(actual)}`];
            }),
            ...Object.entries(injuries).flatMap(([id, expected]) => {
                const injury = injuryById.get(id);
                const actual = injury && { region: injury.bodyRegion, status: injury.status, linkedAlertId: injury.linkedAlertId };
                return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [`${id}: ${JSON.stringify(actual)}`];
            }),
        ];
        expect(violations).toEqual([]);
    });

    it("detections, combinations and findings stay inside their analysis", () => {
        const violations = mockAIAnalyses.flatMap((a) => {
            const detectionIds = new Set(a.detections.map((d) => d.id));
            const combinationIds = new Set(a.combinations.map((c) => c.id));
            return [
                ...a.findings.flatMap((f) => f.detectionIds.flatMap((id) => missing(`${a.id}/${f.id}.detectionIds`, id, detectionIds))),
                ...a.combinations.flatMap((c) => c.detectionIds.flatMap((id) => missing(`${a.id}/${c.id}.detectionIds`, id, detectionIds))),
                ...a.detections.flatMap((d) => missing(`${a.id}/${d.id}.combinationId`, d.combinationId, combinationIds)),
            ];
        });
        expect(violations).toEqual([]);
    });

    it("analysis strike counts equal the detections per type", () => {
        const violations = mockAIAnalyses.flatMap((a) =>
            STRIKE_TYPES.filter((type: StrikeType) => a.metrics.strikeCounts[type] !== a.detections.filter((d) => d.type === type).length).map(
                (type) => `${a.id} ${type}: metrics ${a.metrics.strikeCounts[type]}, detections ${a.detections.filter((d) => d.type === type).length}`,
            ),
        );
        expect(violations).toEqual([]);
    });

    it("alerts reference their analysis, video, fighter and injury", () => {
        const violations = mockAbnormalMovementAlerts.flatMap((al) => {
            const analysis = analysisById.get(al.analysisId);
            return [
                ...missing(`${al.id}.analysisId`, al.analysisId, analysisById),
                ...missing(`${al.id}.videoId`, al.videoId, videoById),
                ...missing(`${al.id}.fighterId`, al.fighterId, fighterIds),
                ...missing(`${al.id}.linkedInjuryId`, al.linkedInjuryId, injuryById),
                ...(analysis && analysis.videoId !== al.videoId ? [`${al.id} video differs from analysis`] : []),
                ...(analysis && analysis.fighterId !== al.fighterId ? [`${al.id} fighter differs from analysis`] : []),
                ...(analysis && !analysis.alertIds.includes(al.id) ? [`${al.id} not listed in ${analysis.id}.alertIds`] : []),
                ...(al.linkedInjuryId && injuryById.get(al.linkedInjuryId)?.fighterId !== al.fighterId ? [`${al.id} injury belongs to another fighter`] : []),
            ];
        });
        expect(violations).toEqual([]);
    });

    it("confidences and quality ratios are within 0–1", () => {
        const outOfRange = (label: string, value: number | null) => (value !== null && (value < 0 || value > 1) ? [`${label} = ${value}`] : []);
        const violations = [
            ...mockAIJobs.flatMap((j) => outOfRange(`${j.id}.avgConfidence`, j.avgConfidence)),
            ...mockAIAnalyses.flatMap((a) => [
                ...outOfRange(`${a.id}.overallConfidence`, a.overallConfidence),
                ...outOfRange(`${a.id}.trackingQuality`, a.trackingQuality),
                ...a.detections.flatMap((d) => outOfRange(`${a.id}/${d.id}`, d.confidence)),
                ...a.combinations.flatMap((c) => outOfRange(`${a.id}/${c.id}`, c.confidence)),
                ...a.movementEvents.flatMap((m) => outOfRange(`${a.id}/${m.id}`, m.confidence)),
                ...a.findings.flatMap((f) => outOfRange(`${a.id}/${f.id}`, f.confidence)),
            ]),
            ...mockAbnormalMovementAlerts.flatMap((al) => outOfRange(`${al.id}.confidence`, al.confidence)),
            ...mockAIModels.flatMap((m) => [
                ...outOfRange(`${m.id}.confidenceThreshold`, m.confidenceThreshold),
                ...outOfRange(`${m.id}.lowConfidenceThreshold`, m.lowConfidenceThreshold),
                ...outOfRange(`${m.id}.precision`, m.precision),
                ...outOfRange(`${m.id}.recall`, m.recall),
            ]),
        ];
        expect(violations).toEqual([]);
    });
});

describe("medical", () => {
    it("records, examinations, injuries, treatments and plans reference existing records", () => {
        const violations = [
            ...mockMedicalRecords.flatMap((r) => [
                ...missing(`${r.id}.fighterId`, r.fighterId, fighterIds),
                ...missing(`${r.id}.primaryDoctorId`, r.primaryDoctorId, doctorIds),
            ]),
            ...mockMedicalExaminations.flatMap((e) => [
                ...missing(`${e.id}.fighterId`, e.fighterId, fighterIds),
                ...missing(`${e.id}.doctorId`, e.doctorId, doctorIds),
            ]),
            ...mockInjuries.flatMap((i) => [
                ...missing(`${i.id}.fighterId`, i.fighterId, fighterIds),
                ...missing(`${i.id}.recordedById`, i.recordedById, doctorIds),
                ...missing(`${i.id}.linkedAlertId`, i.linkedAlertId, alertById),
                ...(i.linkedAlertId && alertById.get(i.linkedAlertId)?.linkedInjuryId !== i.id ? [`${i.id}.linkedAlertId is not linked back`] : []),
            ]),
            ...mockTreatments.flatMap((t) => [
                ...missing(`${t.id}.injuryId`, t.injuryId, injuryById),
                ...missing(`${t.id}.fighterId`, t.fighterId, fighterIds),
                ...(injuryById.get(t.injuryId) && injuryById.get(t.injuryId)?.fighterId !== t.fighterId ? [`${t.id} injury belongs to another fighter`] : []),
            ]),
            ...mockRecoveryPlans.flatMap((p) => [
                ...missing(`${p.id}.injuryId`, p.injuryId, injuryById),
                ...missing(`${p.id}.fighterId`, p.fighterId, fighterIds),
                ...missing(`${p.id}.doctorId`, p.doctorId, doctorIds),
                ...(injuryById.get(p.injuryId) && injuryById.get(p.injuryId)?.fighterId !== p.fighterId ? [`${p.id} injury belongs to another fighter`] : []),
            ]),
            ...mockMedicalClearances.flatMap((c) => [
                ...missing(`${c.id}.fighterId`, c.fighterId, fighterIds),
                ...missing(`${c.id}.doctorId`, c.doctorId, doctorIds),
                ...missing(`${c.id}.examinationId`, c.examinationId, examinationById),
                ...(c.examinationId && examinationById.get(c.examinationId)?.fighterId !== c.fighterId ? [`${c.id} examination belongs to another fighter`] : []),
            ]),
        ];
        expect(violations).toEqual([]);
    });

    it("each fighter has at most one active clearance", () => {
        const active = mockMedicalClearances.filter((c) => c.status === "active");
        expect(duplicates(active.map((c) => c.fighterId))).toEqual([]);
    });

    it("current clearances and health status follow the storylines", () => {
        const expected: Record<string, { level: ClearanceLevel | "none"; health: HealthStatus[] }> = {
            "f-minh-tran": { level: "full", health: ["healthy"] },
            "f-lucas-ferreira": { level: "restricted", health: ["recovery"] },
            "f-aigerim-sadykova": { level: "full", health: ["healthy"] },
            "f-kenji-morita": { level: "restricted", health: ["monitoring"] },
            "f-diego-alvarez": { level: "not_cleared", health: ["not_cleared"] },
            "f-linh-pham": { level: "full", health: ["healthy"] },
            "f-marcus-hale": { level: "restricted", health: ["injured"] },
            "f-sofia-kowalski": { level: "full", health: ["healthy"] },
            "f-hoang-long": { level: "full", health: ["monitoring"] },
            "f-tariq-haddad": { level: "restricted", health: ["recovery"] },
            "f-emma-lindqvist": { level: "full", health: ["healthy"] },
            "f-bao-nguyen": { level: "none", health: ["healthy"] },
        };
        const violations = mockFighters.flatMap((f) => {
            const story = expected[f.id];
            if (!story) return [`${f.id} has no storyline expectation`];
            const clearance = currentClearance(mockMedicalClearances, f.id);
            const state = clearanceState(clearance, ANCHOR);
            return [
                ...(state !== story.level ? [`${f.id} clearance ${state}, expected ${story.level}`] : []),
                ...(story.level !== "none" && clearance?.id !== `cl-${f.id.split("-")[1]}-current` ? [`${f.id} current clearance is ${clearance?.id}`] : []),
                ...(!story.health.includes(f.healthStatus) ? [`${f.id} health ${f.healthStatus}`] : []),
            ];
        });
        const sofia = currentClearance(mockMedicalClearances, "f-sofia-kowalski");
        const kenji = currentClearance(mockMedicalClearances, "f-kenji-morita");
        const diego = currentClearance(mockMedicalClearances, "f-diego-alvarez");
        expect(violations).toEqual([]);
        expect(sofia && clearanceDaysRemaining(sofia, ANCHOR)).toBe(5);
        expect(kenji && clearanceDaysRemaining(kenji, ANCHOR)).toBe(5);
        expect(diego?.validUntil).toBeNull();
        expect(mockMedicalExaminations.filter((e) => e.fighterId === "f-bao-nguyen")).toEqual([]);
    });
});

describe("platform", () => {
    it("notifications, broadcasts and audit entries reference existing users", () => {
        const violations = [
            ...mockNotifications.flatMap((n) => missing(`${n.id}.userId`, n.userId, userIds)),
            ...mockBroadcasts.flatMap((b) => missing(`${b.id}.createdById`, b.createdById, userIds)),
            ...mockAuditLogs.flatMap((log) => missing(`${log.id}.actorId`, log.actorId, userIds)),
        ];
        expect(violations).toEqual([]);
    });

    it("every notification links to an app path", () => {
        const violations = mockNotifications.filter((n) => typeof n.href !== "string" || !n.href.startsWith("/")).map((n) => `${n.id}: ${n.href}`);
        expect(violations).toEqual([]);
    });
});

describe("timeline", () => {
    it("past records are not dated after the anchor", () => {
        const future = (label: string, value: string | null | undefined) => (isFuture(value) ? [`${label} = ${value}`] : []);
        const futureDay = (label: string, value: string) => (isFutureDay(value) ? [`${label} = ${value}`] : []);
        const violations = [
            ...mockUsers.flatMap((u) => [...future(`${u.id}.createdAt`, u.createdAt), ...future(`${u.id}.lastActiveAt`, u.lastActiveAt)]),
            ...mockFighters.flatMap((f) => future(`${f.id}.joinedAt`, f.joinedAt)),
            ...mockTrainingPlans.flatMap((p) => [...future(`${p.id}.createdAt`, p.createdAt), ...future(`${p.id}.updatedAt`, p.updatedAt)]),
            ...mockTrainingSessions.flatMap((s) => [
                ...(s.status === "completed" || s.status === "missed" || s.status === "in_progress" ? future(`${s.id}.scheduledAt (${s.status})`, s.scheduledAt) : []),
                ...future(`${s.id}.result.completedAt`, s.result?.completedAt),
            ]),
            ...mockCoachFeedback.flatMap((fb) => future(`${fb.id}.createdAt`, fb.createdAt)),
            ...mockGoals.flatMap((g) => [
                ...future(`${g.id}.createdAt`, g.createdAt),
                ...futureDay(`${g.id}.startDate`, g.startDate),
                ...g.history.flatMap((c) => future(`${g.id}.history`, c.date)),
            ]),
            ...mockPerformanceMetrics.flatMap((m) => futureDay(`${m.id}.weekStart`, m.weekStart)),
            ...mockVideos.flatMap((v) => future(`${v.id}.uploadedAt`, v.uploadedAt)),
            ...mockAIJobs.flatMap((j) => [
                ...future(`${j.id}.queuedAt`, j.queuedAt),
                ...future(`${j.id}.startedAt`, j.startedAt),
                ...future(`${j.id}.finishedAt`, j.finishedAt),
            ]),
            ...mockAIAnalyses.flatMap((a) => [
                ...future(`${a.id}.processedAt`, a.processedAt),
                ...future(`${a.id}.coachReview`, a.coachReview?.reviewedAt),
                ...[...a.detections, ...a.findings].flatMap((item) => future(`${a.id}/${item.id}.review`, item.review?.reviewedAt)),
            ]),
            ...mockAbnormalMovementAlerts.flatMap((al) => [
                ...future(`${al.id}.detectedAt`, al.detectedAt),
                ...future(`${al.id}.doctorReview`, al.doctorReview?.reviewedAt),
            ]),
            ...mockAIModels.flatMap((m) => future(`${m.id}.deployedAt`, m.deployedAt)),
            ...mockMedicalRecords.flatMap((r) => [
                ...future(`${r.id}.lastPhysicalAt`, r.lastPhysicalAt),
                ...future(`${r.id}.updatedAt`, r.updatedAt),
                ...r.documents.flatMap((d) => future(`${r.id}/${d.id}.date`, d.date)),
            ]),
            ...mockMedicalExaminations.flatMap((e) => future(`${e.id}.date`, e.date)),
            ...mockInjuries.flatMap((i) => [
                ...future(`${i.id}.occurredAt`, i.occurredAt),
                ...future(`${i.id}.diagnosedAt`, i.diagnosedAt),
                ...future(`${i.id}.resolvedAt`, i.resolvedAt),
            ]),
            ...mockTreatments.flatMap((t) => [
                ...(t.status === "planned" ? [] : future(`${t.id}.startDate (${t.status})`, t.startDate)),
                ...(t.status === "completed" ? future(`${t.id}.endDate`, t.endDate) : []),
            ]),
            ...mockRecoveryPlans.flatMap((p) => [
                ...future(`${p.id}.startDate`, p.startDate),
                ...p.checkIns.flatMap((c) => future(`${p.id}.checkIn`, c.date)),
            ]),
            ...mockMedicalClearances.flatMap((c) => [...future(`${c.id}.issuedAt`, c.issuedAt), ...future(`${c.id}.revokedAt`, c.revokedAt)]),
            ...mockNotifications.flatMap((n) => [...future(`${n.id}.createdAt`, n.createdAt), ...future(`${n.id}.readAt`, n.readAt)]),
            ...mockBroadcasts.flatMap((b) => [...future(`${b.id}.createdAt`, b.createdAt), ...future(`${b.id}.sentAt`, b.sentAt)]),
            ...mockAuditLogs.flatMap((log) => future(`${log.id}.timestamp`, log.timestamp)),
        ];
        expect(violations).toEqual([]);
    });

    it("session status agrees with the anchor", () => {
        const after = (value: string) => Date.parse(value) > MOCK_ANCHOR_MS;
        const violations = mockTrainingSessions.flatMap((s) => {
            const happened = s.status === "completed" || s.status === "missed" || s.status === "in_progress";
            const today = dayKey(s.scheduledAt) === TODAY_KEY;
            const plannedEnd = Date.parse(s.scheduledAt) + s.durationMin * 60_000;
            return [
                ...(happened && after(s.scheduledAt) ? [`${s.id} is ${s.status} but starts after the anchor`] : []),
                ...(s.result && after(s.result.completedAt) ? [`${s.id} has a result completed after the anchor`] : []),
                ...(today && s.status === "completed" && (s.result === null || after(s.result.completedAt)) ? [`${s.id} completed today without ending before the anchor`] : []),
                ...(s.status === "scheduled" && plannedEnd <= MOCK_ANCHOR_MS ? [`${s.id} is still scheduled although it ended before the anchor`] : []),
            ];
        });
        expect(violations).toEqual([]);
    });

    it("linked records happen in a plausible order", () => {
        /** `later` must not be earlier than `earlier`; either may be absent when a step has not happened. */
        const before = (label: string, earlier: string | null | undefined, later: string | null | undefined) =>
            earlier != null && later != null && Date.parse(later) < Date.parse(earlier) ? [`${label}: ${later} < ${earlier}`] : [];
        /** Calendar-day variant for date fields stored at midnight. */
        const beforeDay = (label: string, earlier: string, later: string) =>
            dayKey(later) < dayKey(earlier) ? [`${label}: ${dayKey(later)} < ${dayKey(earlier)}`] : [];

        const violations = [
            ...mockTrainingPlans.flatMap((p) => [
                ...before(`${p.id} updated before created`, p.createdAt, p.updatedAt),
                ...(p.phase === "rehab" && !mockInjuries.some((i) => i.fighterId === p.fighterId && Date.parse(i.occurredAt) <= Date.parse(p.createdAt))
                    ? [`${p.id} rehab plan created before any injury`]
                    : []),
            ]),
            ...mockTrainingSessions.flatMap((s) => before(`${s.id} result before start`, s.scheduledAt, s.result?.completedAt)),
            ...mockCoachFeedback.flatMap((fb) => [
                ...before(`${fb.id} before its session`, fb.sessionId ? sessionById.get(fb.sessionId)?.scheduledAt : null, fb.createdAt),
                ...before(`${fb.id} before its video upload`, fb.videoId ? videoById.get(fb.videoId)?.uploadedAt : null, fb.createdAt),
            ]),
            ...mockVideos.flatMap((v) => before(`${v.id} uploaded before its session`, v.sessionId ? sessionById.get(v.sessionId)?.scheduledAt : null, v.uploadedAt)),
            ...mockAIJobs.flatMap((j) => [
                ...before(`${j.id} queued before upload`, videoById.get(j.videoId)?.uploadedAt, j.queuedAt),
                ...before(`${j.id} started before queued`, j.queuedAt, j.startedAt),
                ...before(`${j.id} finished before started`, j.startedAt, j.finishedAt),
            ]),
            ...mockAIAnalyses.flatMap((a) => [
                ...before(`${a.id} processed before job start`, jobById.get(a.jobId)?.startedAt, a.processedAt),
                ...before(`${a.id} coach review before processing`, a.processedAt, a.coachReview?.reviewedAt),
                ...[...a.detections, ...a.findings].flatMap((item) => before(`${a.id}/${item.id} reviewed before processing`, a.processedAt, item.review?.reviewedAt)),
            ]),
            ...mockAbnormalMovementAlerts.flatMap((al) => [
                ...before(`${al.id} detected before processing`, analysisById.get(al.analysisId)?.processedAt, al.detectedAt),
                ...before(`${al.id} reviewed before detection`, al.detectedAt, al.doctorReview?.reviewedAt),
            ]),
            ...mockInjuries.flatMap((i) => [
                ...before(`${i.id} diagnosed before it occurred`, i.occurredAt, i.diagnosedAt),
                ...before(`${i.id} resolved before diagnosis`, i.diagnosedAt, i.resolvedAt),
            ]),
            ...mockTreatments.flatMap((t) => {
                const injury = injuryById.get(t.injuryId);
                return [
                    ...(injury ? beforeDay(`${t.id} starts before the injury`, injury.occurredAt, t.startDate) : []),
                    ...(t.endDate ? beforeDay(`${t.id} ends before it starts`, t.startDate, t.endDate) : []),
                ];
            }),
            ...mockRecoveryPlans.flatMap((p) => {
                const injury = injuryById.get(p.injuryId);
                return [
                    ...(injury ? beforeDay(`${p.id} starts before the injury`, injury.occurredAt, p.startDate) : []),
                    ...p.checkIns.flatMap((c) => beforeDay(`${p.id} check-in before start`, p.startDate, c.date)),
                ];
            }),
            ...mockMedicalClearances.flatMap((c) => [
                ...before(`${c.id} issued before its examination`, c.examinationId ? examinationById.get(c.examinationId)?.date : null, c.issuedAt),
                ...before(`${c.id} revoked before issue`, c.issuedAt, c.revokedAt),
            ]),
            ...mockNotifications.flatMap((n) => before(`${n.id} read before created`, n.createdAt, n.readAt)),
        ];
        expect(violations).toEqual([]);
    });
});

describe("clinical consistency", () => {
    it("clearance levels match the outcome of their examination", () => {
        const expectedOutcome = { full: "fit", restricted: "fit_with_restrictions", not_cleared: "unfit" } as const;
        const violations = mockMedicalClearances.flatMap((c) => {
            const exam = c.examinationId ? examinationById.get(c.examinationId) : null;
            return exam && exam.outcome !== expectedOutcome[c.level] ? [`${c.id} ${c.level} after ${exam.id} ${exam.outcome}`] : [];
        });
        expect(violations).toEqual([]);
    });
});
