"use client";

import { Check, PenLine, UserX } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { useT } from "@/components/i18n/locale-provider";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { FIX_FIELDS, type ActionState } from "@/lib/actions/state";
import { FINDING_CATEGORY_LABELS, STRIKE_TYPES, TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { AIFinding, Detection, ReviewDecision } from "@/lib/domain/types";
import { formatTimestamp } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import { useReview } from "./review-context";
import { confidencePhrase, findingCategoryLabel, possibleStrike, storedLabel } from "./video-copy";

export type ReviewTarget = { kind: "finding"; finding: AIFinding } | { kind: "detection"; detection: Detection };

function decisionOptions(t: Translator): ChoiceOption<ReviewDecision>[] {
    return [
        { value: "confirmed", label: t("screens.video.confirm"), icon: Check, tone: "success", description: t("screens.video.dialog.confirmDesc") },
        { value: "corrected", label: t("screens.video.correct"), icon: PenLine, tone: "info", description: t("screens.video.dialog.correctDesc") },
        { value: "rejected", label: t("screens.video.reject"), icon: UserX, tone: "danger", description: t("screens.video.dialog.rejectDesc") },
    ];
}

function submitLabel(t: Translator, decision: ReviewDecision): string {
    return decision === "confirmed" ? t("screens.video.confirm") : decision === "corrected" ? t("screens.video.dialog.saveCorrection") : t("screens.video.reject");
}

/** Correction labels are saved in English (the model's training vocabulary) and shown in the viewer's language. */
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
    const t = useT();
    const [decision, setDecision] = useState<ReviewDecision>(initialDecision);

    const isFinding = target.kind === "finding";
    const existing = isFinding ? target.finding.review : target.detection.review;
    const aiLabel = isFinding ? FINDING_CATEGORY_LABELS[target.finding.category] : TECHNIQUE_LABELS[target.detection.type];
    const aiLabelShown = isFinding ? findingCategoryLabel(t, target.finding.category) : storedLabel(t, aiLabel);
    const [correctedLabel, setCorrectedLabel] = useState(existing?.correctedLabel ?? "");
    const labelOptions = (isFinding ? FINDING_LABELS : DETECTION_LABELS).filter((label) => label !== aiLabel).map((label) => ({ value: label, label: storedLabel(t, label) }));

    /** Client checks run before saving, so nothing typed is lost when one fails. */
    const prepare = (fd: FormData): ActionState | void => {
        const fieldErrors: Record<string, string> = {};
        if (decision === "corrected" && !fd.get("correctedLabel")) fieldErrors.correctedLabel = t("screens.video.dialog.chooseLabel");
        if (decision === "rejected" && !String(fd.get("note") ?? "").trim()) fieldErrors.note = t("screens.video.dialog.explainReject");
        if (Object.keys(fieldErrors).length > 0) return { status: "error", message: FIX_FIELDS, fieldErrors };
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
        : t("screens.video.dialog.subject", { strike: possibleStrike(t, target.detection.type), time: formatTimestamp(target.detection.peakMs), confidence: confidencePhrase(t, target.detection) });

    return (
        <ActionDialog
            open={open}
            onClose={onClose}
            title={isFinding ? t("screens.video.dialog.reviewFinding") : t("screens.video.dialog.reviewDetection")}
            description={subject}
            size="md"
            action={save}
            prepare={prepare}
            onSuccess={(result) => toast({ title: t("screens.video.reviewSaved"), description: result.message })}
            submitLabel={submitLabel(t, decision)}
            pendingLabel={t("screens.video.saving")}
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
                            legend={t("screens.video.dialog.decision")}
                            required
                            columns={3}
                            options={decisionOptions(t)}
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
                                legend={t("screens.video.dialog.correctLabel")}
                                required
                                variant="compact"
                                columns={2}
                                hint={t("screens.video.dialog.aiSaid", { label: aiLabelShown })}
                                options={labelOptions}
                                value={correctedLabel}
                                onChange={setCorrectedLabel}
                                error={form.error("correctedLabel")}
                            />
                        )}

                        <Field
                            label={t("screens.video.dialog.note")}
                            htmlFor={note.id}
                            required={decision === "rejected"}
                            optional={decision !== "rejected"}
                            hint={decision === "rejected" ? t("screens.video.dialog.noteRejectHint") : t("screens.video.dialog.noteHint")}
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
