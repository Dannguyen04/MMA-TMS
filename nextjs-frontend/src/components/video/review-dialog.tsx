"use client";

import { Check, PenLine, UserX } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/state";
import { FINDING_CATEGORY_LABELS, STRIKE_TYPES, TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { AIFinding, Detection, ReviewDecision } from "@/lib/domain/types";
import { formatConfidence, formatTimestamp } from "@/lib/format";
import { strikeObservation } from "@/lib/video/analysis-nav";
import { useReview } from "./review-context";

export type ReviewTarget = { kind: "finding"; finding: AIFinding } | { kind: "detection"; detection: Detection };

const DECISION_OPTIONS: ChoiceOption<ReviewDecision>[] = [
    { value: "confirmed", label: "Confirm", icon: Check, tone: "success", description: "The AI got it right." },
    { value: "corrected", label: "Correct", icon: PenLine, tone: "info", description: "Right moment, wrong label." },
    { value: "rejected", label: "Reject", icon: UserX, tone: "danger", description: "Nothing like this happened." },
];

const SUBMIT_LABELS: Record<ReviewDecision, string> = { confirmed: "Confirm", corrected: "Save correction", rejected: "Reject" };

const FINDING_LABELS = [...TECHNIQUES.map((t) => TECHNIQUE_LABELS[t]), FINDING_CATEGORY_LABELS.movement_quality];
const DETECTION_LABELS = STRIKE_TYPES.map((t) => TECHNIQUE_LABELS[t]);

export interface ReviewDialogProps {
    open: boolean;
    onClose: () => void;
    target: ReviewTarget;
    initialDecision: ReviewDecision;
}

/** Confirm / correct / reject an AI finding or detection. The note is required when rejecting. */
export function ReviewDialog({ open, onClose, target, initialDecision }: ReviewDialogProps) {
    const review = useReview();
    const toast = useToast();
    const [decision, setDecision] = useState<ReviewDecision>(initialDecision);

    const isFinding = target.kind === "finding";
    const existing = isFinding ? target.finding.review : target.detection.review;
    const aiLabel = isFinding ? FINDING_CATEGORY_LABELS[target.finding.category] : TECHNIQUE_LABELS[target.detection.type];
    const [correctedLabel, setCorrectedLabel] = useState(existing?.correctedLabel ?? "");
    const labelOptions = (isFinding ? FINDING_LABELS : DETECTION_LABELS).filter((label) => label !== aiLabel).map((label) => ({ value: label, label }));

    /** Client checks run before saving, so nothing typed is lost when one fails. */
    const prepare = (fd: FormData): ActionState | void => {
        const fieldErrors: Record<string, string> = {};
        if (decision === "corrected" && !fd.get("correctedLabel")) fieldErrors.correctedLabel = "Choose the correct label.";
        if (decision === "rejected" && !String(fd.get("note") ?? "").trim()) fieldErrors.note = "Explain why this is wrong — it helps retrain the model.";
        if (Object.keys(fieldErrors).length > 0) return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
    };

    /** Errors stay inside the dialog; the success toast fires once it has closed (see `onSuccess`). */
    const save = async (_previous: ActionState, fd: FormData): Promise<ActionState> => {
        const { status, message, fieldErrors } = isFinding
            ? await review.submitFindingReview(fd, { report: false })
            : await review.submitDetectionReview(fd, { report: false });
        return { status, message, fieldErrors };
    };

    const subject = isFinding
        ? target.finding.title
        : `${strikeObservation(target.detection.type)} at ${formatTimestamp(target.detection.peakMs)} · ${formatConfidence(target.detection.confidence)} confidence`;

    return (
        <ActionDialog
            open={open}
            onClose={onClose}
            title={isFinding ? "Review AI finding" : "Review detection"}
            description={subject}
            size="md"
            action={save}
            prepare={prepare}
            onSuccess={(result) => toast({ title: "Review saved", description: result.message })}
            submitLabel={SUBMIT_LABELS[decision]}
            pendingLabel="Saving…"
            submitVariant={decision === "rejected" ? "danger" : "primary"}
        >
            {(form) => {
                const note = form.control("note", { hint: true, required: decision === "rejected" });
                return (
                    <>
                        <input type="hidden" name="analysisId" value={review.analysisId} />
                        <input type="hidden" name={isFinding ? "findingId" : "detectionId"} value={isFinding ? target.finding.id : target.detection.id} />

                        <ChoiceGroup
                            id={form.control("decision").id}
                            name="decision"
                            legend="Your decision"
                            required
                            columns={3}
                            options={DECISION_OPTIONS}
                            value={decision}
                            onChange={(next) => {
                                setDecision(next);
                                form.markEdited("correctedLabel");
                                form.markEdited("note");
                            }}
                        />

                        {decision === "corrected" && (
                            <ChoiceGroup
                                id={form.control("correctedLabel").id}
                                name="correctedLabel"
                                legend="Correct label"
                                required
                                variant="compact"
                                columns={2}
                                hint={`The AI said “${aiLabel}”.`}
                                options={labelOptions}
                                value={correctedLabel}
                                onChange={setCorrectedLabel}
                                error={form.error("correctedLabel")}
                            />
                        )}

                        <Field
                            label="Note"
                            htmlFor={note.id}
                            required={decision === "rejected"}
                            optional={decision !== "rejected"}
                            hint={decision === "rejected" ? "Say what actually happened, e.g. “Feint only — no strike was thrown.”" : "Visible to the fighter with your decision."}
                            error={form.error("note")}
                        >
                            <Textarea {...note} rows={3} maxLength={500} defaultValue={existing?.note ?? ""} />
                        </Field>
                    </>
                );
            }}
        </ActionDialog>
    );
}
