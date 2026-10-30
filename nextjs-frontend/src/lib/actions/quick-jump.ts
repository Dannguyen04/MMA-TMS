"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";

export interface QuickJumpPerson {
    name: string;
    href: string;
    /** Weight class or discipline, to tell two people with similar names apart. */
    hint: string | null;
}

/** Fighters the viewer may open, for the quick-jump palette. Loaded when the palette opens, not on every page. */
export async function quickJumpFighters(): Promise<QuickJumpPerson[]> {
    const user = await getCurrentUser();
    if (!user || user.role === "fighter") return [];
    const profile = user.role === "coach" ? routes.coach.fighter : user.role === "doctor" ? routes.doctor.fighter : routes.admin.fighter;
    const fighters = await listFighters(user).catch(() => []);
    return fighters.map((fighter) => ({ name: fighter.name, href: profile(fighter.id), hint: fighter.primaryDiscipline ?? null }));
}
