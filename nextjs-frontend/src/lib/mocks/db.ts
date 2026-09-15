import "server-only";

import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIJob,
    AIModel,
    AuditLog,
    Coach,
    CoachFeedback,
    Doctor,
    Exercise,
    Fighter,
    Goal,
    Injury,
    MedicalClearance,
    MedicalExamination,
    MedicalRecord,
    Notification,
    NotificationBroadcast,
    PerformanceMetric,
    RecoveryPlan,
    RoleDefinition,
    SystemSettings,
    TrainingPlan,
    TrainingSession,
    Treatment,
    User,
    Video,
} from "@/lib/domain/types";
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
import { mockRoleDefinitions, mockSystemSettings } from "./roles";
import { mockCoachFeedback, mockExercises, mockGoals, mockTrainingPlans, mockTrainingSessions } from "./training";

/**
 * In-memory mock database.
 *
 * Services read and mutate this store exactly as they will later call the NestJS API.
 * It lives on globalThis so it survives hot reloads and is shared by every request in
 * the server process. Restarting the server resets all changes.
 */
export interface MockDatabase {
    users: User[];
    fighters: Fighter[];
    coaches: Coach[];
    doctors: Doctor[];
    roleDefinitions: RoleDefinition[];
    settings: SystemSettings;
    exercises: Exercise[];
    trainingPlans: TrainingPlan[];
    trainingSessions: TrainingSession[];
    coachFeedback: CoachFeedback[];
    goals: Goal[];
    performanceMetrics: PerformanceMetric[];
    videos: Video[];
    aiJobs: AIJob[];
    aiAnalyses: AIAnalysis[];
    abnormalMovementAlerts: AbnormalMovementAlert[];
    aiModels: AIModel[];
    medicalRecords: MedicalRecord[];
    medicalExaminations: MedicalExamination[];
    injuries: Injury[];
    treatments: Treatment[];
    recoveryPlans: RecoveryPlan[];
    medicalClearances: MedicalClearance[];
    notifications: Notification[];
    broadcasts: NotificationBroadcast[];
    auditLogs: AuditLog[];
}

function seedData(): MockDatabase {
    return {
        users: mockUsers,
        fighters: mockFighters,
        coaches: mockCoaches,
        doctors: mockDoctors,
        roleDefinitions: mockRoleDefinitions,
        settings: mockSystemSettings,
        exercises: mockExercises,
        trainingPlans: mockTrainingPlans,
        trainingSessions: mockTrainingSessions,
        coachFeedback: mockCoachFeedback,
        goals: mockGoals,
        performanceMetrics: mockPerformanceMetrics,
        videos: mockVideos,
        aiJobs: mockAIJobs,
        aiAnalyses: mockAIAnalyses,
        abnormalMovementAlerts: mockAbnormalMovementAlerts,
        aiModels: mockAIModels,
        medicalRecords: mockMedicalRecords,
        medicalExaminations: mockMedicalExaminations,
        injuries: mockInjuries,
        treatments: mockTreatments,
        recoveryPlans: mockRecoveryPlans,
        medicalClearances: mockMedicalClearances,
        notifications: mockNotifications,
        broadcasts: mockBroadcasts,
        auditLogs: mockAuditLogs,
    };
}

/** FNV-1a hash of the serialized seed — identical for every bundle that loads the same seed. */
function fingerprint(data: MockDatabase): string {
    const text = JSON.stringify(data);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${text.length}-${(hash >>> 0).toString(36)}`;
}

let seedFingerprint: string | null = null;

const store = globalThis as unknown as { __mmaMockDb?: { db: MockDatabase; fingerprint: string } };

/**
 * Returns the shared mock database. Pages, Server Actions and Route Handlers are bundled
 * separately and each load their own copy of the seed modules, so the store is keyed by
 * seed content (not module identity): it is rebuilt only when the seed itself changes.
 *
 * The seed is deterministic apart from its time anchor, which lives on globalThis (time.ts), so
 * every bundle builds an identical seed and computes the same fingerprint for the whole process.
 */
export function db(): MockDatabase {
    seedFingerprint ??= fingerprint(seedData());
    if (store.__mmaMockDb?.fingerprint !== seedFingerprint) {
        store.__mmaMockDb = { db: structuredClone(seedData()), fingerprint: seedFingerprint };
    }
    return store.__mmaMockDb.db;
}

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 180);

/** Simulates network latency so loading states are exercised. Set MOCK_LATENCY_MS=0 to disable. */
export async function simulateLatency(factor = 1): Promise<void> {
    if (LATENCY_MS <= 0) return;
    const ms = LATENCY_MS * factor * (0.6 + Math.random() * 0.8);
    await new Promise((resolve) => setTimeout(resolve, ms));
}

let idCounter = 0;

/** Creates a unique id for records created at runtime. */
export function newId(prefix: string): string {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function nowIso(): string {
    return new Date().toISOString();
}
