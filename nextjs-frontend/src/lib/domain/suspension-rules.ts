export type { SuspensionReason } from "./types";
import { SESSION_TYPES, type SessionType } from "@/lib/domain/medical-contract";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { sessionTypeFor } from "./training-contract";
import type {
    AffectedPlan,
    AffectedSession,
    ConflictProposal,
    GradedReturn,
    NotReadyReason,
    ReadinessActiveBout,
    ReadinessRow,
    ReadinessStatus,
    ReadinessSuspensionSummary,
    ReadinessWeightFeasibility,
    SuspensionReason,
    SuspensionStatus,
    TrainingPhase,
    TrainingType,
} from "@/lib/domain/types";
import { blockedTypesForMaxTier, maxAllowedTier, tierOfTrainingType } from "./intensity-tiers";
import { calculateSnapshotAcuteLimit, calculateWeightFeasibility } from "./bout-rules";

/* ─── Academy Date Helpers (UTC+7) ────────────────────────────────────────── */

export const ACADEMY_UTC_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

export const REHAB_TRIGGER_SUSPENSION_REASONS: readonly SuspensionReason[] = [
    "KO",
    "TKO",
    "MEDICAL",
];

export const ACTIVE_BOUT_STATUSES = [
    "CAMP",
    "FIGHT_WEEK",
    "WEIGHED_IN",
] as const;

/** Academy calendar date (YYYY-MM-DD) of an instant in UTC+7. */
export function academyDateOf(instant: Date | string = new Date()): string {
    const d = instant instanceof Date ? instant : new Date(instant);
    return new Date(d.getTime() + ACADEMY_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysToDate(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
        .toISOString()
        .slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenDates(from: string, to: string): number {
    return Math.round(
        (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS,
    );
}

/** Inclusive end date for a suspension of `days` starting on `startsOn` (day 1 = `startsOn`). */
export function endsOnFor(startsOn: string, days: number): string {
    return addDaysToDate(startsOn, days - 1);
}

/* ─── Suspension State Interfaces ─────────────────────────────────────────── */

export interface SuspensionStateInput {
    startsOn: string;
    endsOn: string;
    requiresClearance: boolean;
    clearedAt: Date | string | null;
}

export interface SuspensionGradedReturnInput extends SuspensionStateInput {
    reason?: SuspensionReason | undefined;
}

export interface ConflictSessionInput {
    id: string;
    fighterId?: string | undefined;
    scheduledAt: Date | string;
    status: string;
    deletedAt?: Date | string | null | undefined;
    sessionType?: SessionType | null | undefined;
    trainingType?: TrainingType | null | undefined;
    type?: string | null | undefined;
}

export interface ConflictSuspensionInput extends SuspensionStateInput {
    id?: string | undefined;
    fighterId?: string | undefined;
    blockedSessionTypes: readonly SessionType[];
    maxAllowedTier?: number | null | undefined;
    deletedAt?: Date | string | null | undefined;
}

/* ─── Pure Suspension Functions ───────────────────────────────────────────── */

/**
 * Computes the suspension status on academy date `d` (YYYY-MM-DD).
 * - ENDED: cleared, or `d > endsOn` without `requiresClearance`
 * - UPCOMING: `d < startsOn`, not cleared
 * - ACTIVE: `startsOn <= d <= endsOn`, not cleared
 * - AWAITING_CLEARANCE: `d > endsOn`, `requiresClearance`, not cleared (begins on `endsOn + 1`)
 */
export function suspensionStatusOn(
    suspension: SuspensionStateInput,
    d: string,
): SuspensionStatus {
    if (suspension.clearedAt !== null) return "ENDED";
    if (d < suspension.startsOn) return "UPCOMING";
    if (d <= suspension.endsOn) return "ACTIVE";
    return suspension.requiresClearance ? "AWAITING_CLEARANCE" : "ENDED";
}

/**
 * Whether the suspension is in force on academy date `d` (YYYY-MM-DD):
 * `cleared_at IS NULL AND starts_on <= d AND (d <= ends_on OR requires_clearance)`
 */
export function isInForceOn(
    suspension: SuspensionStateInput,
    d: string,
): boolean {
    return (
        suspension.clearedAt === null &&
        suspension.startsOn <= d &&
        (d <= suspension.endsOn || suspension.requiresClearance)
    );
}

/**
 * Computes the graded-return state `{ ceiling, fullReturnOn }` for a head-injury
 * (`KO` / `TKO`) suspension on academy date `d` (YYYY-MM-DD), or `null` when not
 * in the graded-return window.
 */
export function gradedReturnFor(
    suspension: SuspensionGradedReturnInput,
    d: string,
): GradedReturn | null {
    if (suspension.reason !== "KO" && suspension.reason !== "TKO") {
        return null;
    }
    if (
        isInForceOn(suspension, d) ||
        suspensionStatusOn(suspension, d) !== "ENDED"
    ) {
        return null;
    }

    let startDate: string;
    if (suspension.requiresClearance) {
        if (suspension.clearedAt === null || suspension.clearedAt === undefined) {
            return null;
        }
        const clearedInstant =
            suspension.clearedAt instanceof Date
                ? suspension.clearedAt
                : new Date(suspension.clearedAt);
        startDate = academyDateOf(clearedInstant);
    } else {
        startDate = addDaysToDate(suspension.endsOn, 1);
    }

    const fullReturnOn = addDaysToDate(startDate, 2);
    if (d === startDate) {
        return { ceiling: 3, fullReturnOn };
    }
    if (d === addDaysToDate(startDate, 1)) {
        return { ceiling: 4, fullReturnOn };
    }
    return null;
}

export function gradedReturnCeiling(
    suspension: SuspensionGradedReturnInput,
    d: string,
): 3 | 4 | null {
    return gradedReturnFor(suspension, d)?.ceiling ?? null;
}

export type RequiresClearanceResolution =
    | { ok: true; requiresClearance: boolean }
    | {
          ok: false;
          reason: "REQUIRES_CLEARANCE_MANDATORY" | "REQUIRES_CLEARANCE_FORBIDDEN";
      };

/**
 * Resolves `requiresClearance` from the suspension reason and caller request:
 * - KO and TKO: ALWAYS true and cannot be turned off (requesting false is invalid)
 * - MEDICAL: defaults true (request may override)
 * - DQ and MANDATORY_REST: ALWAYS false (requesting true is invalid)
 * - OTHER: follows the request, default false
 */
export function deriveRequiresClearance(
    reason: SuspensionReason,
    requested?: boolean,
): RequiresClearanceResolution {
    switch (reason) {
        case "KO":
        case "TKO":
            if (requested === false) {
                return { ok: false, reason: "REQUIRES_CLEARANCE_MANDATORY" };
            }
            return { ok: true, requiresClearance: true };
        case "DQ":
        case "MANDATORY_REST":
            if (requested === true) {
                return { ok: false, reason: "REQUIRES_CLEARANCE_FORBIDDEN" };
            }
            return { ok: true, requiresClearance: false };
        case "MEDICAL":
            return { ok: true, requiresClearance: requested ?? true };
        case "OTHER":
            return { ok: true, requiresClearance: requested ?? false };
    }
}

/* ─── Conflict Evaluation Logic ───────────────────────────────────────────── */

export function isSessionBlockedBySuspension(
    session: {
        scheduledAt: Date | string;
        sessionType?: SessionType | null | undefined;
        trainingType?: TrainingType | null | undefined;
        type?: string | null | undefined;
    },
    suspension: {
        startsOn: string;
        endsOn: string;
        requiresClearance: boolean;
        clearedAt: Date | string | null;
        blockedSessionTypes: readonly SessionType[];
        maxAllowedTier?: number | null | undefined;
    },
): boolean {
    const sessionDate = academyDateOf(session.scheduledAt);
    if (!isInForceOn(suspension, sessionDate)) {
        return false;
    }

    const rawType = (session.trainingType ?? session.sessionType ?? session.type) as string | undefined;
    if (rawType === "technical_drilling") {
        // technical_drilling: không có mã backend tương đương, thuộc bậc 3.
        // Ở demo, buổi technical_drilling bị chặn khi bậc của nó (3) lớn hơn maxAllowedTier của đình chỉ.
        const allowedTier =
            suspension.maxAllowedTier ??
            maxAllowedTier([...suspension.blockedSessionTypes]);
        return tierOfTrainingType("technical_drilling") > allowedTier;
    }

    let sessionType: SessionType | undefined = session.sessionType ?? undefined;
    if (!sessionType && rawType) {
        sessionType = (sessionTypeFor(rawType as TrainingType) ?? undefined) as SessionType | undefined;
        if (!sessionType && SESSION_TYPES.includes(rawType.toUpperCase() as SessionType)) {
            sessionType = rawType.toUpperCase() as SessionType;
        }
    }
    return sessionType ? suspension.blockedSessionTypes.includes(sessionType) : false;
}

export function filterProposalsForSuspension(
    proposals: ConflictProposal[],
    suspension: {
        startsOn: string;
        endsOn: string;
        requiresClearance: boolean;
        clearedAt: Date | string | null;
        blockedSessionTypes: readonly SessionType[];
        maxAllowedTier?: number | null | undefined;
    },
    sessions: Array<{
        id: string;
        scheduledAt: Date | string;
        sessionType?: SessionType | null | undefined;
        trainingType?: TrainingType | null | undefined;
        type?: string | null | undefined;
    }>,
): ConflictProposal[] {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    return proposals.filter((proposal) => {
        const session = sessionById.get(proposal.sessionId);
        if (!session) return false;
        return isSessionBlockedBySuspension(session, suspension);
    });
}

/**
 * Backend Rule R28: for every `SCHEDULED` session of the fighter that falls
 * inside the suspension period and has a blocked type:
 * - If any in-force suspension blocking that session has `requiresClearance = true`:
 *   propose `cancel`.
 * - Otherwise: propose `pending`.
 */
export function planConflicts(
    sessions: readonly ConflictSessionInput[],
    suspensions: readonly ConflictSuspensionInput[],
): ConflictProposal[] {
    const activeSuspensions = suspensions.filter(
        (s) => s.deletedAt === null || s.deletedAt === undefined,
    );
    const proposals: ConflictProposal[] = [];

    for (const session of sessions) {
        if (session.deletedAt !== null && session.deletedAt !== undefined) {
            continue;
        }
        if (session.status !== "SCHEDULED" && session.status !== "scheduled") {
            continue;
        }

        const blockingOnDate = activeSuspensions.filter(
            (s) =>
                (!s.fighterId || !session.fighterId || s.fighterId === session.fighterId) &&
                isSessionBlockedBySuspension(session, s),
        );
        if (blockingOnDate.length === 0) {
            continue;
        }

        if (blockingOnDate.some((s) => s.requiresClearance)) {
            proposals.push({
                sessionId: session.id,
                action: "cancel",
            });
        } else {
            proposals.push({
                sessionId: session.id,
                action: "pending",
            });
        }
    }

    return proposals;
}

/* ─── Readiness Classification Logic ──────────────────────────────────────── */

export interface ReadinessSuspensionInput extends SuspensionStateInput {
    reason?: SuspensionReason | undefined;
    blockedSessionTypes: readonly SessionType[];
    deletedAt?: Date | string | null;
}

export interface ReadinessBoutInput {
    id: string;
    eventName: string;
    status: string;
    boutAt: Date | string;
}

export interface ReadinessRulesetInput {
    acuteWindowDays: number;
    acuteLossLimitPctLong: number | string;
    acuteLossLimitPctShort?: number | string;
}

export interface ClassifyReadinessInput {
    fighterId: string;
    fighterName: string;
    today: string;
    suspensions?: readonly ReadinessSuspensionInput[];
    activeBout?: ReadinessBoutInput | null;
    latestWeight?: { kg: number; date: string } | null;
    boutOn?: string;
    weightLimitKg?: number;
    ruleset?: ReadinessRulesetInput;
}

/**
 * Pure mirror of backend classifyReadiness (nestjs-api/src/bouts/bouts.model.ts)
 */
export function classifyReadiness(input: ClassifyReadinessInput): ReadinessRow {
    const activeSuspensions = (input.suspensions ?? []).filter(
        (s) => s.deletedAt === null || s.deletedAt === undefined,
    );
    const inForceToday = activeSuspensions.filter((s) =>
        isInForceOn(s, input.today),
    );
    const hasActiveSuspension = inForceToday.some(
        (s) => suspensionStatusOn(s, input.today) === "ACTIVE",
    );
    const hasAwaitingClearance = inForceToday.some(
        (s) => suspensionStatusOn(s, input.today) === "AWAITING_CLEARANCE",
    );
    const gradedReturnsToday = activeSuspensions
        .map((s) => ({
            suspension: s,
            gradedReturn: gradedReturnFor(s, input.today),
        }))
        .filter(
            (item): item is { suspension: ReadinessSuspensionInput; gradedReturn: GradedReturn } =>
                item.gradedReturn !== null,
        );

    let gradedReturn: GradedReturn | null = null;
    if (gradedReturnsToday.length > 0) {
        let ceiling = gradedReturnsToday[0]!.gradedReturn.ceiling;
        let fullReturnOnVal = gradedReturnsToday[0]!.gradedReturn.fullReturnOn;
        for (const item of gradedReturnsToday) {
            if (item.gradedReturn.ceiling < ceiling) {
                ceiling = item.gradedReturn.ceiling;
            }
            if (item.gradedReturn.fullReturnOn > fullReturnOnVal) {
                fullReturnOnVal = item.gradedReturn.fullReturnOn;
            }
        }
        gradedReturn = { ceiling, fullReturnOn: fullReturnOnVal };
    }
    const fullReturnOn = gradedReturn ? gradedReturn.fullReturnOn : null;

    const rawBout = input.activeBout ?? null;
    const activeBout: ReadinessActiveBout | null =
        rawBout && (ACTIVE_BOUT_STATUSES as readonly string[]).includes(rawBout.status)
            ? {
                  id: rawBout.id,
                  eventName: rawBout.eventName,
                  status: rawBout.status as ReadinessActiveBout["status"],
                  boutAt:
                      rawBout.boutAt instanceof Date
                          ? rawBout.boutAt.toISOString()
                          : rawBout.boutAt,
              }
            : null;

    let status: ReadinessStatus;
    if (hasActiveSuspension || (gradedReturn !== null && !hasAwaitingClearance)) {
        status = "SUSPENDED";
    } else if (hasAwaitingClearance) {
        status = "AWAITING_CLEARANCE";
    } else if (activeBout !== null) {
        status = "IN_BOUT";
    } else {
        status = "READY";
    }

    let suspension: ReadinessSuspensionSummary | null = null;
    if (inForceToday.length > 0) {
        const isOpenEnded = (s: ReadinessSuspensionInput) =>
            s.requiresClearance && (s.clearedAt === null || s.clearedAt === undefined);

        const anyOpenEnded = inForceToday.some(isOpenEnded);

        let earliestStartsOn = inForceToday[0]!.startsOn;
        let latestEndsOn = inForceToday[0]!.endsOn;
        const blockedSessionTypes: SessionType[] = [];

        for (const s of inForceToday) {
            if (s.startsOn < earliestStartsOn) earliestStartsOn = s.startsOn;
            if (s.endsOn > latestEndsOn) latestEndsOn = s.endsOn;
            for (const t of s.blockedSessionTypes) {
                if (!blockedSessionTypes.includes(t)) {
                    blockedSessionTypes.push(t);
                }
            }
        }

        const allowedSessionTypes = SESSION_TYPES.filter(
            (t) => !blockedSessionTypes.includes(t),
        );
        const expectedResumeOn = anyOpenEnded
            ? null
            : addDaysToDate(latestEndsOn, 1);

        suspension = {
            startsOn: earliestStartsOn,
            endsOn: latestEndsOn,
            blockedSessionTypes,
            allowedSessionTypes,
            expectedResumeOn,
            ...(gradedReturn !== null
                ? { fullReturnOn: gradedReturn.fullReturnOn, gradedReturn }
                : {}),
        };
    } else if (gradedReturn !== null) {
        let earliestStartsOn = gradedReturnsToday[0]!.suspension.startsOn;
        let latestEndsOn = gradedReturnsToday[0]!.suspension.endsOn;
        for (const { suspension: s } of gradedReturnsToday) {
            if (s.startsOn < earliestStartsOn) earliestStartsOn = s.startsOn;
            if (s.endsOn > latestEndsOn) latestEndsOn = s.endsOn;
        }
        const blockedSessionTypes = blockedTypesForMaxTier(gradedReturn.ceiling);
        const allowedSessionTypes = SESSION_TYPES.filter(
            (t) => !blockedSessionTypes.includes(t),
        );
        suspension = {
            startsOn: earliestStartsOn,
            endsOn: latestEndsOn,
            blockedSessionTypes,
            allowedSessionTypes,
            expectedResumeOn: gradedReturn.fullReturnOn,
            fullReturnOn: gradedReturn.fullReturnOn,
            gradedReturn,
        };
    }

    const latestWeightKg = input.latestWeight ? input.latestWeight.kg : null;
    const latestWeightOn = input.latestWeight ? input.latestWeight.date : null;

    let ready = status === "READY";
    let notReadyReasons: NotReadyReason[] | undefined;

    if (input.boutOn !== undefined) {
        notReadyReasons = [];
        if (
            activeSuspensions.some(
                (s) =>
                    isInForceOn(s, input.boutOn!) ||
                    gradedReturnCeiling(s, input.boutOn!) !== null,
            )
        ) {
            notReadyReasons.push("SUSPENDED_PAST_BOUT_DATE");
        }
        if (activeBout !== null) {
            notReadyReasons.push("ACTIVE_BOUT");
        }
        ready = notReadyReasons.length === 0;
    }

    let feasibility: ReadinessWeightFeasibility | undefined;
    if (
        input.weightLimitKg !== undefined &&
        input.ruleset !== undefined &&
        input.boutOn !== undefined
    ) {
        const acuteLossLimitPct = calculateSnapshotAcuteLimit(
            new Date(0),
            new Date(24 * 3600 * 1000),
            {
                acuteLossLimitPctLong: Number(input.ruleset.acuteLossLimitPctLong),
                acuteLossLimitPctShort: Number(
                    input.ruleset.acuteLossLimitPctShort ?? input.ruleset.acuteLossLimitPctLong,
                ),
            },
        );
        const result = calculateWeightFeasibility({
            limitKg: input.weightLimitKg,
            acuteLossLimitPct,
            acuteWindowDays: input.ruleset.acuteWindowDays,
            weighInAt: input.boutOn,
            latest: input.latestWeight
                ? { date: input.latestWeight.date, kg: input.latestWeight.kg }
                : null,
            now: input.today,
        });
        feasibility = {
            status: result.status,
            remainingPct: result.remainingPct,
            latestKg: result.latestKg,
            latestOn: result.latestOn,
            daysToWeighIn: result.daysToWeighIn,
        };
    }

    return {
        fighterId: input.fighterId,
        fighterName: input.fighterName,
        ready,
        status,
        latestWeightKg,
        latestWeightOn,
        activeBout,
        suspension,
        fullReturnOn,
        gradedReturn,
        ...(notReadyReasons !== undefined ? { notReadyReasons } : {}),
        ...(feasibility !== undefined ? { feasibility } : {}),
    };
}

/**
 * Suy ra từ nhánh tập-lại-theo-bậc của backend, bouts.model.ts ~1388; backend không có cờ riêng.
 */
export function isGradedReturnOnly(row: ReadinessRow): boolean {
    if (
        row.status !== "SUSPENDED" ||
        !row.gradedReturn ||
        !row.suspension ||
        row.suspension.expectedResumeOn !== row.gradedReturn.fullReturnOn
    ) {
        return false;
    }

    const actual = new Set(row.suspension.blockedSessionTypes);
    const expected = new Set(blockedTypesForMaxTier(row.gradedReturn.ceiling));
    if (actual.size !== expected.size) {
        return false;
    }
    for (const item of expected) {
        if (!actual.has(item)) {
            return false;
        }
    }
    return true;
}

/**
 * Tính bậc cường độ cho phép và bậc hiệu lực của võ sĩ trên bảng sẵn sàng.
 * allowed: dựa trên các loại buổi bị đình chỉ hôm nay (mặc định 5 nếu không có đình chỉ).
 * effective: kết hợp allowed với trần lộ trình tập lại (gradedReturn.ceiling) nếu có.
 */
export function readinessMaxTier(row: ReadinessRow): { allowed: number; effective: number } {
    const allowed = isGradedReturnOnly(row)
        ? 5
        : row.suspension
          ? maxAllowedTier(row.suspension.blockedSessionTypes)
          : 5;
    const effective = row.gradedReturn ? Math.min(allowed, row.gradedReturn.ceiling) : allowed;
    return { allowed, effective };
}

/* ─── Auto-Apply Side Effects ─────────────────────────────────────────────── */

export interface ApplySideEffectsResult {
    affectedSessions: AffectedSession[];
    affectedPlans: AffectedPlan[];
}

export function applySuspensionSideEffects(
    created: {
        fighterId: string;
        reason: SuspensionReason;
        startsOn: string;
        endsOn: string;
        requiresClearance: boolean;
        clearedAt: Date | string | null;
        blockedSessionTypes: readonly SessionType[];
    },
    allSuspensions: Array<{
        fighterId: string;
        startsOn: string;
        endsOn: string;
        requiresClearance: boolean;
        clearedAt: Date | string | null;
        blockedSessionTypes: readonly SessionType[];
        deletedAt?: Date | string | null;
    }>,
    sessions: Array<{
        id: string;
        fighterId: string;
        scheduledAt: Date | string;
        status: string;
        sessionType?: SessionType;
        type?: string;
        cancellationReason?: string | null;
    }>,
    plans: Array<{
        id: string;
        fighterId: string;
        status: string;
        phase: string;
    }>,
): ApplySideEffectsResult {
    const fighterSessions = sessions.filter((s) => s.fighterId === created.fighterId);
    const sessionInputs: ConflictSessionInput[] = fighterSessions.map((s) => ({
        id: s.id,
        fighterId: s.fighterId,
        scheduledAt: s.scheduledAt,
        status: s.status,
        sessionType: s.sessionType ?? (s.type ? (sessionTypeFor(s.type as TrainingType) ?? undefined) : undefined),
        type: s.type,
    }));

    const allProposals = planConflicts(sessionInputs, allSuspensions);
    const createdProposals = filterProposalsForSuspension(
        allProposals,
        created,
        sessionInputs,
    );

    const affectedSessions: AffectedSession[] = [];
    const affectedPlans: AffectedPlan[] = [];
    const mutatedSessionIds = new Set<string>();

    for (const proposal of createdProposals) {
        const session = fighterSessions.find((s) => s.id === proposal.sessionId);
        if (!session || (session.status !== "SCHEDULED" && session.status !== "scheduled")) {
            continue;
        }
        if (proposal.action === "cancel") {
            session.status = "cancelled";
            session.cancellationReason = "Suspension in force";
            affectedSessions.push({ sessionId: session.id, action: "cancel" });
        } else {
            session.status = "pending";
            affectedSessions.push({ sessionId: session.id, action: "pending" });
        }
        mutatedSessionIds.add(session.id);
    }

    if (created.requiresClearance) {
        for (const session of fighterSessions) {
            if ((session.status === "PENDING" || session.status === "pending") && !mutatedSessionIds.has(session.id)) {
                    const sType = session.sessionType ?? (session.type ? (sessionTypeFor(session.type as TrainingType) ?? undefined) : undefined);
                    if (
                        isSessionBlockedBySuspension(
                            { scheduledAt: session.scheduledAt, sessionType: sType, type: session.type },
                            created,
                        )
                    ) {
                    session.status = "cancelled";
                    session.cancellationReason = "Suspension in force";
                    affectedSessions.push({ sessionId: session.id, action: "cancel" });
                    mutatedSessionIds.add(session.id);
                }
            }
        }
    }

    if (REHAB_TRIGGER_SUSPENSION_REASONS.includes(created.reason)) {
        for (const plan of plans) {
            if (plan.fighterId !== created.fighterId) continue;
            if (plan.status !== "ACTIVE" && plan.status !== "active") continue;
            if (plan.phase === "fight_camp" || plan.phase === "taper") {
                const fromPhase = plan.phase as TrainingPhase;
                plan.phase = "rehab";
                affectedPlans.push({ planId: plan.id, fromPhase, toPhase: "rehab" });
            }
        }
    }

    return { affectedSessions, affectedPlans };
}

/* ─── Blocking Suspension Helpers & Presentation ─────────────────────────── */

export interface GradedReturnInfo {
    ceiling: 3 | 4;
    fullReturnOn: string;
}

export interface TrainingBlockingSuspension {
    suspensionId?: string;
    reason: string;
    endsOn: string;
    requiresClearance: boolean;
    gradedReturn?: GradedReturnInfo | null;
    maxAllowedTier?: number | null;
}

export const SUSPENSION_REASON_MESSAGE_KEYS: Record<SuspensionReason, MessageKey> = {
    KO: "suspension.reason.KO",
    TKO: "suspension.reason.TKO",
    DQ: "suspension.reason.DQ",
    MANDATORY_REST: "suspension.reason.MANDATORY_REST",
    MEDICAL: "suspension.reason.MEDICAL",
    OTHER: "suspension.reason.OTHER",
};

export function isSuspensionReason(value: string): value is SuspensionReason {
    return Object.prototype.hasOwnProperty.call(SUSPENSION_REASON_MESSAGE_KEYS, value);
}

export function suspensionReasonLabel(rawReason: string, t?: Translator): string {
    const key = isSuspensionReason(rawReason)
        ? SUSPENSION_REASON_MESSAGE_KEYS[rawReason]
        : SUSPENSION_REASON_MESSAGE_KEYS.OTHER;
    const translator = t ?? createTranslator("en");
    return translator(key);
}

/**
 * When a fighter has multiple blocking suspensions, chooses which one to feature:
 * suspensions without graded return (active/blocking) take precedence over graded returns;
 * within the same group, the one with the latest endsOn is chosen.
 */
export function pickPrimarySuspension(suspensions: readonly TrainingBlockingSuspension[]): TrainingBlockingSuspension | null {
    if (suspensions.length === 0) return null;
    if (suspensions.length === 1) return suspensions[0];

    const sorted = [...suspensions].sort((a, b) => {
        const aHasGraded = Boolean(a.gradedReturn);
        const bHasGraded = Boolean(b.gradedReturn);
        if (aHasGraded !== bHasGraded) {
            return aHasGraded ? 1 : -1;
        }
        return b.endsOn.localeCompare(a.endsOn);
    });
    return sorted[0];
}

export function formatSuspensionMessage(suspension: TrainingBlockingSuspension, t?: Translator): string {
    const translator = t ?? createTranslator("en");
    const locale: Locale = translator.locale ?? "en";
    const reason = suspensionReasonLabel(suspension.reason, translator);

    if (suspension.gradedReturn) {
        const fullReturnOn = formatShortDate(suspension.gradedReturn.fullReturnOn, locale);
        return translator("training.error.suspensionGradedReturn", {
            reason,
            ceiling: suspension.gradedReturn.ceiling,
            fullReturnOn,
        });
    }

    const endsOn = formatShortDate(suspension.endsOn, locale);
    if (suspension.requiresClearance) {
        return translator("training.error.suspensionActiveRequiresClearance", { reason, endsOn });
    }
    return translator("training.error.suspensionActiveWithReason", { reason, endsOn });
}

export interface RescheduleDateSuggestion {
    suggestedDate: string | null;
    awaitingClearance: boolean;
}

/**
 * Suggests the earliest available date to reschedule a session blocked by suspensions:
 * - If any active suspension requires clearance and is uncleared -> cannot suggest date; awaitingClearance: true.
 * - Otherwise -> suggests endsOn + 1 (using the latest endsOn among blocking suspensions).
 */
export function suggestRescheduleDate(
    suspensions: readonly {
        endsOn: string;
        requiresClearance: boolean;
        clearedAt?: Date | string | null;
        startsOn?: string;
        deletedAt?: Date | string | null;
    }[],
): RescheduleDateSuggestion {
    const active = suspensions.filter((s) => s.deletedAt === null || s.deletedAt === undefined);
    if (active.length === 0) {
        return { suggestedDate: null, awaitingClearance: false };
    }
    const uncleared = active.filter((s) => s.requiresClearance && (s.clearedAt === null || s.clearedAt === undefined));
    if (uncleared.length > 0) {
        return { suggestedDate: null, awaitingClearance: true };
    }
    let maxEndsOn = active[0].endsOn;
    for (const s of active) {
        if (s.endsOn > maxEndsOn) {
            maxEndsOn = s.endsOn;
        }
    }
    return {
        suggestedDate: addDaysToDate(maxEndsOn, 1),
        awaitingClearance: false,
    };
}
