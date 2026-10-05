import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { FollowUp } from "@/lib/services/medical";

/** Link to start the follow-up examination for a fighter, continuing the same kind of examination (and, in API mode, scope). */
export function followUpExaminationHref(followUp: Pick<FollowUp, "fighter" | "examination">): string {
    const { examination } = followUp;
    const type = examination.type === "baseline" || examination.type === "pre_fight" ? "routine" : examination.type;
    return hrefWith(routes.doctor.newExamination, {}, { fighter: followUp.fighter.id, type, scope: examination.scope });
}
