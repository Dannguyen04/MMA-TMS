"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/session";
import { CARE_ROLES } from "@/lib/domain/care-team";
import { careTeamChange } from "@/lib/domain/care-team-change";
import { getCareTeam } from "@/lib/services/care-team";
import { assignStaffAction } from "./admin";
import { actionError, type ActionState } from "./state";

const guardFields = z.object({ fighterId: z.string().min(1), role: z.enum(CARE_ROLES) });

/**
 * Assigns a coach or sports doctor only while the role's assignments are still the ones the administrator saw when
 * the form opened (`expected`, one staff id per field). Another administrator may have answered the same
 * notification in the meantime: then nothing is written, the page reloads the care team, and the form says who was
 * assigned. Otherwise it hands over to {@link assignStaffAction}, which validates, writes and reports.
 */
export async function assignCareTeamMemberAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = guardFields.safeParse({ fighterId: formData.get("fighterId"), role: formData.get("role") });
    // Missing fields: the assignment action reports them on the form.
    if (!parsed.success) return assignStaffAction(prev, formData);

    const { fighterId, role } = parsed.data;
    const seen = formData.getAll("expected").filter((value): value is string => typeof value === "string");
    const current = (await getCareTeam(fighterId))[role];
    // A list the service couldn't give is no evidence of a change; the write still checks for itself.
    const change = current ? careTeamChange(role, seen, current) : null;
    if (change) {
        revalidatePath("/admin/users/[userId]", "page");
        return actionError(change);
    }
    return assignStaffAction(prev, formData);
}
