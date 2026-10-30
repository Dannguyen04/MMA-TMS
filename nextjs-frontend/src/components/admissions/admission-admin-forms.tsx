"use client";

import { MailPlus, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips, appendSuggestion, type Suggestion } from "@/components/ui/suggestion-chips";
import { useToast } from "@/components/ui/toast";
import { useActionForm, type FormAction } from "@/components/ui/use-action-form";
import { assignEvaluatorAction, decideApplicationAction, resendActivationEmailAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type AdmissionDecision } from "@/lib/domain/admissions";
import type { StaffOption } from "@/lib/domain/care-team";
import type { MessageKey, Translator } from "@/lib/i18n/translate";

/** A form acting on one application, reporting success in a toast. */
function useApplicationForm(action: FormAction<undefined>, id: string) {
    const t = useT();
    const toast = useToast();
    return useActionForm(action, { id, onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("screens.misc.admin.saved") }) });
}

/** Picks the coach who assesses the applicant, or replaces them with a reason. `coaches` may include inactive ones. */
export function EvaluatorForm({ applicationId, coaches, currentCoachId }: { applicationId: string; coaches: StaffOption[]; currentCoachId: string | null }) {
    const t = useT();
    const form = useApplicationForm(assignEvaluatorAction, "evaluator");
    const { control, error } = form;
    const choices = coaches.filter((coach) => coach.active && coach.staffId !== currentCoachId);
    const reassigning = currentCoachId !== null;

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="applicationId" value={applicationId} />
            <Field label={t(reassigning ? "screens.misc.admin.newCoach" : "screens.misc.admin.coach")} htmlFor={control("coachId").id} required error={error("coachId")}>
                <Select {...control("coachId", { required: true })} defaultValue="">
                    <option value="" disabled>
                        {t(choices.length === 0 ? "screens.misc.admin.noOtherCoach" : "screens.misc.admin.chooseCoach")}
                    </option>
                    {choices.map((coach) => (
                        <option key={coach.staffId} value={coach.staffId}>
                            {coach.title ? `${coach.name} · ${coach.title}` : coach.name}
                        </option>
                    ))}
                </Select>
            </Field>
            {reassigning && (
                <Field label={t("screens.misc.admin.whyChange")} htmlFor={control("reassignmentReason").id} required error={error("reassignmentReason")}>
                    <Textarea {...control("reassignmentReason", { required: true })} rows={2} maxLength={ADMISSION_LIMITS.reassignmentReason} />
                </Field>
            )}
            <FormMessage {...form.message} />
            <div>
                <SubmitButton size="sm" pending={form.pending} pendingLabel={t("screens.misc.admin.assigning")} disabled={choices.length === 0}>
                    {t(reassigning ? "screens.misc.admin.replaceCoach" : "screens.misc.admin.assignCoach")}
                </SubmitButton>
            </div>
        </form>
    );
}

const decisions = (t: Translator): ChoiceOption<AdmissionDecision>[] => [
    { value: "approved", label: t("screens.misc.admin.approve"), description: t("screens.misc.admin.approveDescription"), icon: UserCheck, tone: "success" },
    { value: "rejected", label: t("screens.misc.admin.reject"), description: t("screens.misc.admissions.closesCanReapply"), icon: UserX, tone: "danger" },
];

/** A reason chip: its label is `<key>`, the text it adds `<key>Value`. */
const reasonChip = (t: Translator, id: string): Suggestion => ({ label: t(`screens.misc.admin.reason.${id}` as MessageKey), value: t(`screens.misc.admin.reason.${id}Value` as MessageKey) });

/** Reasons administrators often give, per decision. Picking one adds it to the reason for them to check and edit. */
const decisionReasons = (t: Translator): Record<AdmissionDecision, Suggestion[]> => ({
    approved: ["passed", "coachRecommends", "place", "eligible"].map((id) => reasonChip(t, id)),
    rejected: ["full", "notEligible", "notConfirmed", "reapply"].map((id) => reasonChip(t, id)),
});

/** The final decision on an applicant who passed the assessment. */
export function DecisionForm({ applicationId }: { applicationId: string }) {
    const t = useT();
    const { decisionOptions, reasons } = useMemo(() => ({ decisionOptions: decisions(t), reasons: decisionReasons(t) }), [t]);
    const form = useApplicationForm(decideApplicationAction, "decision");
    const { control, error } = form;
    const [decision, setDecision] = useState<AdmissionDecision | "">("");
    const [reason, setReason] = useState("");
    const writeReason = (value: string) => {
        setReason(value);
        form.markEdited("reason");
    };

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="applicationId" value={applicationId} />
            <ChoiceGroup id={control("decision").id} name="decision" legend={t("screens.admin.application.decision")} required columns={2} options={decisionOptions} value={decision} onChange={setDecision} error={error("decision")} />
            <div className="flex flex-col gap-2">
                <Field label={t("screens.admin.common.reason")} htmlFor={control("reason").id} required hint={t("screens.misc.admin.reasonHint")} error={error("reason")}>
                    <Textarea
                        {...control("reason", { required: true, hint: true })}
                        rows={3}
                        value={reason}
                        onChange={(event) => writeReason(event.target.value)}
                        maxLength={ADMISSION_LIMITS.decisionReason}
                    />
                </Field>
                {decision && (
                    <SuggestionChips
                        label={t("screens.misc.admin.commonReasons")}
                        suggestions={reasons[decision]}
                        onPick={(value) => {
                            const next = appendSuggestion(reason, value);
                            if (next.length <= ADMISSION_LIMITS.decisionReason) writeReason(next);
                        }}
                    />
                )}
            </div>
            <FormMessage {...form.message} />
            <div>
                <SubmitButton pending={form.pending} pendingLabel={t("screens.admin.common.saving")} variant={decision === "rejected" ? "danger" : "primary"}>
                    {t(decision === "rejected" ? "screens.misc.admin.rejectApplication" : "screens.misc.admin.approveApplication")}
                </SubmitButton>
            </div>
        </form>
    );
}

/** Sends the activation email again; the previous link stops working. */
export function ResendActivationForm({ applicationId }: { applicationId: string }) {
    const t = useT();
    const form = useApplicationForm(resendActivationEmailAction, "resend-activation");
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <input type="hidden" name="applicationId" value={applicationId} />
            <FormMessage {...form.message} />
            <div>
                <SubmitButton size="sm" variant="secondary" pending={form.pending} pendingLabel={t("screens.admin.composer.sending")}>
                    <MailPlus aria-hidden />
                    {t("screens.misc.admin.resendEmail")}
                </SubmitButton>
            </div>
        </form>
    );
}
