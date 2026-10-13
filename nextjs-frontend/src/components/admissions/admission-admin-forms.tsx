"use client";

import { MailPlus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";

import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips, appendSuggestion, type Suggestion } from "@/components/ui/suggestion-chips";
import { useToast } from "@/components/ui/toast";
import { useActionForm, type FormAction } from "@/components/ui/use-action-form";
import { assignEvaluatorAction, decideApplicationAction, resendActivationEmailAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type AdmissionDecision } from "@/lib/domain/admissions";
import type { StaffOption } from "@/lib/domain/care-team";

/** A form acting on one application, reporting success in a toast. */
function useApplicationForm(action: FormAction<undefined>, id: string) {
    const toast = useToast();
    return useActionForm(action, { id, onSuccess: (state) => toast({ tone: "success", title: state.message ?? "Saved." }) });
}

/** Picks the coach who assesses the applicant, or replaces them with a reason. `coaches` may include inactive ones. */
export function EvaluatorForm({ applicationId, coaches, currentCoachId }: { applicationId: string; coaches: StaffOption[]; currentCoachId: string | null }) {
    const form = useApplicationForm(assignEvaluatorAction, "evaluator");
    const { control, error } = form;
    const choices = coaches.filter((coach) => coach.active && coach.staffId !== currentCoachId);
    const reassigning = currentCoachId !== null;

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="applicationId" value={applicationId} />
            <Field label={reassigning ? "New coach" : "Coach"} htmlFor={control("coachId").id} required error={error("coachId")}>
                <Select {...control("coachId", { required: true })} defaultValue="">
                    <option value="" disabled>
                        {choices.length === 0 ? "No other active coach" : "Choose a coach"}
                    </option>
                    {choices.map((coach) => (
                        <option key={coach.staffId} value={coach.staffId}>
                            {coach.title ? `${coach.name} · ${coach.title}` : coach.name}
                        </option>
                    ))}
                </Select>
            </Field>
            {reassigning && (
                <Field label="Why the coach changes" htmlFor={control("reassignmentReason").id} required error={error("reassignmentReason")}>
                    <Textarea {...control("reassignmentReason", { required: true })} rows={2} maxLength={ADMISSION_LIMITS.reassignmentReason} />
                </Field>
            )}
            <FormMessage {...form.message} />
            <div>
                <SubmitButton size="sm" pending={form.pending} pendingLabel="Assigning…" disabled={choices.length === 0}>
                    {reassigning ? "Replace coach" : "Assign coach"}
                </SubmitButton>
            </div>
        </form>
    );
}

const DECISIONS: ChoiceOption<AdmissionDecision>[] = [
    { value: "approved", label: "Approve", description: "They get an email to set a password and activate their fighter account.", icon: UserCheck, tone: "success" },
    { value: "rejected", label: "Reject", description: "The application closes. They can apply again later.", icon: UserX, tone: "danger" },
];

/** Reasons administrators often give, per decision. Picking one adds it to the reason for them to check and edit. */
const DECISION_REASONS: Record<AdmissionDecision, Suggestion[]> = {
    approved: [
        { label: "Passed the assessment", value: "Passed the entrance assessment." },
        { label: "Coach recommends", value: "The assessing coach recommends admission." },
        { label: "Place in this intake", value: "There is a place in the current intake." },
        { label: "Meets eligibility", value: "Meets the academy's eligibility rules." },
    ],
    rejected: [
        { label: "Intake is full", value: "There is no place in the current intake." },
        { label: "Eligibility not met", value: "Doesn't meet the academy's eligibility rules." },
        { label: "Details not confirmed", value: "The application details couldn't be confirmed." },
        { label: "Reapply later", value: "Welcome to apply again for a later intake." },
    ],
};

/** The final decision on an applicant who passed the assessment. */
export function DecisionForm({ applicationId }: { applicationId: string }) {
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
            <ChoiceGroup id={control("decision").id} name="decision" legend="Decision" required columns={2} options={DECISIONS} value={decision} onChange={setDecision} error={error("decision")} />
            <div className="flex flex-col gap-2">
                <Field label="Reason" htmlFor={control("reason").id} required hint="Kept with the application. The applicant sees only the outcome." error={error("reason")}>
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
                        label="Common reasons"
                        suggestions={DECISION_REASONS[decision]}
                        onPick={(value) => {
                            const next = appendSuggestion(reason, value);
                            if (next.length <= ADMISSION_LIMITS.decisionReason) writeReason(next);
                        }}
                    />
                )}
            </div>
            <FormMessage {...form.message} />
            <div>
                <SubmitButton pending={form.pending} pendingLabel="Saving…" variant={decision === "rejected" ? "danger" : "primary"}>
                    {decision === "rejected" ? "Reject application" : "Approve application"}
                </SubmitButton>
            </div>
        </form>
    );
}

/** Sends the activation email again; the previous link stops working. */
export function ResendActivationForm({ applicationId }: { applicationId: string }) {
    const form = useApplicationForm(resendActivationEmailAction, "resend-activation");
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <input type="hidden" name="applicationId" value={applicationId} />
            <FormMessage {...form.message} />
            <div>
                <SubmitButton size="sm" variant="secondary" pending={form.pending} pendingLabel="Sending…">
                    <MailPlus aria-hidden />
                    Resend email
                </SubmitButton>
            </div>
        </form>
    );
}
