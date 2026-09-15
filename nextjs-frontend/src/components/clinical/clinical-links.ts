import { routes } from "@/lib/routes";

/**
 * Clinical deep links with prefilled query parameters. Paths come from `routes`; the
 * recovery-plan form has no entry there yet, so it is derived from the recovery board path.
 */
export const clinicalLinks = {
    newRecoveryPlan: `${routes.doctor.recovery}/new`,
    newRecoveryPlanFor: (injuryId: string) => `${routes.doctor.recovery}/new?injury=${encodeURIComponent(injuryId)}`,
    newInjuryFor: ({ fighterId, alertId }: { fighterId?: string; alertId?: string }) => {
        const params = new URLSearchParams();
        if (fighterId) params.set("fighter", fighterId);
        if (alertId) params.set("alert", alertId);
        const query = params.toString();
        return query ? `${routes.doctor.newInjury}?${query}` : routes.doctor.newInjury;
    },
    grantClearanceFor: (fighterId: string) => `${routes.doctor.grantClearance}?fighter=${encodeURIComponent(fighterId)}`,
    newExaminationFor: (fighterId: string) => `${routes.doctor.newExamination}?fighter=${encodeURIComponent(fighterId)}`,
};
