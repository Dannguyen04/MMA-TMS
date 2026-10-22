"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { activeBout, parseWeightKg, WEIGHT_SAVED_NOTICE, weightInputMessage } from "@/lib/domain/weigh-in";
import { getTranslator } from "@/lib/i18n/server";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listBouts } from "@/lib/services/bouts";
import { recordSelfWeight } from "@/lib/services/people";
import { actionError, type ActionState } from "./state";

/**
 * A fighter logs today's weight. The backend scopes the write to the fighter's own profile; here the
 * caller must be a signed-in fighter. Afterwards the fighter lands on their bout, or on Today without one.
 */
export async function recordSelfWeightAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("weighIn.error.session"));
    if (user.role !== "fighter" || !user.profileId) return actionError(t("weighIn.error.notFighter"));

    const raw = formData.get("weightKg");
    const parsed = parseWeightKg(typeof raw === "string" ? raw : null);
    if (!parsed.ok) return actionError(t("form.fixFields"), { weightKg: weightInputMessage(t, parsed.error) });

    const result = await recordSelfWeight(user.profileId, parsed.kg);
    if (!result.ok) return actionError(t(result.code === "forbidden" ? "weighIn.error.forbidden" : "weighIn.error.noProfile"));

    revalidatePath(routes.fighter.bout);
    revalidatePath(routes.fighter.dashboard);
    revalidatePath(routes.coach.bouts);
    revalidatePath(routes.coach.dashboard);

    const bouts = await nullIfServiceFails(listBouts({ fighterIds: [user.profileId] }));
    const target = bouts && activeBout(bouts) ? routes.fighter.bout : routes.fighter.dashboard;
    redirect(hrefWith(target, {}, { notice: WEIGHT_SAVED_NOTICE }));
}
