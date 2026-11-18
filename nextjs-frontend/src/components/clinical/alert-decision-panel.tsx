"use client";

import { CalendarClock, CircleCheck, CircleX, PenLine } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { reviewAlertAction } from "@/lib/actions/clinical";
import type { DoctorDecision, DoctorReview } from "@/lib/domain/types";
import { DOCTOR_DECISION_META } from "./clinical-badges";
import { DOCTOR_DECISION_COPY } from "./clinical-copy";
import { DoctorReviewBlock } from "./doctor-review-block";

const DECISION_ICONS = { acknowledged: CircleCheck, follow_up: CalendarClock, dismissed: CircleX } as const;

const DECISIONS = ["acknowledged", "follow_up", "dismissed"] as const;

export interface AlertDecisionPanelProps {
    alertId: string;
    review: DoctorReview | null;
}

/** The doctor's decision on an AI observation: the recorded decision, or a form to record or change it. */
export function AlertDecisionPanel({ alertId, review }: AlertDecisionPanelProps) {
    const toast = useToast();
    const t = useT();
    const decisionOptions: ChoiceOption<DoctorDecision>[] = DECISIONS.map((value) => ({
        value,
        label: t(DOCTOR_DECISION_COPY[value].title),
        description: t(DOCTOR_DECISION_COPY[value].description),
        icon: DECISION_ICONS[value],
        tone: DOCTOR_DECISION_META[value].tone,
    }));
    const noteHint = t("doctorClinical.decisionForm.noteHint");
    const [editing, setEditing] = useState(review === null);
    const [decision, setDecision] = useState<DoctorDecision | "">(review?.decision ?? "");
    const [note, setNote] = useState("");

    const form = useActionForm(reviewAlertAction, {
        id: "alert-decision",
        onSuccess: (state) => {
            setEditing(false);
            setNote("");
            toast({ title: t("doctorClinical.decisionForm.recorded"), description: state.message });
        },
    });
    const noteControl = form.control("note", { hint: noteHint, required: true });

    if (!editing && review) {
        return (
            <div className="flex flex-col gap-3" aria-live="polite">
                <DoctorReviewBlock review={review} />
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                        setDecision(review.decision);
                        form.reset();
                        setEditing(true);
                    }}
                >
                    <PenLine aria-hidden />
                    {t("doctorClinical.decisionForm.change")}
                </Button>
            </div>
        );
    }

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="alertId" value={alertId} />
            <ChoiceGroup
                id={form.control("decision").id}
                name="decision"
                legend={t("doctorClinical.decisionForm.legend")}
                required
                options={decisionOptions}
                value={decision}
                onChange={setDecision}
                error={form.error("decision")}
            />

            <Field label={t("doctorClinical.decisionForm.note")} htmlFor={noteControl.id} required error={form.error("note")} hint={noteHint}>
                <Textarea
                    {...noteControl}
                    rows={4}
                    value={note}
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("doctorClinical.decisionForm.notePlaceholder")}
                />
            </Field>

            <FormMessage {...form.message} />

            <div className="flex flex-wrap justify-end gap-2">
                {review && (
                    <Button variant="secondary" onClick={() => setEditing(false)} disabled={form.pending}>
                        {t("doctorClinical.common.cancel")}
                    </Button>
                )}
                <Button type="submit" loading={form.pending}>
                    {form.pending ? t("doctorClinical.decisionForm.recording") : t("doctorClinical.decisionForm.record")}
                </Button>
            </div>
        </form>
    );
}
