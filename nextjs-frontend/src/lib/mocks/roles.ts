import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission, RoleDefinition, SystemSettings } from "@/lib/domain/types";
import { ORGANIZATION_NAME } from "./people";

export const ALL_PERMISSIONS: { permission: Permission; label: string; group: string }[] = [
    { permission: "fighters:read", label: "View fighter profiles", group: "Fighters" },
    { permission: "fighters:write", label: "Edit fighter profiles", group: "Fighters" },
    { permission: "training:read", label: "View training plans & sessions", group: "Training" },
    { permission: "training:write", label: "Create and edit training plans & sessions", group: "Training" },
    { permission: "goals:write", label: "Set and update goals", group: "Training" },
    { permission: "videos:upload", label: "Upload training videos", group: "Video & AI" },
    { permission: "videos:manage", label: "Manage all videos", group: "Video & AI" },
    { permission: "ai_analysis:read", label: "View AI analysis", group: "Video & AI" },
    { permission: "ai_findings:review", label: "Confirm or correct AI findings", group: "Video & AI" },
    { permission: "ai_alerts:review", label: "Review abnormal movement alerts", group: "Video & AI" },
    { permission: "ai_jobs:manage", label: "Monitor and retry AI jobs", group: "Video & AI" },
    { permission: "ai_models:manage", label: "Manage AI models & thresholds", group: "Video & AI" },
    { permission: "medical:read_summary", label: "View health status & clearance summary", group: "Medical" },
    { permission: "medical:read", label: "View full medical records", group: "Medical" },
    { permission: "medical:write", label: "Record examinations, injuries & treatment", group: "Medical" },
    { permission: "medical:request_review", label: "Request a medical review", group: "Medical" },
    { permission: "clearance:manage", label: "Grant and revoke Medical Clearance", group: "Medical" },
    { permission: "users:manage", label: "Manage user accounts", group: "Administration" },
    { permission: "roles:manage", label: "Manage roles & permissions", group: "Administration" },
    { permission: "audit_logs:read", label: "View audit logs", group: "Administration" },
    { permission: "notifications:manage", label: "Send notification broadcasts", group: "Administration" },
    { permission: "settings:manage", label: "Change system settings", group: "Administration" },
];

export const mockRoleDefinitions: RoleDefinition[] = [
    {
        role: "fighter",
        label: "Fighter",
        description: "Athletes. See their own training, videos, performance and health.",
        permissions: [...ROLE_DEFAULT_PERMISSIONS.fighter],
    },
    {
        role: "coach",
        label: "Coach",
        description: "Plan training for assigned fighters, review AI analysis and track performance.",
        permissions: [...ROLE_DEFAULT_PERMISSIONS.coach],
    },
    {
        role: "doctor",
        label: "Sports doctor",
        description: "Manage the health, injuries, recovery and Medical Clearance of assigned fighters.",
        permissions: [...ROLE_DEFAULT_PERMISSIONS.doctor],
    },
    {
        role: "admin",
        label: "Administrator",
        description: "Operate the platform: accounts, AI pipeline, audit and configuration. No clinical access.",
        permissions: [...ROLE_DEFAULT_PERMISSIONS.admin],
    },
];

export const mockSystemSettings: SystemSettings = {
    organizationName: ORGANIZATION_NAME,
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
