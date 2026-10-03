import "server-only";

import { z } from "zod";

import { authenticatedApiRequest } from "@/lib/api/client";
import { jobStats, type AIJobStats } from "@/lib/domain/ai-job-stats";
import type { BodyJoint } from "@/lib/domain/medical-contract";
import { JOINT_REGIONS } from "@/lib/domain/medical-mappings";
import type { AbnormalMovementAlert, Fighter } from "@/lib/domain/types";
import { matchesSearch } from "@/lib/query";
import { round } from "@/lib/utils";
import type { AIJobDetail, AIJobFilter, AIJobListItem, AlertDetail, AlertFilter } from "./ai.demo";
import { nullIfNotFound } from "./api-helpers";
import { getFighter } from "./people";
import { getJobProgress, getVideo, listAnalysisJobs, listVideosAndJobs } from "./videos";

/*
 * The AI pipeline as the NestJS jobs API offers it: one analysis job per video, no model registry, no confidence and
 * no analysis summary. The health alerts the worker attaches to a job are the doctor's movement observations; the
 * service has no review for them, so they stay new.
 */

async function fightersById(ids: readonly string[]): Promise<Map<string, Fighter>> {
    const fighters = await Promise.all([...new Set(ids)].filter(Boolean).map(getFighter));
    return new Map(fighters.flatMap((fighter) => (fighter ? [[fighter.id, fighter] as const] : [])));
}

/** Pipeline jobs, newest queued first. */
export async function listAIJobs(filter: AIJobFilter = {}): Promise<AIJobListItem[]> {
    const { videos, jobs } = await listVideosAndJobs();
    const videosById = new Map(videos.map((video) => [video.id, video]));
    const fighters = await fightersById(jobs.map((job) => job.fighterId));
    return jobs
        .map((job) => ({ job, video: videosById.get(job.videoId) ?? null, fighter: fighters.get(job.fighterId) ?? null }))
        .filter(
            ({ job, video, fighter }) =>
                (!filter.status || job.status === filter.status) &&
                (filter.lowConfidence === undefined || job.lowConfidence === filter.lowConfidence) &&
                matchesSearch(filter.search, job.id, video?.title, video?.fileName, fighter?.name, job.errorCode),
        )
        .sort((a, b) => b.job.queuedAt.localeCompare(a.job.queuedAt));
}

/** A job with its video and fighter. The service keeps no model list, analysis summary or earlier runs. */
export async function getAIJobDetail(id: string): Promise<AIJobDetail | null> {
    const job = await getJobProgress(id);
    if (!job) return null;
    const [video, fighter] = await Promise.all([job.videoId ? getVideo(job.videoId) : null, job.fighterId ? getFighter(job.fighterId) : null]);
    return { job, video, fighter, models: [], analysis: null, otherRuns: [] };
}

/** Pipeline health. A job's processing time runs from upload to result, since the service records no start. */
export async function getAIJobStats(now: Date): Promise<AIJobStats> {
    return jobStats(await listAnalysisJobs(), now.getTime(), {
        durationSec: (job) => (job.finishedAt ? Math.max(0, Math.round((Date.parse(job.finishedAt) - Date.parse(job.queuedAt)) / 1000)) : null),
        reportsConfidence: false,
    });
}

/* ─── Movement observations ───────────────────────────────────────────────── */

const healthAlertSchema = z.object({
    joint: z.string(),
    severity: z.string(),
    triggerTimeMs: z.number(),
    windowStartMs: z.number(),
    avgRomRatio: z.number(),
    motionClass: z.string(),
    recommendation: z.string(),
});

const impairmentJobSchema = z
    .object({
        id: z.string().uuid(),
        videoId: z.string().uuid().nullable(),
        fighterId: z.string().uuid().nullable(),
        updatedAt: z.string(),
        healthAlerts: z.array(healthAlertSchema),
    })
    .passthrough();

type ImpairmentJob = z.output<typeof impairmentJobSchema>;

const MOTION_PHRASES: Record<string, string> = {
    POWER_STRIKE: " during power strikes",
    PARTIAL_STRIKE: " during partial strikes",
    TACTICAL_FEINT: " during feints",
};

/** Observation ids name the job and the alert's place in it, so one can be read back without a list. */
const ALERT_ID_SEPARATOR = "~";

/** A job's health alerts as observations, phrased as possibilities. Alerts on joints the interface doesn't map are left out. */
function toObservations(job: ImpairmentJob): AbnormalMovementAlert[] {
    if (!job.fighterId) return [];
    const fighterId = job.fighterId;
    return job.healthAlerts.flatMap((alert, index) => {
        const joint = alert.joint.toUpperCase();
        if (!(joint in JOINT_REGIONS)) return [];
        const bodyRegion = JOINT_REGIONS[joint as BodyJoint];
        return [
            {
                id: `${job.id}${ALERT_ID_SEPARATOR}${index}`,
                analysisId: `an-${job.id}`,
                videoId: job.videoId ?? "",
                fighterId,
                detectedAt: job.updatedAt,
                bodyRegion,
                pattern: `Possible reduced range of motion${MOTION_PHRASES[alert.motionClass] ?? ""}`,
                description: alert.recommendation,
                // The worker gives no confidence for an alert, and none is shown in its place.
                confidence: null,
                metric: { label: "Range of motion against the fighter's own baseline", observed: round(alert.avgRomRatio * 100, 0), baseline: 100, unit: "%" },
                timestampsMs: [alert.windowStartMs, alert.triggerTimeMs],
                status: "new",
                doctorReview: null,
                linkedInjuryId: null,
            },
        ];
    });
}

/** Movement observations from the latest analyses with an impairment (the service returns the newest 50), newest first. */
export async function listAlerts(filter: AlertFilter = {}): Promise<AbnormalMovementAlert[]> {
    const jobs = await authenticatedApiRequest("/jobs/impairments", z.array(impairmentJobSchema));
    return jobs
        .flatMap(toObservations)
        .filter(
            (alert) =>
                (filter.fighterIds === undefined || filter.fighterIds === "all" || filter.fighterIds.includes(alert.fighterId)) &&
                (!filter.status || alert.status === filter.status) &&
                (!filter.bodyRegion || alert.bodyRegion === filter.bodyRegion),
        )
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

const healthAlertsSchema = z.object({ healthAlerts: z.array(healthAlertSchema) });

/** One observation with its fighter and footage. There is no analysis or linked injury to show with it. */
export async function getAlertDetail(id: string): Promise<AlertDetail | null> {
    const [jobId, index] = id.split(ALERT_ID_SEPARATOR);
    if (!z.string().uuid().safeParse(jobId).success || !/^\d+$/.test(index ?? "")) return null;
    const [job, alerts] = await Promise.all([
        getJobProgress(jobId),
        nullIfNotFound(authenticatedApiRequest(`/jobs/${encodeURIComponent(jobId)}/health-alerts`, healthAlertsSchema)),
    ]);
    if (!job || !alerts) return null;
    const alert = toObservations({ id: job.id, videoId: job.videoId || null, fighterId: job.fighterId || null, updatedAt: job.finishedAt ?? job.queuedAt, healthAlerts: alerts.healthAlerts }).find(
        (observation) => observation.id === id,
    );
    if (!alert) return null;
    const [fighter, video] = await Promise.all([getFighter(alert.fighterId), alert.videoId ? getVideo(alert.videoId) : null]);
    return { alert, fighter, video, analysis: null, linkedInjury: null };
}
