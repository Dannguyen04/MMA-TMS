import type { SystemSettings } from "./types";

/**
 * Settings the interface runs with while the backend has no settings endpoint. These are configuration defaults,
 * not user data; the demo seeds its editable settings from them.
 */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
    organizationName: "MMA-TMS",
    timezone: "Asia/Ho_Chi_Minh",
    sessionTimeoutMin: 480,
    requireMfa: false,
    videoMaxSizeMb: 500,
    videoRetentionDays: 365,
    allowedVideoFormats: ["mp4", "mov", "webm"],
    aiConfidenceThreshold: 0.35,
    aiLowConfidenceThreshold: 0.6,
    abnormalMovementAlertsEnabled: true,
    notifyDoctorOnAlert: true,
    clearanceExpiryWarningDays: 14,
};
