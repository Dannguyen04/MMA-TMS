"use client";

import { CircleCheck, CircleSlash, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Checkbox, Field, FormFooter, FormSection, Input, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordExaminationDecisionAction } from "@/lib/actions/medical-contract";
import {
    EXAMINATION_DECISIONS,
    EXAMINATION_DECISION_DESCRIPTIONS,
    EXAMINATION_DECISION_LABELS,
    EXAMINATION_SCOPES,
    EXAMINATION_SCOPE_DESCRIPTIONS,
    EXAMINATION_SCOPE_LABELS,
    MEDICAL_TEXT_LIMITS,
    type ExaminationDecision,
    type ExaminationScope,
    type MedicalReviewRequest,
} from "@/lib/domain/medical-contract";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { RestrictionFields } from "./restriction-fields";

export interface ExaminationDecisionFormProps {
    fighter: { id: string; name: string };
    currentExaminations: Record<ExaminationScope, CurrentExamination | null>;
    openReviewRequests: MedicalReviewRequest[];
    defaultScope: ExaminationScope;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    now: string;
    cancelHref: string;
}

const SCOPE_OPTIONS: ChoiceOption<ExaminationScope>[] = EXAMINATION_SCOPES.map((value) => ({
    value,
    label: EXAMINATION_SCOPE_LABELS[value],
    description: EXAMINATION_SCOPE_DESCRIPTIONS[value],
}));

const DECISION_META: Record<ExaminationDecision, Pick<ChoiceOption<ExaminationDecision>, "icon" | "tone">> = {
    ELIGIBLE: { icon: CircleCheck, tone: "success" },
    ELIGIBLE_WITH_RESTRICTIONS: { icon: ShieldAlert, tone: "warning" },
    NOT_ELIGIBLE: { icon: CircleSlash, tone: "danger" },
};

const DECISION_OPTIONS: ChoiceOption<ExaminationDecision>[] = EXAMINATION_DECISIONS.map((value) => ({
    value,
    label: EXAMINATION_DECISION_LABELS[value],
    description: EXAMINATION_DECISION_DESCRIPTIONS[value],
    ...DECISION_META[value],
}));

/**
 * Records an examination as the medical service keeps it: what it decides (training or competition), the decision,
 * the reasoning and, for a restricted decision, the limits. A training examination can answer open review requests,
 * and a new examination can correct the current one of the same scope.
 */
export function ExaminationDecisionForm({ fighter, currentExaminations, openReviewRequests, defaultScope, nowInput, now, cancelHref }: ExaminationDecisionFormProps) {
    const form = useActionForm(recordExaminationDecisionAction, { id: "exam-decision", hiddenFields: ["supersedesId"] });
    const { control, error } = form;
    const [scope, setScope] = useState<ExaminationScope>(defaultScope);
    const [decision, setDecision] = useState<ExaminationDecision | "">("");
    const [examinedAt, setExaminedAt] = useState(nowInput);
    const [correcting, setCorrecting] = useState(false);
    const [answered, setAnswered] = useState<string[]>(openReviewRequests.map((request) => request.id));

    const current = currentExaminations[scope];
    const answersRequests = scope === "TRAINING" && openReviewRequests.length > 0;

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <input type="hidden" name="fighterId" value={fighter.id} />

                <FormSection title="What it decides" description={`The examination decides one question for ${fighter.name}.`}>
                    <ChoiceGroup
                        id="exam-decision-scope"
                        name="scope"
                        legend="Scope"
                        legendVisuallyHidden
                        required
                        columns={2}
                        variant="compact"
                        options={SCOPE_OPTIONS}
                        value={scope}
                        onChange={(next) => {
                            setScope(next);
                            setCorrecting(false);
                        }}
                        error={error("scope")}
                    />
                    {current && (
                        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px]">
                            <p className="text-fg-muted">
                                Current {EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} examination:{" "}
                                <span className="font-medium text-fg">{EXAMINATION_DECISION_LABELS[current.decision]}</span> on{" "}
                                <time dateTime={current.examinedAt}>{formatDateTime(current.examinedAt)}</time>
                            </p>
                            <input type="hidden" name="supersedesId" value={current.id} />
                            <Checkbox
                                id="exam-decision-correction"
                                name="correction"
                                checked={correcting}
                                onChange={(event) => setCorrecting(event.target.checked)}
                                label="This corrects that examination"
                                description="Use it for a mistake in the record. A new visit is a new examination, not a correction."
                            />
                            {error("supersedesId") && <p className="font-medium text-danger-fg">{error("supersedesId")}</p>}
                        </div>
                    )}
                </FormSection>

                <FormSection title="Decision" description="Your clinical decision and the reasoning behind it.">
                    <ChoiceGroup
                        id="exam-decision-decision"
                        name="decision"
                        legend="Decision"
                        required
                        options={DECISION_OPTIONS}
                        value={decision}
                        onChange={setDecision}
                        error={error("decision")}
                    />
                    <Field label="Examined" htmlFor={control("examinedAt").id} error={error("examinedAt")} required hint="Academy time (Ho Chi Minh City)">
                        <Input
                            {...control("examinedAt", { hint: true, required: true })}
                            type="datetime-local"
                            value={examinedAt}
                            max={nowInput}
                            onChange={(event) => setExaminedAt(event.target.value)}
                            className="sm:w-64"
                        />
                    </Field>
                    <Field
                        label="Findings and reasoning"
                        htmlFor={control("reason").id}
                        error={error("reason")}
                        required
                        hint="The fighter can read this on their Health page. Coaches can't."
                    >
                        <Textarea {...control("reason", { hint: true, required: true })} rows={5} maxLength={MEDICAL_TEXT_LIMITS.examinationReason} />
                    </Field>
                    {decision !== "NOT_ELIGIBLE" && (
                        <Field
                            label="Decision valid until"
                            htmlFor={control("validUntil").id}
                            error={error("validUntil")}
                            optional
                            hint="Leave empty for no end date. A clearance from this examination can't last longer."
                        >
                            <Input {...control("validUntil", { hint: true })} type="date" min={examinedAt.slice(0, 10) || undefined} className="sm:w-56" />
                        </Field>
                    )}
                    {decision === "NOT_ELIGIBLE" && (
                        <Callout tone="danger" icon={TriangleAlert} title={`Active ${EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} clearances are revoked`}>
                            {fighter.name} stops {scope === "TRAINING" ? "training" : "competing"} as soon as you record this. A later examination is needed to change it.
                        </Callout>
                    )}
                </FormSection>

                {decision === "ELIGIBLE_WITH_RESTRICTIONS" && (
                    <FormSection title="Restrictions" description="What the fighter may do. A clearance issued from this examination can only narrow it.">
                        <RestrictionFields form={form} idPrefix="exam-decision" />
                        <Field label="Restriction notes" htmlFor={control("restrictionNotes").id} error={error("restrictionNotes")} optional hint="Anything the lists can't say, e.g. intensity or duration.">
                            <Textarea {...control("restrictionNotes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.restrictionNotes} />
                        </Field>
                        {error("restrictions") && <p className="text-[13px] font-medium text-danger-fg">{error("restrictions")}</p>}
                    </FormSection>
                )}

                {answersRequests && (
                    <FormSection title="Review requests" description="Requests this examination answers. Answered requests stop pausing training.">
                        <fieldset aria-invalid={error("reviewRequestIds") ? true : undefined} data-invalid={error("reviewRequestIds") ? "true" : undefined} className="flex flex-col gap-2.5">
                            <legend className="sr-only">Review requests answered</legend>
                            {openReviewRequests.map((request) => (
                                <Checkbox
                                    key={request.id}
                                    id={`exam-decision-request-${request.id}`}
                                    name="reviewRequestIds"
                                    value={request.id}
                                    checked={answered.includes(request.id)}
                                    onChange={(event) => {
                                        setAnswered(event.target.checked ? [...answered, request.id] : answered.filter((id) => id !== request.id));
                                        form.markEdited("reviewRequestIds");
                                    }}
                                    label={`“${request.reason}”`}
                                    description={`Requested ${formatRelative(request.requestedAt, now).toLowerCase()}`}
                                />
                            ))}
                            {error("reviewRequestIds") && <p className="text-[13px] font-medium text-danger-fg">{error("reviewRequestIds")}</p>}
                        </fieldset>
                    </FormSection>
                )}

                <FormFooter message={form.message} cancelHref={cancelHref} pending={form.pending} submitLabel="Record decision" pendingLabel="Recording…" />
            </Card>

            <aside aria-label="What happens next" className="min-w-0">
                <Card>
                    <CardHeader title="After you record it" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li>Examinations can&apos;t be edited or deleted. To fix a mistake, record a correction of the current one.</li>
                            <li>
                                An eligible decision doesn&apos;t clear {fighter.name} by itself: you&apos;ll issue the clearance next, and it can only narrow
                                what you decide here.
                            </li>
                            {current?.validUntil && (
                                <li>
                                    The current {EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} decision is valid until {formatDate(current.validUntil)}.
                                </li>
                            )}
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
