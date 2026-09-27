import { routes } from "@/lib/routes";
import type { FollowUp } from "@/lib/services/medical";

/** Link to start the follow-up examination for a fighter, continuing the same kind of examination. */
export function followUpExaminationHref(followUp: Pick<FollowUp, "fighter" | "examination">): string {
    const type = followUp.examination.type === "baseline" || followUp.examination.type === "pre_fight" ? "routine" : followUp.examination.type;
    return `${routes.doctor.newExamination}?fighter=${followUp.fighter.id}&type=${type}`;
}
