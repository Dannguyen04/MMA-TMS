"use client";

import { MailPlus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";

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
import type { Translator } from "@/lib/i18n/translate";

/** A form acting on one application, reporting success in a toast. */
function useApplicationForm(action: FormAction<undefined>, id: string) {
    const toast = useToast();
    const t = useT();
    return useActionForm(action, { id, onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("adminForms.saved") }) });
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
            <Field label={reassigning ? t("adminForms.newCoach") : t("adminForms.coach")} htmlFor={control("coachId").id} required error={error("coachId")}>
                <Select {...control("coachId", { required: true })} defaultValue="">
                    <option value="" disabled>
                        {choices.length === 0 ? t("adminForms.noCoach") : t("adminForms.chooseCoach")}
                    </option>
                    {choices.map((coach) => (
                        <option key={coach.staffId} value={coach.staffId}>
                            {coach.title ? `${coach.name} · ${coach.title}` : coach.name}
                        </option>
                    ))}
                </Select>
            </Field>
            {reassigning && (
                <Field label={t("adminForms.whyChange")} htmlFor={control("reassignmentReason").id} required error={error("reassignmentReason")}>
                    <Textarea {...control("reassignmentReason", { required: true })} rows={2} maxLength={ADMISSION_LIMITS.reassignmentReason} />
                </Field>
            )}
            <FormMessage {...form.message} />
            <div>
                <SubmitButton size="sm" pending={form.pending} pendingLabel={t("adminForms.assigning")} disabled={choices.length === 0}>
                    {reassigning ? t("adminForms.replaceCoach") : t("adminForms.assignCoach")}
                </SubmitButton>
            </div>
        </form>
    );
}

function decisionOptions(t: Translator): ChoiceOption<AdmissionDecision>[] {
    return [
        { value: "approved", label: t("adminForms.approve"), description: t("adminForms.approveDesc"), icon: UserCheck, tone: "success" },
        { value: "rejected", label: t("adminForms.reject"), description: t("adminForms.rejectDesc"), icon: UserX, tone: "danger" },
    ];
}

function decisionReasons(t: Translator): Record<AdmissionDecision, Suggestion[]> {
    return {
        approved: [
            { label: t("adminForms.reason.passed"), value: t("adminForms.reason.passedValue") },
            { label: t("adminForms.reason.recommends"), value: t("adminForms.reason.recommendsValue") },
            { label: t("adminForms.reason.place"), value: t("adminForms.reason.placeValue") },
            { label: t("adminForms.reason.eligible"), value: t("adminForms.reason.eligibleValue") },
        ],
        rejected: [
            { label: t("adminForms.reason.full"), value: t("adminForms.reason.fullValue") },
            { label: t("adminForms.reason.notMet"), value: t("adminForms.reason.notMetValue") },
            { label: t("adminForms.reason.unconfirmed"), value: t("adminForms.reason.unconfirmedValue") },
            { label: t("adminForms.reason.later"), value: t("adminForms.reason.laterValue") },
        ],
    };
}

/** The final decision on an applicant who passed the assessment. */
export function DecisionForm({ applicationId }: { applicationId: string }) {
    const t = useT();
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
            <ChoiceGroup id={control("decision").id} name="decision" legend={t("adminForms.decision")} required columns={2} options={decisionOptions(t)} value={decision} onChange={setDecision} error={error("decision")} />
            <div className="flex flex-col gap-2">
                <Field label={t("adminForms.reason")} htmlFor={control("reason").id} required hint={t("adminForms.reasonHint")} error={error("reason")}>
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
                        label={t("adminForms.commonReasons")}
                        suggestions={decisionReasons(t)[decision]}
                        onPick={(value) => {
                            const next = appendSuggestion(reason, value);
                            if (next.length <= ADMISSION_LIMITS.decisionReason) writeReason(next);
                        }}
                    />
                )}
            </div>
            <FormMessage {...form.message} />
            <div>
                <SubmitButton pending={form.pending} pendingLabel={t("adminForms.saving")} variant={decision === "rejected" ? "danger" : "primary"}>
                    {decision === "rejected" ? t("adminForms.rejectApp") : t("adminForms.approveApp")}
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
                <SubmitButton size="sm" variant="secondary" pending={form.pending} pendingLabel={t("adminForms.sending")}>
                    <MailPlus aria-hidden />
                    {t("adminForms.resendEmail")}
                </SubmitButton>
            </div>
        </form>
    );
}
