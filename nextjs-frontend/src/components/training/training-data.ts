import "server-only";

import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { clearanceState } from "@/lib/domain/rules";
import type { Exercise, Fighter, MedicalClearance } from "@/lib/domain/types";
import { getCurrentClearanceFor } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { listExercises } from "@/lib/services/training";
import type { ClearanceSummary } from "./training-utils";

/** Server-side lookups shared by the training pages. */

export async function getCoachNames(): Promise<Record<string, string>> {
    const coaches = await listCoaches();
    return Object.fromEntries(coaches.map((coach) => [coach.id, coach.name]));
}

export async function getExerciseLibrary(): Promise<Record<string, Exercise>> {
    const exercises = await listExercises();
    return Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
}

/** The lighter identity projection, so pages don't ship whole fighter records to the client. */
export function toIdentity(fighter: Fighter): FighterIdentityData {
    return {
        name: fighter.name,
        nickname: fighter.nickname,
        weightClass: fighter.weightClass,
        stance: fighter.stance,
        level: fighter.level,
        healthStatus: fighter.healthStatus,
    };
}

/** Identity plus id, for forms that let the coach choose a fighter. */
export function toFighterOption(fighter: Fighter): FighterIdentityData & { id: string } {
    return { id: fighter.id, ...toIdentity(fighter) };
}

export function identitiesById(fighters: Fighter[]): Record<string, FighterIdentityData> {
    return Object.fromEntries(fighters.map((fighter) => [fighter.id, toIdentity(fighter)]));
}

/**
 * The clearance as coaches and fighters may see it on training screens. Fields are copied one by one from an
 * allowlist and every clinical free-text field is blanked, so nothing added to the clinical record later can
 * reach the browser by accident. Never spread the clinical record here.
 */
function toSummaryClearance(clearance: MedicalClearance): MedicalClearance {
    return {
        id: clearance.id,
        fighterId: clearance.fighterId,
        doctorId: clearance.doctorId,
        level: clearance.level,
        status: clearance.status,
        issuedAt: clearance.issuedAt,
        validUntil: clearance.validUntil,
        restrictions: clearance.restrictions.map((restriction) => ({
            id: restriction.id,
            label: restriction.label,
            blockedTrainingTypes: restriction.blockedTrainingTypes,
            blockedTechniques: restriction.blockedTechniques,
            blockedRegions: restriction.blockedRegions,
            maxRpe: restriction.maxRpe,
        })),
        revokedAt: clearance.revokedAt,
        // Clinical fields: blanked, never copied.
        reason: "",
        revokedReason: null,
        examinationId: null,
    };
}

/**
 * Current Medical Clearance (summary level) for each fighter. Accepts the ids as a promise so the doctor-name
 * lookup can start alongside the read that yields them.
 */
export async function getClearanceSummaries(fighterIds: string[] | Promise<string[]>, now: string): Promise<Record<string, ClearanceSummary>> {
    const [doctors, ids] = await Promise.all([listDoctors(), fighterIds]);
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    return Object.fromEntries(
        ids.map((fighterId) => {
            const clearance = getCurrentClearanceFor(fighterId);
            const summary: ClearanceSummary = {
                clearance: clearance ? toSummaryClearance(clearance) : null,
                state: clearanceState(clearance, now),
                doctorName: clearance ? doctorNames.get(clearance.doctorId) : undefined,
            };
            return [fighterId, summary];
        }),
    );
}

export async function getClearanceSummary(fighterId: string, now: string): Promise<ClearanceSummary> {
    const summaries = await getClearanceSummaries([fighterId], now);
    return summaries[fighterId];
}
