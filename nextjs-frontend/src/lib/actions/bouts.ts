"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { actionError, FIX_FIELDS, type ActionState } from "@/lib/actions/state";
import { readPlanAnswer, readPlanAuthor, readPlanText } from "@/lib/domain/nutrition";
import type { NutritionPhaseKey } from "@/lib/domain/bout";
import { parseSelfWeight } from "@/lib/domain/weight-input";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/routes";
import { getCampBout, getCurrentBout, getWeightTrack, recordNutritionCheckin, saveNutritionPlan } from "@/lib/services/bouts";
import { recordSelfWeight } from "@/lib/services/people";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];

/** Saves today's kilograms. The plan question is optional and never blocks a blank skip. */
export async function recordWeightAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireRole("fighter");
    if (!user.profileId) return actionError("Your fighter profile is missing.");

    const parsed = parseSelfWeight(String(formData.get("weightKg") ?? ""));
    if (!parsed.ok) return actionError(FIX_FIELDS, { weightKg: parsed.message });

    const answer = readPlanAnswer(String(formData.get("adherence") ?? ""), String(formData.get("note") ?? ""));
    if (!answer.ok) return actionError(FIX_FIELDS, { [answer.field]: answer.message });

    try {
        await recordSelfWeight(user.profileId, parsed.kg);
        if (answer.adherence) await recordNutritionCheckin(user.profileId, answer.adherence, answer.note);
    } catch (error) {
        if (error instanceof ApiError) return actionError(error.message);
        throw error;
    }

    const bout = await getCurrentBout(user.profileId);
    const track = bout ? await getWeightTrack(bout.id) : null;
    revalidatePath(routes.fighter.dashboard);
    revalidatePath(routes.fighter.bout);
    revalidatePath(routes.coach.dashboard);
    if (bout) revalidatePath(routes.coach.bout(bout.id));

    const params = new URLSearchParams({ saved: parsed.kg.toFixed(1) });
    if (track) params.set("status", track.status);
    redirect(bout ? `${routes.fighter.bout}?${params}` : `${routes.fighter.dashboard}?${params}`);
}

/** Saves the three phase notes a coach typed. Empty text clears that phase. */
export async function saveNutritionPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireRole("coach");
    const boutId = String(formData.get("boutId") ?? "");
    const bout = boutId ? await getCampBout(boutId) : null;
    if (!bout || !canAccessFighter(user, bout.fighterId)) return actionError("That bout is not on your roster.");

    const author = readPlanAuthor(String(formData.get("authorName") ?? ""), user.name);
    if (!author.ok) return actionError(FIX_FIELDS, { authorName: author.message });

    const texts = {} as Record<NutritionPhaseKey, string>;
    const fieldErrors: Record<string, string> = {};
    for (const phase of PHASES) {
        const text = readPlanText(String(formData.get(phase) ?? ""));
        if (!text.ok) fieldErrors[phase] = text.message;
        else texts[phase] = text.text;
    }
    if (Object.keys(fieldErrors).length > 0) return actionError(FIX_FIELDS, fieldErrors);

    const result = await saveNutritionPlan(bout.id, texts, author.authorName);
    if (!result.ok) return actionError(result.message);

    revalidatePath(routes.coach.bout(bout.id));
    revalidatePath(routes.fighter.bout);
    redirect(`${routes.coach.bout(bout.id)}?saved=plan`);
}
