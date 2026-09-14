import type { Role } from "@/lib/domain/types";

/** Route helpers. Keep every hardcoded path here so URLs can change in one place. */

export const ROLE_BASE_PATH: Record<Role, string> = {
    fighter: "/fighter",
    coach: "/coach",
    doctor: "/doctor",
    admin: "/admin",
};

export function dashboardPath(role: Role): string {
    return `${ROLE_BASE_PATH[role]}/dashboard`;
}

/** Whether a path belongs to a role-restricted area and, if so, which role. */
export function roleForPath(pathname: string): Role | null {
    const segment = pathname.split("/")[1];
    return (Object.keys(ROLE_BASE_PATH) as Role[]).find((role) => ROLE_BASE_PATH[role] === `/${segment}`) ?? null;
}

export const routes = {
    login: "/login",
    forgotPassword: "/forgot-password",
    notifications: "/notifications",
    profile: "/profile",
    settings: "/settings",

    fighter: {
        dashboard: "/fighter/dashboard",
        schedule: "/fighter/schedule",
        training: "/fighter/training",
        plan: (planId: string) => `/fighter/training/plans/${planId}`,
        session: (sessionId: string) => `/fighter/training/sessions/${sessionId}`,
        history: "/fighter/training/history",
        videos: "/fighter/videos",
        uploadVideo: "/fighter/videos/upload",
        liveCheck: "/fighter/videos/live",
        video: (videoId: string) => `/fighter/videos/${videoId}`,
        performance: "/fighter/performance",
        technique: (technique: string) => `/fighter/performance/${technique}`,
        goals: "/fighter/goals",
        health: "/fighter/health",
        medicalHistory: "/fighter/health/history",
        injury: (injuryId: string) => `/fighter/health/injuries/${injuryId}`,
    },

    coach: {
        dashboard: "/coach/dashboard",
        fighters: "/coach/fighters",
        fighter: (fighterId: string) => `/coach/fighters/${fighterId}`,
        fighterPerformance: (fighterId: string) => `/coach/fighters/${fighterId}/performance`,
        fighterTraining: (fighterId: string) => `/coach/fighters/${fighterId}/training`,
        fighterVideos: (fighterId: string) => `/coach/fighters/${fighterId}/videos`,
        fighterGoals: (fighterId: string) => `/coach/fighters/${fighterId}/goals`,
        plans: "/coach/training-plans",
        newPlan: "/coach/training-plans/new",
        plan: (planId: string) => `/coach/training-plans/${planId}`,
        editPlan: (planId: string) => `/coach/training-plans/${planId}/edit`,
        sessions: "/coach/sessions",
        newSession: "/coach/sessions/new",
        session: (sessionId: string) => `/coach/sessions/${sessionId}`,
        editSession: (sessionId: string) => `/coach/sessions/${sessionId}/edit`,
        videoAnalysis: "/coach/video-analysis",
        uploadVideo: "/coach/video-analysis/upload",
        video: (videoId: string) => `/coach/video-analysis/${videoId}`,
        performance: "/coach/performance",
        goals: "/coach/goals",
        clearance: "/coach/medical-clearance",
    },

    doctor: {
        dashboard: "/doctor/dashboard",
        fighters: "/doctor/fighters",
        fighter: (fighterId: string) => `/doctor/fighters/${fighterId}`,
        records: "/doctor/medical-records",
        examinations: "/doctor/examinations",
        newExamination: "/doctor/examinations/new",
        examination: (examId: string) => `/doctor/examinations/${examId}`,
        injuries: "/doctor/injuries",
        newInjury: "/doctor/injuries/new",
        injury: (injuryId: string) => `/doctor/injuries/${injuryId}`,
        recovery: "/doctor/recovery",
        recoveryPlan: (planId: string) => `/doctor/recovery/${planId}`,
        clearance: "/doctor/medical-clearance",
        grantClearance: "/doctor/medical-clearance/new",
        aiAlerts: "/doctor/ai-alerts",
        aiAlert: (alertId: string) => `/doctor/ai-alerts/${alertId}`,
    },

    admin: {
        dashboard: "/admin/dashboard",
        users: "/admin/users",
        newUser: "/admin/users/new",
        user: (userId: string) => `/admin/users/${userId}`,
        roles: "/admin/roles",
        videos: "/admin/videos",
        aiJobs: "/admin/ai-jobs",
        aiJob: (jobId: string) => `/admin/ai-jobs/${jobId}`,
        aiModels: "/admin/ai-models",
        aiModel: (modelId: string) => `/admin/ai-models/${modelId}`,
        auditLogs: "/admin/audit-logs",
        notifications: "/admin/notifications",
        settings: "/admin/settings",
    },

    api: {
        aiJob: (jobId: string) => `/api/ai-jobs/${encodeURIComponent(jobId)}`,
    },
} as const;

/** Placeholder origin used only to resolve candidate paths; `.invalid` can never be a real host. */
const REDIRECT_BASE = "http://app.invalid";
/** Control characters (U+0000 to U+001F, U+007F) and backslashes. */
const UNSAFE_REDIRECT_CHARS = /[\u0000-\u001f\u007f\\]/;
/** Encoded slashes and backslashes: no app route uses them, and some proxies decode them into `//`. */
const ENCODED_SEPARATORS = /%2f|%5c/i;

/**
 * Normalizes a ?next= value to a same-origin path, or null (prevents open redirects).
 * Browsers strip tabs and newlines and treat backslashes as slashes, so `/\t/evil.example`
 * would otherwise resolve to another host — those characters are rejected outright.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
    if (!value || !value.startsWith("/") || UNSAFE_REDIRECT_CHARS.test(value)) return null;
    let url: URL;
    try {
        url = new URL(value, REDIRECT_BASE);
    } catch {
        return null;
    }
    if (url.origin !== REDIRECT_BASE) return null;
    // Dot segments can collapse to a protocol-relative path (`/.//evil.example` → `//evil.example`).
    if (url.pathname.startsWith("//") || ENCODED_SEPARATORS.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
}
