import "server-only";

import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import { clearanceState, type ClearanceState } from "@/lib/domain/rules";
import type { TrainingType, User, VideoTrainingType } from "@/lib/domain/types";
import { VIDEO_PIPELINE_MODE, type VideoPipelineMode } from "@/lib/api/pipeline-mode";
import { accessibleFighterIds } from "@/lib/auth/access";
import { getSettings } from "@/lib/services/admin";
import { getCurrentClearanceFor } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { listSessions } from "@/lib/services/training";

export interface WizardFighterOption extends FighterIdentityData {
    id: string;
    clearanceState: ClearanceState;
    /** Clearance restrictions that block video training types (labels only, never clinical notes). */
    restrictions: { label: string; types: VideoTrainingType[] }[];
}

export interface WizardSessionOption {
    id: string;
    fighterId: string;
    title: string;
    type: TrainingType;
    scheduledAt: string;
}

export interface UploadWizardData {
    fighters: WizardFighterOption[];
    sessions: WizardSessionOption[];
    settings: { allowedVideoFormats: string[]; videoMaxSizeMb: number };
    mode: VideoPipelineMode;
    now: string;
}

const DAY_MS = 86_400_000;

/** Roster, recent sessions, upload limits and clearance summaries for the upload wizard. */
export async function loadUploadWizardData(user: User): Promise<UploadWizardData> {
    const now = new Date();
    const scope = accessibleFighterIds(user);
    const [fighters, sessions, settings] = await Promise.all([
        listFighters(user),
        listSessions({ fighterIds: scope, from: new Date(now.getTime() - 21 * DAY_MS).toISOString(), to: new Date(now.getTime() + DAY_MS).toISOString(), order: "desc" }),
        getSettings(),
    ]);

    return {
        fighters: fighters.map((fighter) => {
            const clearance = getCurrentClearanceFor(fighter.id);
            const state = clearanceState(clearance, now);
            const restrictions = state === "restricted" && clearance ? clearance.restrictions : [];
            return {
                id: fighter.id,
                name: fighter.name,
                nickname: fighter.nickname,
                weightClass: fighter.weightClass,
                stance: fighter.stance,
                level: fighter.level,
                healthStatus: fighter.healthStatus,
                clearanceState: state,
                restrictions: restrictions
                    .map((r) => ({ label: r.label, types: VIDEO_TRAINING_TYPES.filter((type) => r.blockedTrainingTypes.includes(type)) }))
                    .filter((r) => r.types.length > 0),
            };
        }),
        sessions: sessions
            .filter((s) => s.status !== "cancelled" && s.status !== "missed")
            .map((s) => ({ id: s.id, fighterId: s.fighterId, title: s.title, type: s.type, scheduledAt: s.scheduledAt })),
        settings: { allowedVideoFormats: settings.allowedVideoFormats, videoMaxSizeMb: settings.videoMaxSizeMb },
        mode: VIDEO_PIPELINE_MODE,
        now: now.toISOString(),
    };
}
