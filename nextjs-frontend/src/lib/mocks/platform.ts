import {
    BODY_REGION_LABELS,
    BROADCAST_CHANNEL_LABELS,
    CLEARANCE_LEVEL_LABELS,
    EXAMINATION_OUTCOME_LABELS,
    REVIEW_DECISION_LABELS,
    ROLE_LABELS,
    TRAINING_TYPE_LABELS,
} from "@/lib/domain/labels";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type {
    AIAnalysis,
    AIFeedback,
    AuditLog,
    AuditResourceType,
    MedicalClearance,
    Notification,
    NotificationBroadcast,
    NotificationCategory,
    NotificationSeverity,
    ReviewDecision,
    Role,
    TrainingSession,
    TrainingType,
    User,
    Video,
} from "@/lib/domain/types";
import { daysBetween, formatConfidence, formatDate, formatDateTime, formatFileSize, formatShortDate, formatTime, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { round } from "@/lib/utils";
import { mockAbnormalMovementAlerts, mockAIAnalyses, mockAIJobs, mockAIModels, mockVideos } from "./ai";
import { mockInjuries, mockMedicalClearances, mockMedicalExaminations, mockRecoveryPlans, mockTreatments } from "./medical";
import { BAO_BASELINE_EXAM_DATE, mockCoaches, mockDoctors, mockFighters, mockUsers } from "./people";
import { createRandom, type Random } from "./random";
import { clampPastToday, daysAgo, daysFromNow, fromToday, pastToday, shiftPastToday } from "./time";
import { mockCoachFeedback, mockGoals, mockTrainingPlans, mockTrainingSessions } from "./training";

/**
 * Platform seed: in-app notifications, admin broadcasts and the audit trail.
 *
 * Nothing here restates a fact owned by another seed. Timestamps, reviewers, uploaders,
 * clearance restrictions, confidences and counts are read from the training, AI and medical
 * seeds (via the shared id registry), so notifications and audit entries always agree with the
 * records they point at. Conventions:
 * - Notifications respect each user's `lastActiveAt`: anything newer is unread, older ones were
 *   read minutes to hours after arriving. Demo accounts also keep their newest items unread.
 * - Sent in-app broadcasts deliver one "system" notification to every account that was active
 *   when they went out, exactly like `createBroadcast()` does at runtime.
 * - Coaches see clearance levels and restrictions but never clinical detail; admins see
 *   operational events only, and medical audit details stay non-clinical.
 * - The audit trail covers the last 30 days. Every storyline event is included; high-volume
 *   routine events (uploads, reviews, check-ins…) only for their most recent days, which keeps
 *   the trail at roughly 150–180 entries.
 */

const NORA = "u-nora-whitfield";
const QUANG = "u-quang-vu";
const RAFAEL = "u-rafael-costa";
const ANNA = "u-anna-volkova";
const JAMES = "u-james-okafor";
const THU = "u-thu-le";
const SAMUEL = "u-samuel-brooks";
const MINH = "u-minh-tran";

const SYSTEM_IP = "10.20.8.2";
const GYM_TABLET_IP = "10.20.4.41";

/** Workstations on the academy network. */
const OFFICE_IP: Record<string, string> = {
    "u-rafael-costa": "10.20.4.21",
    "u-anna-volkova": "10.20.4.22",
    "u-james-okafor": "10.20.4.23",
    "u-thu-le": "10.20.6.11",
    "u-samuel-brooks": "10.20.6.12",
    "u-nora-whitfield": "10.20.1.5",
    "u-quang-vu": "10.20.1.8",
};

/** Home or mobile connections (Vietnamese ISPs). */
const HOME_IP: Record<string, string> = {
    "u-minh-tran": "14.169.23.87",
    "u-lucas-ferreira": "113.172.40.19",
    "u-aigerim-sadykova": "27.72.101.54",
    "u-kenji-morita": "58.187.12.200",
    "u-diego-alvarez": "171.244.61.9",
    "u-linh-pham": "14.241.110.73",
    "u-marcus-hale": "113.161.88.142",
    "u-sofia-kowalski": "42.113.9.61",
    "u-hoang-long": "14.186.201.33",
    "u-tariq-haddad": "116.110.47.25",
    "u-emma-lindqvist": "1.53.220.18",
    "u-bao-nguyen": "118.69.35.140",
    "u-rafael-costa": "113.185.44.12",
    "u-anna-volkova": "27.66.143.8",
    "u-james-okafor": "113.23.54.131",
    "u-thu-le": "14.232.18.90",
    "u-samuel-brooks": "125.235.9.66",
    "u-nora-whitfield": "171.252.13.77",
    "u-quang-vu": "42.118.230.5",
};

const TODAY_START = fromToday(0, 0, 0);
const AUDIT_WINDOW_START = daysAgo(30, 0, 0);

/* ────────────────────────────────────────────────────────────────────────────
 * Lookups into the other seeds
 * ──────────────────────────────────────────────────────────────────────────── */

function record<T extends { id: string }>(items: readonly T[], id: string, kind: string): T {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Platform seed references unknown ${kind} "${id}".`);
    return item;
}

const userById = (id: string) => record(mockUsers, id, "user");
const fighterById = (id: string) => record(mockFighters, id, "fighter");
const videoById = (id: string) => record(mockVideos, id, "video");
const jobById = (id: string) => record(mockAIJobs, id, "AI job");
const alertById = (id: string) => record(mockAbnormalMovementAlerts, id, "AI alert");
const clearanceById = (id: string) => record(mockMedicalClearances, id, "clearance");
const examinationById = (id: string) => record(mockMedicalExaminations, id, "examination");
const recoveryPlanById = (id: string) => record(mockRecoveryPlans, id, "recovery plan");
const sessionById = (id: string) => record(mockTrainingSessions, id, "training session");
const planById = (id: string) => record(mockTrainingPlans, id, "training plan");

function analysisOf(videoId: string): AIAnalysis {
    const video = videoById(videoId);
    return record(mockAIAnalyses, video.analysisId ?? `analysis of ${videoId}`, "AI analysis");
}

/** User id behind a coach or doctor profile id. */
function staffUserId(profileId: string): string {
    const profile = mockCoaches.find((c) => c.id === profileId) ?? mockDoctors.find((d) => d.id === profileId);
    if (!profile) throw new Error(`Platform seed references unknown staff profile "${profileId}".`);
    return profile.userId;
}

const staffName = (profileId: string) => userById(staffUserId(profileId)).name;
const fighterName = (fighterId: string) => fighterById(fighterId).name;
/** Events derived from another record; offsets from today's records stay ordered and before the anchor. */
const minutesAfter = shiftPastToday;

/** "Pad Work" → "Pad work", for use inside sentences and labels. */
function typeLabel(type: TrainingType): string {
    const label = TRAINING_TYPE_LABELS[type];
    return label.charAt(0) + label.slice(1).toLowerCase();
}

function restrictionSummary(clearance: MedicalClearance): string {
    return clearance.restrictions.map((r) => r.label).join("; ");
}

function validity(clearance: MedicalClearance): string {
    return clearance.validUntil ? ` Valid until ${formatDate(clearance.validUntil)}.` : "";
}

function withUnit(value: number, unit: string): string {
    return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Broadcasts
 * ──────────────────────────────────────────────────────────────────────────── */

/** Accounts in the audience that were active when a broadcast went out. */
function audienceAt(audience: Role[], at: string): User[] {
    return mockUsers.filter((user) => user.status === "active" && audience.includes(user.role) && user.createdAt <= at);
}

function broadcast(seed: Omit<NotificationBroadcast, "recipientCount">): NotificationBroadcast {
    return { ...seed, recipientCount: audienceAt(seed.audience, seed.sentAt ?? seed.createdAt).length };
}

function boutDate(fighterId: string): string {
    const bout = fighterById(fighterId).upcomingBout;
    if (!bout) throw new Error(`Platform seed expects "${fighterId}" to have an upcoming bout.`);
    return bout.date;
}

/** Sofia Kowalski and Hoàng Long both fight at Lotus Fight Night 17. */
const LFN17 = { date: boutDate("f-sofia-kowalski") };

export const mockBroadcasts: NotificationBroadcast[] = [
    broadcast({
        id: "brd-head-movement",
        title: "AI analysis now tracks head movement",
        body: "Analyses now measure slips, rolls and centreline exposure alongside strikes and guard. Look for the new Head Movement section in every video processed from today — older videos keep their original results.",
        audience: ["fighter", "coach"],
        channel: "in_app",
        status: "sent",
        scheduledFor: null,
        sentAt: daysAgo(19, 10, 0),
        createdById: NORA,
        createdAt: daysAgo(19, 9, 42),
    }),
    broadcast({
        id: "brd-clearance-planner",
        title: "Medical Clearance checks now run in the session planner",
        body: "When you schedule a session, the planner checks it against the fighter's current Medical Clearance. Blocked training types and RPE caps stop the session from being saved; restricted techniques and protected areas show a warning. Clearance decisions stay with the sports doctors.",
        audience: ["coach", "doctor"],
        channel: "email",
        status: "sent",
        scheduledFor: null,
        sentAt: daysAgo(15, 9, 30),
        createdById: NORA,
        createdAt: daysAgo(15, 9, 5),
    }),
    broadcast({
        id: "brd-gym-maintenance",
        title: "Gym closed for maintenance — Sunday",
        body: "The mats, cage and bag area are closed all day Sunday while the flooring is replaced. The physio room stays open 09:00–13:00 for booked appointments only. Training resumes Monday at 06:00.",
        audience: ["fighter", "coach", "doctor", "admin"],
        channel: "in_app_email",
        status: "sent",
        scheduledFor: null,
        sentAt: daysAgo(10, 17, 0),
        createdById: NORA,
        createdAt: daysAgo(10, 16, 35),
    }),
    broadcast({
        id: "brd-weight-cut-guidance",
        title: "Fight-week hydration and weight-cut guidance",
        body: "Prepared with Dr. Thu Lê and Dr. Samuel Brooks. Cut no more than 5% of body weight in fight week, no saunas or sweat suits without a doctor's sign-off, weigh in every morning, and report dizziness, cramps or dark urine to your sports doctor straight away.",
        audience: ["fighter", "coach", "doctor"],
        channel: "email",
        status: "draft",
        scheduledFor: null,
        sentAt: null,
        createdById: NORA,
        createdAt: daysAgo(2, 15, 10),
    }),
    broadcast({
        id: "brd-video-guidelines",
        title: "New video upload guidelines (lighting & camera angle)",
        body: "For reliable AI analysis: film landscape at 1080p and 30 fps or more, keep your whole body in frame from about 3 metres, use the front or 45° diagonal angle, and train under the main lights rather than by the windows. On iPhone choose H.264 (Most Compatible) — HEVC 10-bit clips can't be processed.",
        audience: ["fighter", "coach"],
        channel: "in_app_email",
        status: "sent",
        scheduledFor: null,
        sentAt: daysAgo(1, 10, 30),
        createdById: NORA,
        createdAt: daysAgo(1, 10, 5),
    }),
    broadcast({
        id: "brd-lfn17-medicals",
        title: "Lotus Fight Night 17 medicals schedule",
        body: `Pre-fight medicals for Lotus Fight Night 17 (${formatDate(LFN17.date)}) run at the academy clinic from ${formatWeekdayDate(daysFromNow(3))} to ${formatWeekdayDate(daysFromNow(12))}, 08:00–12:00. Bring your fight licence, recent blood work and a list of any medication, and book your slot with your sports doctor.`,
        audience: ["fighter", "doctor"],
        channel: "in_app_email",
        status: "scheduled",
        scheduledFor: daysFromNow(1, 8, 0),
        sentAt: null,
        createdById: NORA,
        createdAt: daysAgo(1, 15, 20),
    }),
];

/* ────────────────────────────────────────────────────────────────────────────
 * Notification building blocks
 * ──────────────────────────────────────────────────────────────────────────── */

type NotificationSeed = Pick<Notification, "createdAt" | "category" | "severity" | "title" | "body" | "href">;

function note(
    createdAt: string,
    category: NotificationCategory,
    severity: NotificationSeverity,
    title: string,
    body: string,
    href: string,
): NotificationSeed {
    return { createdAt, category, severity, title, body, href };
}

const readyAt = (videoId: string) => minutesAfter(analysisOf(videoId).processedAt, 1);
const jobEndedAt = (jobId: string) => minutesAfter(jobById(jobId).finishedAt ?? jobById(jobId).queuedAt, 1);

function analysisReadyForFighter(videoId: string): NotificationSeed {
    const video = videoById(videoId);
    const analysis = analysisOf(videoId);
    const low = analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD;
    return note(
        readyAt(videoId),
        "ai_analysis",
        low ? "warning" : "success",
        `AI analysis ready — ${typeLabel(video.trainingType)} (${formatShortDate(video.uploadedAt)})`,
        low
            ? `Overall confidence is ${formatConfidence(analysis.overallConfidence)}, so some results may be less reliable until your coach has reviewed them.`
            : `Your ${typeLabel(video.trainingType).toLowerCase()} footage has been analysed: strikes, guard, head movement and footwork.`,
        routes.fighter.video(videoId),
    );
}

function analysisReadyForCoach(videoId: string): NotificationSeed {
    const video = videoById(videoId);
    const analysis = analysisOf(videoId);
    const low = analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD;
    const subject = `${fighterName(video.fighterId)} ${typeLabel(video.trainingType).toLowerCase()}`;
    return note(
        readyAt(videoId),
        "ai_analysis",
        low ? "warning" : "info",
        low ? `Low-confidence analysis — ${subject}` : `AI analysis ready — ${subject}`,
        low
            ? `Overall confidence is ${formatConfidence(analysis.overallConfidence)}. Review the detections before relying on the findings.`
            : "The analysis is ready for your coach review.",
        routes.coach.video(videoId),
    );
}

function coachReviewForFighter(videoId: string): NotificationSeed[] {
    const video = videoById(videoId);
    const review = analysisOf(videoId).coachReview;
    if (!review) return [];
    return [
        note(
            minutesAfter(review.reviewedAt, 1),
            "feedback",
            "info",
            `${review.reviewerName} reviewed your ${typeLabel(video.trainingType).toLowerCase()} analysis`,
            review.summary,
            routes.fighter.video(videoId),
        ),
    ];
}

/** Feedback ids are not part of the shared registry, so a missing one is simply skipped. */
function feedbackForFighter(feedbackId: string): NotificationSeed[] {
    const feedback = mockCoachFeedback.find((f) => f.id === feedbackId);
    if (!feedback) return [];
    return [
        note(
            minutesAfter(feedback.createdAt, 1),
            "feedback",
            feedback.kind === "praise" ? "success" : "info",
            `New feedback from ${staffName(feedback.coachId)}`,
            feedback.body,
            feedback.videoId
                ? routes.fighter.video(feedback.videoId)
                : feedback.sessionId
                  ? routes.fighter.session(feedback.sessionId)
                  : routes.fighter.training,
        ),
    ];
}

/** Latest weekly checkpoint of a goal, phrased for the fighter or the coach. */
function goalCheckpoint(goalId: string, audience: "fighter" | "coach"): NotificationSeed[] {
    const goal = mockGoals.find((g) => g.id === goalId);
    const checkpoint = goal?.history.at(-1);
    if (!goal || !checkpoint || (goal.status !== "at_risk" && goal.status !== "on_track")) return [];
    const atRisk = goal.status === "at_risk";
    const subject = audience === "coach" ? `${fighterName(goal.fighterId)}: ${goal.title}` : goal.title;
    return [
        note(
            minutesAfter(checkpoint.date, 5),
            "goal",
            atRisk ? "warning" : "success",
            `${atRisk ? "Goal at risk" : "Goal on track"} — ${subject}`,
            `${goal.metricLabel}: ${withUnit(goal.current, goal.unit)} against a target of ${withUnit(goal.target, goal.unit)}.`,
            audience === "coach" ? routes.coach.fighterGoals(goal.fighterId) : routes.fighter.goals,
        ),
    ];
}

function clearanceForFighter(clearanceId: string): NotificationSeed {
    const clearance = clearanceById(clearanceId);
    const doctor = staffName(clearance.doctorId);
    const at = minutesAfter(clearance.issuedAt, 1);
    if (clearance.level === "not_cleared") {
        return note(
            at,
            "clearance",
            "danger",
            "Medical Clearance changed — Not Cleared",
            `${doctor} has paused all training while you follow your return-to-training protocol. Rest, and report any new or worsening symptoms straight away.`,
            routes.fighter.health,
        );
    }
    if (clearance.level === "restricted") {
        return note(
            at,
            "clearance",
            "warning",
            "Medical Clearance updated — cleared with restrictions",
            `${doctor} cleared you to train within these restrictions: ${restrictionSummary(clearance)}.${validity(clearance)}`,
            routes.fighter.health,
        );
    }
    return note(at, "clearance", "success", "Medical Clearance renewed", `${doctor} cleared you for full training.${validity(clearance)}`, routes.fighter.health);
}

function clearanceForCoach(clearanceId: string, title?: string): NotificationSeed {
    const clearance = clearanceById(clearanceId);
    const name = fighterName(clearance.fighterId);
    const doctor = staffName(clearance.doctorId);
    const at = minutesAfter(clearance.issuedAt, 1);
    if (clearance.level === "not_cleared") {
        return note(
            at,
            "clearance",
            "danger",
            title ?? `Medical Clearance changed — ${name}: Not Cleared`,
            `${doctor} changed ${name}'s clearance to not cleared. Don't schedule any training until the clearance is updated.`,
            routes.coach.clearance,
        );
    }
    return note(
        at,
        "clearance",
        clearance.level === "restricted" ? "warning" : "success",
        title ?? `${name} ${clearance.level === "restricted" ? "cleared with restrictions" : "cleared for full training"}`,
        clearance.level === "restricted"
            ? `${doctor}: ${restrictionSummary(clearance)}.${validity(clearance)}`
            : `${doctor} cleared ${name} without restrictions.${validity(clearance)}`,
        routes.coach.clearance,
    );
}

function alertForDoctor(alertId: string): NotificationSeed {
    const alert = alertById(alertId);
    const low = alert.confidence < LOW_CONFIDENCE_THRESHOLD;
    return note(
        minutesAfter(alert.detectedAt, 1),
        "ai_alert",
        low ? "info" : "warning",
        `New AI movement observation — ${fighterName(alert.fighterId)}, ${BODY_REGION_LABELS[alert.bodyRegion].toLowerCase()}`,
        `${alert.pattern} (${formatConfidence(alert.confidence)} confidence${low ? " — below the review threshold, check the clip" : ""}).`,
        routes.doctor.aiAlert(alertId),
    );
}

/** The recovery check-in closest to `days` ago. */
function checkInLogged(planId: string, days: number): NotificationSeed {
    const plan = recoveryPlanById(planId);
    const target = Date.parse(daysAgo(days));
    const checkIn = [...plan.checkIns].sort((a, b) => Math.abs(Date.parse(a.date) - target) - Math.abs(Date.parse(b.date) - target))[0];
    if (!checkIn) throw new Error(`Recovery plan "${planId}" has no check-ins.`);
    return note(
        minutesAfter(checkIn.date, 1),
        "medical",
        "info",
        `Recovery check-in logged — ${fighterName(plan.fighterId)}`,
        `Pain ${checkIn.painLevel}/10 · mobility ${checkIn.mobilityPct}% · strength ${checkIn.strengthPct}%. “${checkIn.note}”`,
        routes.doctor.recoveryPlan(planId),
    );
}

function lowConfidenceJob(jobId: string, cause: string): NotificationSeed {
    const job = jobById(jobId);
    return note(
        jobEndedAt(jobId),
        "system",
        "warning",
        `AI job completed with low confidence — ${jobId}`,
        `Mean confidence ${formatConfidence(job.avgConfidence ?? 0)} — ${cause}. The analysis is marked for human review.`,
        routes.admin.aiJob(jobId),
    );
}

function jobFailedForAdmin(jobId: string): NotificationSeed {
    const job = jobById(jobId);
    const retried = mockAIJobs.find((j) => j.videoId === job.videoId && j.queuedAt > job.queuedAt);
    const message = job.errorMessage ?? "The pipeline stopped without an error message.";
    return note(
        jobEndedAt(jobId),
        "system",
        "danger",
        `AI job failed — ${job.errorCode} (${job.videoId})`,
        `${/[.!?]$/.test(message) ? message : `${message}.`}${job.attempts > 1 ? ` Failed after ${job.attempts} attempts.` : ""}${retried ? ` Re-queued as ${retried.id}.` : ""}`,
        routes.admin.aiJob(jobId),
    );
}

function modelInStaging(name: string, version: string): NotificationSeed {
    const model = mockAIModels.find((m) => m.name === name && m.version === version);
    if (!model) throw new Error(`Platform seed references unknown AI model "${name} ${version}".`);
    return note(minutesAfter(model.deployedAt, 2), "system", "success", `${name} ${version} ready in staging`, model.description, routes.admin.aiModel(model.id));
}

function modelIdOf(name: string, version: string): string {
    const model = mockAIModels.find((m) => m.name === name && m.version === version);
    if (!model) throw new Error(`Platform seed references unknown AI model "${name} ${version}".`);
    return model.id;
}

/* ─── Storyline anchors ─── */

const RAFAEL_PROFILE = record(mockCoaches, "c-rafael-costa", "coach");

/** Completed analyses on Rafael's roster still waiting for a coach review. */
const RAFAEL_REVIEW_QUEUE = mockAIAnalyses
    .filter((a) => RAFAEL_PROFILE.fighterIds.includes(a.fighterId) && a.coachReview === null)
    .sort((a, b) => a.processedAt.localeCompare(b.processedAt));

/** Most recent session Rafael coaches that was marked missed in the last three weeks. */
const RAFAEL_MISSED_SESSION: TrainingSession | undefined = mockTrainingSessions
    .filter((s) => s.coachId === RAFAEL_PROFILE.id && s.status === "missed" && s.scheduledAt >= daysAgo(21, 0, 0))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];

const MINH_PADS = videoById("v-minh-pads-2d");
const MINH_PADS_LOW_DETECTIONS = analysisOf(MINH_PADS.id).detections.filter((d) => d.confidence < LOW_CONFIDENCE_THRESHOLD).length;
const MINH_CLEARANCE = clearanceById("cl-minh-current");
const MINH_ROUTINE_EXAM = mockMedicalExaminations
    .filter((e) => e.fighterId === "f-minh-tran" && e.type === "routine" && e.date >= daysAgo(21, 0, 0))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
const KENJI_EXAM = examinationById("ex-kenji-shoulder-7d");
const DIEGO_PROTOCOL = recoveryPlanById("rp-diego-concussion");
const DIEGO_CURRENT_PHASE = DIEGO_PROTOCOL.phases.findIndex((p) => p.status === "current");
const DIEGO_NEXT_EXAM = mockMedicalExaminations
    .filter((e) => e.fighterId === "f-diego-alvarez" && e.followUpDate !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
const SOFIA_CLEARANCE = clearanceById("cl-sofia-current");
const HOANG = fighterById("f-hoang-long");
const HOANG_WEIGHT_FEEDBACK = mockCoachFeedback.find((f) => f.id === "fb-hoang-weight-3d");
const EMMA_SPARRING = videoById("v-emma-sparring-1d");
const BAO_BASELINE = formatWeekdayDate(`${BAO_BASELINE_EXAM_DATE}T12:00:00+07:00`);

/** Medical cancellations per fighter, with the clearance change that triggered them. */
function medicalCancellations(fighterId: string): { sessions: TrainingSession[]; cancelledAt: string } {
    const sessions = mockTrainingSessions
        .filter((s) => s.fighterId === fighterId && s.status === "cancelled" && s.cancellationReason?.startsWith("Medical") && s.scheduledAt >= AUDIT_WINDOW_START)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const first = sessions[0]?.scheduledAt ?? TODAY_START;
    const triggers = mockMedicalClearances
        .filter((c) => c.fighterId === fighterId)
        .flatMap((c) => [c.revokedAt, c.level === "not_cleared" ? c.issuedAt : null])
        .filter((at): at is string => at !== null && at <= first)
        .sort();
    return { sessions, cancelledAt: minutesAfter(triggers.at(-1) ?? minutesAfter(first, -60), 20) };
}

const DIEGO_CANCELLATIONS = medicalCancellations("f-diego-alvarez");

/* ────────────────────────────────────────────────────────────────────────────
 * Inboxes
 * ──────────────────────────────────────────────────────────────────────────── */

interface Inbox {
    userId: string;
    /** Newest items kept unread regardless of when the user was last active. */
    unread: number;
    items: NotificationSeed[];
}

const SECURITY_SUMMARY_TODAY = note(
    pastToday(8, 0),
    "system",
    "info",
    "Weekly security summary",
    "4 failed sign-ins in the last 7 days from 3 addresses, including 2 attempts for an unknown email from 45.77.12.186. No accounts locked. MFA is still optional for staff.",
    routes.admin.auditLogs,
);

const BAO_VIDEO_FAILED = note(
    jobEndedAt("job-bao-shadow-3d"),
    "ai_analysis",
    "danger",
    "Video couldn't be analysed",
    "Your clip uses HEVC 10-bit, which we can't process. Export it as H.264 (Most Compatible on iPhone) and upload it again.",
    routes.fighter.video("v-bao-shadow-3d"),
);

const INBOXES: Inbox[] = [
    /* ─── Demo fighter ─── */
    {
        userId: MINH,
        unread: 6,
        items: [
            analysisReadyForFighter("v-minh-sparring-16d"),
            ...coachReviewForFighter("v-minh-sparring-16d"),
            analysisReadyForFighter("v-minh-shadow-9d"),
            ...feedbackForFighter("fb-minh-shadow-9d"),
            ...coachReviewForFighter("v-minh-shadow-9d"),
            ...(MINH_CLEARANCE.issuedAt >= daysAgo(21, 0, 0)
                ? [clearanceForFighter(MINH_CLEARANCE.id)]
                : MINH_ROUTINE_EXAM
                  ? [
                        note(
                            minutesAfter(MINH_ROUTINE_EXAM.date, 75),
                            "clearance",
                            "success",
                            "Medical Clearance confirmed for fight camp",
                            `${staffName(MINH_ROUTINE_EXAM.doctorId)} completed your fight camp check. You remain cleared for full training.${validity(MINH_CLEARANCE)}`,
                            routes.fighter.health,
                        ),
                    ]
                  : []),
            ...feedbackForFighter("fb-minh-strength-6d"),
            note(
                minutesAfter(planById("tp-minh-fight-camp").updatedAt, 1),
                "training",
                "info",
                "Fight camp plan updated",
                `Rafael Costa updated “${planById("tp-minh-fight-camp").title}”. Check this week's sessions for changes.`,
                routes.fighter.plan("tp-minh-fight-camp"),
            ),
            note(
                minutesAfter(sessionById("s-minh-pads-2d").scheduledAt, -8 * 60),
                "training",
                "info",
                `Session today at ${formatTime(sessionById("s-minh-pads-2d").scheduledAt)}`,
                `${sessionById("s-minh-pads-2d").title} with ${staffName(sessionById("s-minh-pads-2d").coachId)}.`,
                routes.fighter.session("s-minh-pads-2d"),
            ),
            ...feedbackForFighter("fb-minh-pads-2d-hook"),
            analysisReadyForFighter(MINH_PADS.id),
            note(
                pastToday(6, 30),
                "training",
                "info",
                "Weigh-in reminder",
                `Log your morning weight before training. You're ${round(fighterById("f-minh-tran").weightKg - fighterById("f-minh-tran").targetWeightKg, 1)} kg above the featherweight limit with ${daysBetween(TODAY_START, boutDate("f-minh-tran"))} days until Lotus Fight Night 18.`,
                routes.fighter.dashboard,
            ),
            ...goalCheckpoint("g-minh-guard-recovery", "fighter"),
            note(
                minutesAfter(videoById("v-minh-bag-today").uploadedAt, 1),
                "ai_analysis",
                "info",
                "Heavy bag video is processing",
                "We're analysing this morning's heavy bag footage. You'll get another notification when the results are ready.",
                routes.fighter.video("v-minh-bag-today"),
            ),
            ...feedbackForFighter("fb-minh-bag-today"),
        ],
    },
    /* ─── Demo coach ─── */
    {
        userId: RAFAEL,
        unread: 6,
        items: [
            ...(RAFAEL_MISSED_SESSION
                ? [
                      note(
                          minutesAfter(RAFAEL_MISSED_SESSION.scheduledAt, 30),
                          "training",
                          "warning",
                          `Session missed — ${fighterName(RAFAEL_MISSED_SESSION.fighterId)}`,
                          `${fighterName(RAFAEL_MISSED_SESSION.fighterId)} didn't check in for “${RAFAEL_MISSED_SESSION.title}” on ${formatWeekdayDate(RAFAEL_MISSED_SESSION.scheduledAt)} at ${formatTime(RAFAEL_MISSED_SESSION.scheduledAt)}.`,
                          routes.coach.session(RAFAEL_MISSED_SESSION.id),
                      ),
                  ]
                : []),
            analysisReadyForCoach("v-marcus-bag-11d"),
            clearanceForCoach("cl-marcus-current", "Marcus Hale restricted: no striking with the right hand"),
            analysisReadyForCoach("v-kenji-bag-9d"),
            clearanceForCoach("cl-kenji-current"),
            analysisReadyForCoach("v-diego-sparring-6d"),
            clearanceForCoach("cl-diego-current"),
            clearanceForCoach("cl-tariq-current"),
            analysisReadyForCoach("v-linh-bag-5d"),
            analysisReadyForCoach("v-aigerim-pads-3d"),
            note(
                jobEndedAt("job-tariq-shadow-2d"),
                "ai_analysis",
                "warning",
                "Tariq Haddad's video couldn't be analysed",
                "The AI couldn't find Tariq in frame for most of his shadow boxing clip. He'll need to re-record it with his whole body visible.",
                routes.coach.fighterVideos("f-tariq-haddad"),
            ),
            analysisReadyForCoach(MINH_PADS.id),
            note(
                minutesAfter(readyAt(MINH_PADS.id), 5),
                "ai_analysis",
                "warning",
                "Low-confidence detections need review — Minh Trần pad work",
                `${pluralize(MINH_PADS_LOW_DETECTIONS, "detection")} in Minh's pad work analysis ${MINH_PADS_LOW_DETECTIONS === 1 ? "is" : "are"} below 60% confidence. Confirm or correct them before the findings are shared.`,
                routes.coach.video(MINH_PADS.id),
            ),
            note(
                pastToday(7, 0),
                "ai_analysis",
                "info",
                "Sparring video still queued — Emma Lindqvist",
                `Uploaded yesterday at ${formatTime(EMMA_SPARRING.uploadedAt)} and still waiting for a free AI worker. You'll be notified when it's ready to review.`,
                routes.coach.video(EMMA_SPARRING.id),
            ),
            ...(RAFAEL_REVIEW_QUEUE.length > 0
                ? [
                      note(
                          pastToday(7, 30),
                          "ai_analysis",
                          "info",
                          `${pluralize(RAFAEL_REVIEW_QUEUE.length, "analysis", "analyses")} awaiting your review`,
                          `${RAFAEL_REVIEW_QUEUE.map((a) => `${fighterName(a.fighterId)} (${typeLabel(videoById(a.videoId).trainingType).toLowerCase()})`).join(", ")} ${RAFAEL_REVIEW_QUEUE.length === 1 ? "is" : "are"} waiting for your coach review.`,
                          routes.coach.videoAnalysis,
                      ),
                  ]
                : []),
            ...goalCheckpoint("g-minh-guard-recovery", "coach"),
            note(
                minutesAfter(videoById("v-minh-bag-today").uploadedAt, 1),
                "ai_analysis",
                "info",
                "Minh Trần's heavy bag video is processing",
                "Minh uploaded this morning's heavy bag rounds. The analysis will be ready for review shortly.",
                routes.coach.video("v-minh-bag-today"),
            ),
        ],
    },
    /* ─── Demo doctor ─── */
    {
        userId: THU,
        unread: 5,
        items: [
            checkInLogged("rp-lucas-hamstring", 16),
            alertForDoctor("al-marcus-hand-11d"),
            alertForDoctor("al-kenji-shoulder-9d"),
            alertForDoctor("al-hoang-trunk-7d"),
            note(
                minutesAfter(record(mockInjuries, "inj-diego-concussion", "injury").occurredAt, 6),
                "medical",
                "danger",
                "Sparring stopped — Diego Alvarez",
                "Rafael Costa stopped Diego's sparring in round 3 after he looked unsteady and asked for a medical assessment before he leaves the gym.",
                routes.doctor.fighter("f-diego-alvarez"),
            ),
            alertForDoctor("al-diego-balance-6d"),
            alertForDoctor("al-linh-knee-5d"),
            alertForDoctor("al-lucas-hip-4d"),
            checkInLogged("rp-marcus-hand", 3),
            ...(HOANG_WEIGHT_FEEDBACK
                ? [
                      note(
                          minutesAfter(HOANG_WEIGHT_FEEDBACK.createdAt, 5),
                          "medical",
                          "warning",
                          "Hydration flagged — Hoàng Long",
                          `${staffName(HOANG_WEIGHT_FEEDBACK.coachId)} recorded ${HOANG.weightKg} kg with only fair hydration while Hoàng Long cuts to ${HOANG.targetWeightKg} kg for Lotus Fight Night 17.`,
                          routes.doctor.fighter(HOANG.id),
                      ),
                  ]
                : []),
            note(
                daysAgo(2, 9, 40),
                "medical",
                "info",
                "Pre-fight medical to book — Hoàng Long",
                `Hoàng Long fights at Lotus Fight Night 17 in ${daysBetween(daysAgo(2, 9, 40), LFN17.date)} days. Book his pre-fight medical during the clinic block.`,
                routes.doctor.fighter(HOANG.id),
            ),
            alertForDoctor("al-minh-elbow-2d"),
            checkInLogged("rp-lucas-hamstring", 1),
            ...(KENJI_EXAM.followUpDate
                ? [
                      note(
                          pastToday(6, 45),
                          "medical",
                          "info",
                          `Follow-up due in ${daysBetween(TODAY_START, KENJI_EXAM.followUpDate)} days — Kenji Morita`,
                          `Kenji's restricted clearance ends on ${formatDate(clearanceById("cl-kenji-current").validUntil ?? KENJI_EXAM.followUpDate)}. Re-examine the right shoulder before renewing or changing it.`,
                          routes.doctor.fighter("f-kenji-morita"),
                      ),
                  ]
                : []),
            note(
                pastToday(7, 0),
                "medical",
                "warning",
                "Concussion protocol review — Diego Alvarez",
                `Diego is at stage ${DIEGO_CURRENT_PHASE + 1} of ${DIEGO_PROTOCOL.phases.length} (${DIEGO_PROTOCOL.phases[DIEGO_CURRENT_PHASE]?.name ?? "in progress"}). Review his symptom check-ins${DIEGO_NEXT_EXAM?.followUpDate ? ` before the follow-up examination on ${formatWeekdayDate(DIEGO_NEXT_EXAM.followUpDate)}` : ""}.`,
                routes.doctor.recoveryPlan(DIEGO_PROTOCOL.id),
            ),
        ],
    },
    /* ─── Demo admin ─── */
    {
        userId: NORA,
        unread: 6,
        items: [
            note(
                daysAgo(19, 16, 32),
                "system",
                "warning",
                "Repeated failed sign-ins",
                "5 failed sign-in attempts for admin@lotus-combat.test (no such account) from 113.161.54.201 within 8 minutes. No account was affected.",
                routes.admin.auditLogs,
            ),
            note(
                daysAgo(16, 2, 15),
                "system",
                "info",
                "Video retention job completed",
                "No footage was past the 365-day retention window. The next run is in 30 days.",
                routes.admin.videos,
            ),
            note(
                daysAgo(14, 8, 0),
                "system",
                "info",
                "Weekly security summary",
                "5 failed sign-ins in the last 7 days, all for an unknown email from 113.161.54.201. No accounts locked. MFA is still optional for staff.",
                routes.admin.auditLogs,
            ),
            note(
                minutesAfter(userById("u-bao-nguyen").createdAt, 260),
                "system",
                "success",
                "Invitation accepted — Bảo Nguyễn",
                "Bảo Nguyễn activated his fighter account.",
                routes.admin.user("u-bao-nguyen"),
            ),
            jobFailedForAdmin("job-emma-bag-12d-a1"),
            modelInStaging("move-anomaly", "1.0.0-rc1"),
            note(
                daysAgo(9, 9, 0),
                "system",
                "info",
                "Monthly storage report",
                "Video storage grew 18% this month, mostly 1080p pad work and sparring footage. Usage is well within the storage plan.",
                routes.admin.videos,
            ),
            jobFailedForAdmin("job-kenji-bag-9d-a1"),
            note(
                daysAgo(7, 8, 0),
                "system",
                "info",
                "Weekly security summary",
                "1 failed sign-in in the last 7 days, followed by a successful sign-in from the same address. No accounts locked.",
                routes.admin.auditLogs,
            ),
            lowConfidenceJob("job-hoang-shadow-7d", "mostly from poor lighting"),
            modelInStaging("strike-cls", "2.4.0-rc1"),
            lowConfidenceJob("job-diego-sparring-6d", "two fighters in frame caused occlusion"),
            jobFailedForAdmin("job-bao-shadow-3d"),
            note(
                daysAgo(2, 7, 56),
                "system",
                "info",
                "AI model thresholds updated",
                "Quang Vũ changed the low-confidence threshold for move-anomaly 0.9.2-beta from 55% to 60%.",
                routes.admin.aiModel(modelIdOf("move-anomaly", "0.9.2-beta")),
            ),
            jobFailedForAdmin("job-tariq-shadow-2d"),
            note(
                minutesAfter(jobById("job-emma-sparring-1d").queuedAt, 12),
                "system",
                "warning",
                "AI queue wait above 10 minutes",
                `job-emma-sparring-1d (Emma Lindqvist, sparring) has been waiting since ${formatTime(jobById("job-emma-sparring-1d").queuedAt)}. Check worker capacity on the AI jobs page.`,
                routes.admin.aiJobs,
            ),
            SECURITY_SUMMARY_TODAY,
            note(
                pastToday(8, 5),
                "system",
                "warning",
                "Priya Nair hasn't accepted her invitation",
                `Priya was invited as ${userById("u-priya-nair").title} ${daysBetween(userById("u-priya-nair").createdAt, TODAY_START)} days ago and hasn't signed in yet. Resend the invitation if she can't find the email.`,
                routes.admin.user("u-priya-nair"),
            ),
        ],
    },
    /* ─── Fighters ─── */
    {
        userId: "u-lucas-ferreira",
        unread: 1,
        items: [
            clearanceForFighter("cl-lucas-current"),
            note(
                minutesAfter(planById("tp-lucas-return").updatedAt, 1),
                "training",
                "info",
                "Return-to-training plan updated",
                `Anna Volkova updated “${planById("tp-lucas-return").title}” to match your Medical Clearance.`,
                routes.fighter.plan("tp-lucas-return"),
            ),
            analysisReadyForFighter("v-lucas-shadow-4d"),
            ...feedbackForFighter("fb-lucas-passing-4d"),
            note(daysAgo(1, 7, 0), "medical", "info", "Recovery check-in due", "Log your pain, mobility and strength for your hamstring recovery plan.", routes.fighter.health),
        ],
    },
    {
        userId: "u-aigerim-sadykova",
        unread: 1,
        items: [...feedbackForFighter("fb-aigerim-pads-3d-head"), analysisReadyForFighter("v-aigerim-pads-3d")],
    },
    {
        userId: "u-kenji-morita",
        unread: 0,
        items: [
            analysisReadyForFighter("v-kenji-bag-9d"),
            note(
                minutesAfter(alertById("al-kenji-shoulder-9d").doctorReview?.reviewedAt ?? KENJI_EXAM.date, 1),
                "medical",
                "info",
                "Examination booked",
                `Dr. Thu Lê booked a shoulder examination for ${formatWeekdayDate(KENJI_EXAM.date)} at ${formatTime(KENJI_EXAM.date)}.`,
                routes.fighter.health,
            ),
            clearanceForFighter("cl-kenji-current"),
            ...(KENJI_EXAM.followUpDate
                ? [
                      note(
                          pastToday(7, 0),
                          "medical",
                          "info",
                          `Follow-up examination in ${daysBetween(TODAY_START, KENJI_EXAM.followUpDate)} days`,
                          `Your shoulder follow-up with Dr. Thu Lê is on ${formatWeekdayDate(KENJI_EXAM.followUpDate)} at ${formatTime(KENJI_EXAM.followUpDate)}.`,
                          routes.fighter.health,
                      ),
                  ]
                : []),
        ],
    },
    {
        userId: "u-diego-alvarez",
        unread: 0,
        items: [
            ...feedbackForFighter("fb-diego-sparring-6d"),
            clearanceForFighter("cl-diego-current"),
            ...(DIEGO_CANCELLATIONS.sessions.length > 0
                ? [
                      note(
                          minutesAfter(DIEGO_CANCELLATIONS.cancelledAt, 5),
                          "training",
                          "warning",
                          "Sessions cancelled while you're Not Cleared",
                          `Rafael Costa cancelled ${pluralize(DIEGO_CANCELLATIONS.sessions.length, "session")}. They'll be rescheduled once Dr. Thu Lê updates your clearance.`,
                          routes.fighter.schedule,
                      ),
                  ]
                : []),
            note(daysAgo(3, 7, 0), "medical", "info", "Symptom check-in due", "Log today's symptoms for your return-to-training protocol.", routes.fighter.health),
        ],
    },
    {
        userId: "u-linh-pham",
        unread: 1,
        items: [analysisReadyForFighter("v-linh-bag-5d"), ...feedbackForFighter("fb-linh-bag-5d-hands"), ...coachReviewForFighter("v-linh-bag-5d")],
    },
    {
        userId: "u-marcus-hale",
        unread: 0,
        items: [
            ...feedbackForFighter("fb-marcus-bag-11d"),
            clearanceForFighter("cl-marcus-current"),
            note(
                minutesAfter(planById("tp-marcus-rehab-conditioning").updatedAt, 1),
                "training",
                "info",
                "Plan updated for your recovery",
                `Rafael Costa set up “${planById("tp-marcus-rehab-conditioning").title}” while your right hand heals.`,
                routes.fighter.plan("tp-marcus-rehab-conditioning"),
            ),
            ...feedbackForFighter("fb-marcus-conditioning-6d"),
        ],
    },
    {
        userId: "u-sofia-kowalski",
        unread: 1,
        items: [
            analysisReadyForFighter("v-sofia-pads-8d"),
            ...coachReviewForFighter("v-sofia-pads-8d"),
            ...feedbackForFighter("fb-sofia-prefight-medical-1d"),
            note(
                pastToday(7, 0),
                "clearance",
                "warning",
                `Your Medical Clearance expires in ${daysBetween(TODAY_START, SOFIA_CLEARANCE.validUntil ?? TODAY_START)} days`,
                `Book your pre-fight medical with ${staffName(SOFIA_CLEARANCE.doctorId)} before ${formatDate(SOFIA_CLEARANCE.validUntil ?? TODAY_START)}. You fight at Lotus Fight Night 17 in ${daysBetween(TODAY_START, LFN17.date)} days.`,
                routes.fighter.health,
            ),
        ],
    },
    {
        userId: "u-hoang-long",
        unread: 1,
        items: [
            analysisReadyForFighter("v-hoang-shadow-7d"),
            ...feedbackForFighter("fb-hoang-shadow-7d"),
            ...feedbackForFighter("fb-hoang-weight-3d"),
            note(
                daysAgo(2, 9, 41),
                "medical",
                "info",
                "Pre-fight medical coming up",
                "Dr. Thu Lê will book your pre-fight medical for Lotus Fight Night 17. Watch for the clinic schedule.",
                routes.fighter.health,
            ),
        ],
    },
    {
        userId: "u-tariq-haddad",
        unread: 0,
        items: [
            clearanceForFighter("cl-tariq-current"),
            note(
                jobEndedAt("job-tariq-shadow-2d"),
                "ai_analysis",
                "danger",
                "Video couldn't be analysed",
                "The AI couldn't find you in frame for most of the clip. Re-record with your whole body visible from about 3 metres away.",
                routes.fighter.video("v-tariq-shadow-2d"),
            ),
            ...feedbackForFighter("fb-tariq-mitts-2d"),
        ],
    },
    {
        userId: "u-emma-lindqvist",
        unread: 1,
        items: [
            ...feedbackForFighter("fb-emma-body-kick-8d"),
            ...feedbackForFighter("fb-emma-sparring-1d"),
            note(
                minutesAfter(EMMA_SPARRING.uploadedAt, 1),
                "ai_analysis",
                "info",
                "Sparring video queued for analysis",
                `${userById(EMMA_SPARRING.uploadedById).name} uploaded your sparring footage. You'll be notified as soon as the analysis is ready.`,
                routes.fighter.video(EMMA_SPARRING.id),
            ),
        ],
    },
    {
        userId: "u-bao-nguyen",
        unread: 1,
        items: [
            note(
                minutesAfter(userById("u-bao-nguyen").createdAt, 259),
                "system",
                "success",
                "Welcome to Lotus Combat Academy",
                "Anna Volkova and James Okafor are your coaches. Complete your baseline physical before your first sparring session.",
                routes.profile,
            ),
            ...feedbackForFighter("fb-bao-sprawl-4d"),
            BAO_VIDEO_FAILED,
            note(
                daysAgo(1, 9, 0),
                "medical",
                "info",
                "Baseline physical booked",
                `Your baseline physical with Dr. Samuel Brooks is on ${BAO_BASELINE}. You'll need a Medical Clearance before sparring.`,
                routes.fighter.health,
            ),
        ],
    },
    /* ─── Staff ─── */
    {
        userId: ANNA,
        unread: 2,
        items: [
            clearanceForCoach("cl-lucas-current"),
            analysisReadyForCoach("v-hoang-shadow-7d"),
            clearanceForCoach("cl-diego-current"),
            analysisReadyForCoach("v-lucas-shadow-4d"),
            note(
                pastToday(7, 0),
                "clearance",
                "warning",
                `Sofia Kowalski's clearance expires in ${daysBetween(TODAY_START, SOFIA_CLEARANCE.validUntil ?? TODAY_START)} days`,
                `Sofia fights at Lotus Fight Night 17 in ${daysBetween(TODAY_START, LFN17.date)} days. ${staffName(SOFIA_CLEARANCE.doctorId)} needs to complete her pre-fight medical before ${formatDate(SOFIA_CLEARANCE.validUntil ?? TODAY_START)}.`,
                routes.coach.clearance,
            ),
        ],
    },
    {
        userId: JAMES,
        unread: 0,
        items: [
            clearanceForCoach("cl-lucas-current"),
            clearanceForCoach("cl-tariq-current"),
            note(
                pastToday(7, 0),
                "clearance",
                "warning",
                "Bảo Nguyễn has no Medical Clearance yet",
                `His baseline physical is on ${BAO_BASELINE}. Keep his sessions to technique and conditioning until he's cleared.`,
                routes.coach.fighter("f-bao-nguyen"),
            ),
        ],
    },
    {
        userId: SAMUEL,
        unread: 1,
        items: [
            alertForDoctor("al-marcus-hand-11d"),
            checkInLogged("rp-tariq-knee", 6),
            alertForDoctor("al-lucas-hip-4d"),
            note(
                daysAgo(1, 9, 0),
                "medical",
                "info",
                "Baseline physical booked — Bảo Nguyễn",
                `Scheduled for ${BAO_BASELINE}. Bảo has no Medical Clearance on file yet.`,
                routes.doctor.fighter("f-bao-nguyen"),
            ),
            note(
                pastToday(7, 0),
                "clearance",
                "warning",
                `Clearance expires in ${daysBetween(TODAY_START, SOFIA_CLEARANCE.validUntil ?? TODAY_START)} days — Sofia Kowalski`,
                "Her pre-fight medical for Lotus Fight Night 17 is due. Schedule it during the clinic block.",
                routes.doctor.fighter("f-sofia-kowalski"),
            ),
        ],
    },
    {
        userId: QUANG,
        unread: 0,
        items: [
            modelInStaging("move-anomaly", "1.0.0-rc1"),
            lowConfidenceJob("job-hoang-shadow-7d", "mostly from poor lighting"),
            modelInStaging("strike-cls", "2.4.0-rc1"),
            jobFailedForAdmin("job-bao-shadow-3d"),
            jobFailedForAdmin("job-tariq-shadow-2d"),
            SECURITY_SUMMARY_TODAY,
        ],
    },
];

/** Deliveries that depend on the generated training calendar. */
const CALENDAR_DELIVERIES: { userId: string; item: NotificationSeed }[] = RAFAEL_MISSED_SESSION
    ? [
          {
              userId: fighterById(RAFAEL_MISSED_SESSION.fighterId).userId,
              item: note(
                  minutesAfter(RAFAEL_MISSED_SESSION.scheduledAt, 30),
                  "training",
                  "warning",
                  "Session marked as missed",
                  `Your session “${RAFAEL_MISSED_SESSION.title}” on ${formatWeekdayDate(RAFAEL_MISSED_SESSION.scheduledAt)} was marked as missed. Let Rafael Costa know if something came up.`,
                  routes.fighter.session(RAFAEL_MISSED_SESSION.id),
              ),
          },
      ]
    : [];

/** In-app copies of sent broadcasts for one user. */
function broadcastDeliveries(user: User): NotificationSeed[] {
    return mockBroadcasts.flatMap((item) =>
        item.status === "sent" &&
        item.sentAt !== null &&
        item.channel !== "email" &&
        audienceAt(item.audience, item.sentAt).some((recipient) => recipient.id === user.id)
            ? [note(item.sentAt, "system", "info", item.title, item.body, routes.notifications)]
            : [],
    );
}

function readAtFor(createdAt: string, keepUnread: boolean, lastActiveAt: string | null, random: Random): string | null {
    if (keepUnread || lastActiveAt === null || createdAt > lastActiveAt) return null;
    const readAt = Date.parse(createdAt) + random.int(4, 240) * 60_000;
    return new Date(Math.min(readAt, Date.parse(lastActiveAt))).toISOString();
}

function buildNotifications(): Notification[] {
    const random = createRandom("platform:notifications");
    const inboxes = new Map(INBOXES.map((inbox) => [userById(inbox.userId).id, inbox]));

    const drafts = mockUsers.flatMap((user) => {
        const inbox = inboxes.get(user.id);
        const items = [
            ...(inbox?.items ?? []),
            ...CALENDAR_DELIVERIES.filter((d) => d.userId === user.id).map((d) => d.item),
            ...broadcastDeliveries(user),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return items.map((item, index) => ({
            userId: user.id,
            ...item,
            readAt: readAtFor(item.createdAt, index < (inbox?.unread ?? 0), user.lastActiveAt, random),
        }));
    });

    return drafts
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.userId.localeCompare(b.userId))
        .map((draft, index) => ({ id: `ntf-${index + 1}`, ...draft }))
        .reverse();
}

export const mockNotifications: Notification[] = buildNotifications();

/* ────────────────────────────────────────────────────────────────────────────
 * Audit logs
 * ──────────────────────────────────────────────────────────────────────────── */

type AuditSeed = Omit<AuditLog, "id">;

interface AuditOptions {
    status?: AuditLog["status"];
    ip?: string;
}

/** How many days back routine, high-volume events are kept in the trail. */
const ROUTINE_LOOKBACK_DAYS = {
    uploads: 7,
    coachReviews: 14,
    findingReviews: 7,
    examinations: 21,
    treatments: 7,
    checkIns: 2,
    planUpdates: 7,
} as const;

const since = (days: number) => daysAgo(days, 0, 0);

function audit(
    at: string,
    actorId: string | null,
    action: string,
    resourceType: AuditResourceType,
    resourceId: string,
    resourceLabel: string,
    details: string | null = null,
    options: AuditOptions = {},
): AuditSeed {
    const actor = actorId === null ? null : userById(actorId);
    return {
        actorId,
        actorName: actor?.name ?? "System",
        actorRole: actor?.role ?? "system",
        action,
        resourceType,
        resourceId,
        resourceLabel,
        timestamp: at,
        ipAddress: options.ip ?? (actor ? (OFFICE_IP[actor.id] ?? HOME_IP[actor.id]) : SYSTEM_IP),
        status: options.status ?? "success",
        details,
    };
}

function signIn(at: string, userId: string, ip?: string): AuditSeed {
    const user = userById(userId);
    return audit(at, userId, "auth.sign_in", "auth", user.id, user.email, null, { ip: ip ?? OFFICE_IP[userId] ?? HOME_IP[userId] });
}

/** Mirrors the sign-in action: failed attempts are recorded without an actor. */
function failedSignIn(at: string, email: string, ip: string): AuditSeed {
    return audit(at, null, "auth.sign_in", "auth", email, email, "Invalid credentials", { status: "failure", ip });
}

/* ─── Platform administration ─── */

function adminAudit(): AuditSeed[] {
    const priya = userById("u-priya-nair");
    const bao = userById("u-bao-nguyen");
    const broadcasts = mockBroadcasts
        .filter((b) => b.status !== "draft")
        .map((b) => {
            const delivery = `${pluralize(b.recipientCount, "recipient")} · ${b.audience.map((role) => ROLE_LABELS[role]).join(", ")} · ${BROADCAST_CHANNEL_LABELS[b.channel]}`;
            const details = b.sentAt ? `Sent to ${delivery}` : `Scheduled for ${formatDateTime(b.scheduledFor ?? b.createdAt)} · ${delivery}`;
            return audit(b.sentAt ?? b.createdAt, b.createdById, "notification.broadcast", "notification", b.id, b.title, details);
        });
    const deployments = mockAIModels
        .filter((m) => m.deployedAt >= AUDIT_WINDOW_START)
        .map((m) => audit(m.deployedAt, QUANG, "ai_model.deploy", "ai_model", m.id, `${m.name} ${m.version}`, `Deployed to ${m.status}`));

    return [
        ...broadcasts,
        ...deployments,
        audit(daysAgo(29, 10, 15), NORA, "settings.update", "settings", "system-settings", "System settings", "Maximum video size: 400 MB → 500 MB"),
        audit(
            daysAgo(27, 9, 40),
            QUANG,
            "ai_model.update_thresholds",
            "ai_model",
            modelIdOf("fighter-det", "2.1.0"),
            "fighter-det 2.1.0",
            "Confidence threshold: 30% → 35%",
        ),
        audit(daysAgo(26, 11, 20), NORA, "user.update", "user", SAMUEL, "Dr. Samuel Brooks — Sports doctor account", "Title: Physiotherapist → Sports Physiotherapist"),
        audit(daysAgo(22, 9, 15), NORA, "settings.update", "settings", "system-settings", "System settings", "Clearance expiry warning: 7 days → 14 days"),
        audit(
            daysAgo(21, 14, 30),
            QUANG,
            "settings.update",
            "settings",
            "system-settings",
            "System settings",
            "Rejected: the low-confidence review threshold (30%) must be higher than the detection threshold (35%)",
            { status: "failure" },
        ),
        audit(daysAgo(14, 13, 10), NORA, "role.update_permissions", "role", "coach", "Coach role", "Added: goals:write"),
        audit(bao.createdAt, NORA, "user.invite", "user", bao.id, "Bảo Nguyễn — Fighter account", `Invited as ${bao.title}`),
        signIn(minutesAfter(bao.createdAt, 258), bao.id),
        audit(priya.createdAt, NORA, "user.invite", "user", priya.id, "Priya Nair — Sports doctor account", `Invited as ${priya.title}`),
        audit(minutesAfter(priya.createdAt, 3), NORA, "user.update_role", "user", priya.id, "Priya Nair — Coach account", "Sports doctor → Coach"),
        signIn(daysAgo(2, 7, 48), QUANG),
        audit(
            daysAgo(2, 7, 55),
            QUANG,
            "ai_model.update_thresholds",
            "ai_model",
            modelIdOf("move-anomaly", "0.9.2-beta"),
            "move-anomaly 0.9.2-beta",
            "Low-confidence threshold: 55% → 60%",
        ),
    ];
}

/** Failed sign-ins behind the weekly security summaries, plus the demo accounts' latest sessions. */
function securityAudit(): AuditSeed[] {
    return [
        failedSignIn(daysAgo(19, 16, 21), "admin@lotus-combat.test", "113.161.54.201"),
        failedSignIn(daysAgo(19, 16, 23), "admin@lotus-combat.test", "113.161.54.201"),
        failedSignIn(daysAgo(19, 16, 24), "admin@lotus-combat.test", "113.161.54.201"),
        failedSignIn(daysAgo(19, 16, 26), "admin@lotus-combat.test", "113.161.54.201"),
        failedSignIn(daysAgo(19, 16, 29), "admin@lotus-combat.test", "113.161.54.201"),
        failedSignIn(daysAgo(9, 22, 14), "rafael.costa@lotus-combat.test", HOME_IP[RAFAEL]),
        signIn(daysAgo(9, 22, 15), RAFAEL, HOME_IP[RAFAEL]),
        failedSignIn(daysAgo(5, 7, 41), "minh.tran@lotus-combat.vn", HOME_IP[MINH]),
        signIn(daysAgo(5, 7, 42), MINH),
        failedSignIn(daysAgo(2, 23, 50), "info@lotuscombat.vn", "45.77.12.186"),
        failedSignIn(daysAgo(2, 23, 51), "info@lotuscombat.vn", "45.77.12.186"),
        failedSignIn(daysAgo(1, 6, 58), "diego.alvarez@lotus-combat.test", HOME_IP["u-diego-alvarez"]),
        signIn(daysAgo(1, 7, 0), "u-diego-alvarez"),
        signIn(pastToday(6, 40), THU, HOME_IP[THU]),
        signIn(pastToday(7, 25), RAFAEL),
        signIn(pastToday(7, 58), NORA),
        signIn(minutesAfter(videoById("v-minh-bag-today").uploadedAt, -4), MINH, GYM_TABLET_IP),
    ];
}

/* ─── Video & AI ─── */

function videoLabel(video: Video, suffix: string): string {
    return `${fighterName(video.fighterId)} — ${typeLabel(video.trainingType)} ${suffix}`;
}

const REVIEW_ACTIONS: Record<ReviewDecision, string> = {
    confirmed: "ai_finding.confirm",
    corrected: "ai_finding.correct",
    rejected: "ai_finding.reject",
};

/** One entry per review decision the coach made on an analysis' findings and detections. */
function findingReviewAudit(analysis: AIAnalysis, reviewerId: string, reviewedAt: string): AuditSeed[] {
    const video = videoById(analysis.videoId);
    const byReviewer = (review: AIFeedback | null): review is AIFeedback => review !== null && review.reviewerId === reviewerId;
    const decisions: ReviewDecision[] = ["confirmed", "corrected", "rejected"];
    return decisions.flatMap((decision, index) => {
        const findings = analysis.findings.map((f) => f.review).filter(byReviewer).filter((r) => r.decision === decision);
        const detections = analysis.detections.map((d) => d.review).filter(byReviewer).filter((r) => r.decision === decision);
        if (findings.length + detections.length === 0) return [];
        const counts: string[] = [];
        if (findings.length > 0) counts.push(pluralize(findings.length, "finding"));
        if (detections.length > 0) counts.push(pluralize(detections.length, "detection"));
        const example = [...findings, ...detections].find((r) => r.correctedLabel)?.correctedLabel;
        return [
            audit(
                minutesAfter(reviewedAt, index - decisions.length),
                reviewerId,
                REVIEW_ACTIONS[decision],
                "ai_finding",
                analysis.id,
                videoLabel(video, "analysis"),
                `${counts.join(" and ")} ${REVIEW_DECISION_LABELS[decision].toLowerCase()}${example ? ` (e.g. “${example}”)` : ""}`,
            ),
        ];
    });
}

function aiAudit(): AuditSeed[] {
    const entries: AuditSeed[] = [];

    for (const video of mockVideos) {
        if (video.uploadedAt < since(ROUTINE_LOOKBACK_DAYS.uploads)) continue;
        const uploader = userById(video.uploadedById);
        const atGym = uploader.role === "fighter" && video.sessionId !== null;
        entries.push(
            audit(video.uploadedAt, uploader.id, "video.upload", "video", video.id, videoLabel(video, "video"), `${video.fileName} · ${formatFileSize(video.fileSizeMb)}`, {
                ip: atGym ? GYM_TABLET_IP : undefined,
            }),
        );
    }

    for (const job of mockAIJobs) {
        if (job.status !== "failed" || job.queuedAt < AUDIT_WINDOW_START) continue;
        const label = videoLabel(videoById(job.videoId), "AI job");
        const attempts = job.attempts > 1 ? ` (${job.attempts} attempts)` : "";
        entries.push(audit(job.finishedAt ?? job.queuedAt, null, "ai_job.fail", "ai_job", job.id, label, `${job.errorCode} — ${job.errorMessage}${attempts}`, { status: "failure" }));
        const retry = mockAIJobs.find((j) => j.videoId === job.videoId && j.queuedAt > job.queuedAt);
        if (retry) {
            const quang = userById(QUANG);
            const actor = quang.lastActiveAt && retry.queuedAt <= quang.lastActiveAt ? QUANG : NORA;
            entries.push(audit(retry.queuedAt, actor, "ai_job.retry", "ai_job", retry.id, label, `Re-queued after ${job.errorCode} on ${job.id}`));
        }
    }

    for (const analysis of mockAIAnalyses) {
        const review = analysis.coachReview;
        if (!review || review.reviewedAt < since(ROUTINE_LOOKBACK_DAYS.coachReviews)) continue;
        if (review.reviewedAt >= since(ROUTINE_LOOKBACK_DAYS.findingReviews)) {
            entries.push(...findingReviewAudit(analysis, review.reviewerId, review.reviewedAt));
        }
        entries.push(
            audit(review.reviewedAt, review.reviewerId, "ai_analysis.coach_review", "video", analysis.videoId, videoLabel(videoById(analysis.videoId), "analysis"), `Rating ${review.rating}/5`),
        );
    }

    for (const alert of mockAbnormalMovementAlerts) {
        const review = alert.doctorReview;
        if (!review || review.reviewedAt < AUDIT_WINDOW_START) continue;
        const decision = review.decision === "follow_up" ? "Follow-up" : review.decision === "acknowledged" ? "Acknowledged" : "Dismissed";
        entries.push(
            audit(
                review.reviewedAt,
                review.reviewerId,
                "ai_alert.review",
                "ai_alert",
                alert.id,
                `${fighterName(alert.fighterId)} — AI movement observation`,
                `Decision: ${decision}${alert.linkedInjuryId ? " · linked to injury record" : ""}`,
            ),
        );
    }
    return entries;
}

/* ─── Sports medicine ─── */

function medicalAudit(): AuditSeed[] {
    const entries: AuditSeed[] = [];

    for (const injury of mockInjuries) {
        if (injury.occurredAt < AUDIT_WINDOW_START) continue;
        const doctor = staffUserId(injury.recordedById);
        const label = `${fighterName(injury.fighterId)} — Injury record`;
        entries.push(audit(minutesAfter(injury.occurredAt, 45), doctor, "injury.create", "injury", injury.id, label, "Suspected injury recorded"));
        entries.push(audit(injury.diagnosedAt, doctor, "injury.update", "injury", injury.id, label, "Diagnosis confirmed"));
    }

    for (const exam of mockMedicalExaminations) {
        if (exam.date < since(ROUTINE_LOOKBACK_DAYS.examinations) || exam.date >= TODAY_START) continue;
        // Written up after the visit, and always before a clearance issued from it.
        const clearance = mockMedicalClearances.find((c) => c.examinationId === exam.id);
        const writtenUp = minutesAfter(exam.date, 40);
        entries.push(
            audit(
                clearance && clearance.issuedAt < writtenUp ? minutesAfter(clearance.issuedAt, -5) : writtenUp,
                staffUserId(exam.doctorId),
                "examination.create",
                "examination",
                exam.id,
                `${fighterName(exam.fighterId)} — Examination`,
                `Outcome: ${EXAMINATION_OUTCOME_LABELS[exam.outcome]}`,
            ),
        );
    }

    for (const treatment of mockTreatments) {
        if (treatment.startDate < since(ROUTINE_LOOKBACK_DAYS.treatments) || treatment.startDate >= TODAY_START) continue;
        const provider = mockUsers.find((u) => u.name === treatment.providerName);
        const recorder = staffUserId(record(mockInjuries, treatment.injuryId, "injury").recordedById);
        entries.push(audit(treatment.startDate, provider?.id ?? recorder, "treatment.create", "treatment", treatment.id, `${fighterName(treatment.fighterId)} — Treatment`));
    }

    for (const clearance of mockMedicalClearances) {
        const doctor = staffUserId(clearance.doctorId);
        const label = `${fighterName(clearance.fighterId)} — Medical Clearance`;
        if (clearance.issuedAt >= AUDIT_WINDOW_START) {
            const until = clearance.validUntil ? ` · valid until ${formatDate(clearance.validUntil)}` : "";
            entries.push(audit(clearance.issuedAt, doctor, "clearance.grant", "clearance", clearance.id, label, `Level: ${CLEARANCE_LEVEL_LABELS[clearance.level]}${until}`));
        }
        if (clearance.revokedAt && clearance.revokedAt >= AUDIT_WINDOW_START) {
            entries.push(audit(clearance.revokedAt, doctor, "clearance.revoke", "clearance", clearance.id, label, `Revoked · previous level: ${CLEARANCE_LEVEL_LABELS[clearance.level]}`));
        }
    }

    for (const plan of mockRecoveryPlans) {
        const doctor = staffUserId(plan.doctorId);
        const fighter = fighterById(plan.fighterId);
        const athlete = userById(fighter.userId);
        const label = `${fighter.name} — Recovery plan`;
        if (plan.startDate >= AUDIT_WINDOW_START) entries.push(audit(plan.startDate, doctor, "recovery_plan.create", "recovery_plan", plan.id, label));
        for (const checkIn of plan.checkIns) {
            if (checkIn.date < since(ROUTINE_LOOKBACK_DAYS.checkIns) || checkIn.date >= TODAY_START) continue;
            // Logged by the fighter from the app, or by the doctor at the clinic when the fighter hasn't been online.
            const byFighter = athlete.lastActiveAt !== null && checkIn.date <= athlete.lastActiveAt;
            entries.push(audit(checkIn.date, byFighter ? athlete.id : doctor, "recovery_plan.check_in", "recovery_plan", plan.id, label));
        }
    }
    return entries;
}

/* ─── Training ─── */

/** Registry sessions whose results appear in the trail. */
const RESULT_SESSION_IDS = [
    "s-lucas-sparring-24d",
    "s-marcus-bag-11d",
    "s-kenji-bag-9d",
    "s-diego-sparring-6d",
    "s-linh-bag-5d",
    "s-aigerim-pads-3d",
    "s-minh-pads-2d",
    "s-emma-sparring-1d",
    "s-minh-bag-today",
];

function trainingAudit(): AuditSeed[] {
    const entries: AuditSeed[] = [];

    for (const plan of mockTrainingPlans) {
        const coach = staffUserId(plan.coachId);
        const label = `${fighterName(plan.fighterId)} — ${plan.title}`;
        if (plan.createdAt >= AUDIT_WINDOW_START) {
            entries.push(audit(plan.createdAt, coach, "training_plan.create", "training_plan", plan.id, label, plan.status === "draft" ? "Saved as draft" : null));
        }
        if (plan.updatedAt >= since(ROUTINE_LOOKBACK_DAYS.planUpdates) && plan.updatedAt !== plan.createdAt) {
            const details = plan.status === "archived" ? "Status: Archived" : plan.status === "draft" ? "Draft updated" : "Plan details updated";
            entries.push(audit(plan.updatedAt, coach, "training_plan.update", "training_plan", plan.id, label, details));
        }
    }

    for (const id of RESULT_SESSION_IDS) {
        const session = sessionById(id);
        if (!session.result) continue;
        entries.push(
            audit(
                minutesAfter(session.result.completedAt, 5),
                staffUserId(session.coachId),
                "training_session.record_result",
                "training_session",
                session.id,
                `${fighterName(session.fighterId)} — ${typeLabel(session.type)} session`,
                `RPE ${session.result.rpe} · ${pluralize(session.result.roundsCompleted, "round")} · coach rating ${session.result.coachRating}/5`,
            ),
        );
    }

    for (const fighter of mockFighters) {
        const { sessions, cancelledAt } = medicalCancellations(fighter.id);
        sessions.forEach((session, index) => {
            entries.push(
                audit(
                    minutesAfter(cancelledAt, index),
                    staffUserId(fighter.primaryCoachId),
                    "training_session.cancel",
                    "training_session",
                    session.id,
                    `${fighter.name} — ${typeLabel(session.type)} session`,
                    `Reason: ${session.cancellationReason}`,
                ),
            );
        });
    }
    return entries;
}

/* ─── Routine sign-ins ─── */

/** Days between sign-ins and the local hours each role usually signs in. */
const SIGN_IN_HABITS: Record<Role, { gapDays: [number, number]; hours: [number, number]; officeShare: number }> = {
    fighter: { gapDays: [20, 30], hours: [6, 20], officeShare: 0 },
    coach: { gapDays: [14, 20], hours: [6, 7], officeShare: 0.8 },
    doctor: { gapDays: [14, 20], hours: [7, 8], officeShare: 0.7 },
    admin: { gapDays: [14, 20], hours: [7, 8], officeShare: 0.85 },
};

/** Never before an account existed or after its last activity. */
function routineSignIns(): AuditSeed[] {
    const random = createRandom("platform:sign-ins");
    const entries: AuditSeed[] = [];
    for (const user of mockUsers) {
        if (user.status !== "active" || user.lastActiveAt === null) continue;
        const habits = SIGN_IN_HABITS[user.role];
        for (let day = 30 - random.int(0, 4); day >= 0; day -= random.int(...habits.gapDays)) {
            const hour = day === 0 ? 6 : random.int(...habits.hours);
            const at = clampPastToday(daysAgo(day, hour, random.int(0, 59)));
            if (at < user.createdAt || at > user.lastActiveAt) continue;
            const atOffice = OFFICE_IP[user.id] !== undefined && random.chance(habits.officeShare);
            entries.push(signIn(at, user.id, atOffice ? OFFICE_IP[user.id] : HOME_IP[user.id]));
        }
    }
    return entries;
}

export const mockAuditLogs: AuditLog[] = [...adminAudit(), ...securityAudit(), ...aiAudit(), ...medicalAudit(), ...trainingAudit(), ...routineSignIns()]
    .filter((entry) => entry.timestamp >= AUDIT_WINDOW_START)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((entry, index) => ({ id: `log-${index + 1}`, ...entry }))
    .reverse();
