import "server-only";

import { canAccessFighter } from "@/lib/auth/access";
import type { Fighter, User } from "@/lib/domain/types";
import { getClinicalDossier, type ClinicalDossier } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";

export interface FormFighter {
    /** The doctor's fighters, for the chooser. */
    fighters: Fighter[];
    /** The fighter named by `?fighter=`, when the doctor may open them. */
    fighter: Fighter | undefined;
    /** That fighter's dossier; null when none was chosen or it can't be read. */
    dossier: ClinicalDossier | null;
}

/**
 * The fighter an API-mode clinical form is for. Every clinical read is audited, so the form reads one fighter's
 * dossier once a fighter is chosen, never every assigned fighter's.
 */
export async function loadFormFighter(user: User, requested: string | undefined): Promise<FormFighter> {
    const fighters = await listFighters(user);
    const fighter = requested && canAccessFighter(user, requested) ? fighters.find((candidate) => candidate.id === requested) : undefined;
    return { fighters, fighter, dossier: fighter ? await getClinicalDossier(fighter.id) : null };
}
