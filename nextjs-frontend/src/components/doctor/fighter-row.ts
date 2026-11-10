import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { loadDoctorRow } from "@/lib/services/doctor-board";

/**
 * One fighter's triage row, read once per request: the profile layout (header and tabs) and the overview page both use
 * it, so opening the profile reads the fighter's record once, not twice.
 */
export const loadFighterRow = cache(async (fighterId: string) => {
    const user = await requireRole("doctor");
    const stored = await requireFighterAccess(user, fighterId);
    const row = await loadDoctorRow(stored);
    if (!row) notFound();
    return { user, row };
});
