"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tone } from "@/components/ui/tone";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveTacticReviewsAction } from "@/lib/actions/bout-analysis";
import { isPrefilled, reportedOutcome, TACTIC_REVIEW_NOTE_MAX, type ReportTactic } from "@/lib/domain/bout-report";
import { tacticOutcomeSchema, type TacticOutcome } from "@/lib/domain/round-advice";
import { useNotify } from "../../use-notify";

const OUTCOME_TONE: Record<TacticOutcome, Tone> = { EFFECTIVE: "success", INEFFECTIVE: "danger", NOT_USED: "neutral" };

/** One square per round the tactic was marked in: green where it worked, red where it didn't. */
function RoundPips({ effective, ineffective, label }: { effective: number; ineffective: number; label: string }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-fg-muted">
            {effective + ineffective > 0 && (
                <span aria-hidden className="flex gap-1">
                    {Array.from({ length: effective }, (_, i) => (
                        <span key={`e${i}`} className="size-2.5 rounded-sm bg-success-solid" />
                    ))}
                    {Array.from({ length: ineffective }, (_, i) => (
                        <span key={`i${i}`} className="size-2.5 rounded-sm bg-danger-solid" />
                    ))}
                </span>
            )}
            <span>{label}</span>
        </div>
    );
}

/**
 * T-041 §2.1 item 3: every tactic with its round count and the coach's verdict. Only the tactics the coach changed are
 * sent, so the others keep "filled in by the app" until the coach has a different view of them.
 */
export function ReportReviewForm({ boutId, tactics }: { boutId: string; tactics: ReportTactic[] }) {
    const t = useT();
    const notify = useNotify();
    const form = useActionForm(saveTacticReviewsAction, {
        id: "tactic-review",
        onSuccess: notify,
        prepare(fd) {
            const changed = tactics.filter(
                (tactic) =>
                    fd.get(`outcome_${tactic.id}`) !== (reportedOutcome(tactic) ?? "NOT_USED") ||
                    String(fd.get(`note_${tactic.id}`) ?? "").trim() !== (tactic.review?.note ?? ""),
            );
            if (changed.length === 0) return { status: "error", message: t("boutAnalysis.report.review.nothingChanged") };
            fd.delete("tacticId");
            for (const tactic of changed) fd.append("tacticId", tactic.id);
        },
    });

    return (
        <form {...form.formProps} className="flex min-w-0 flex-col gap-4">
            <input type="hidden" name="boutId" value={boutId} />
            <ul className="flex min-w-0 flex-col divide-y divide-border">
                {tactics.map((tactic) => {
                    const outcome = reportedOutcome(tactic);
                    const outcomeControl = form.control(`outcome_${tactic.id}`);
                    const noteControl = form.control(`note_${tactic.id}`);
                    return (
                        <li key={tactic.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
                            <input type="hidden" name="tacticId" value={tactic.id} />
                            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                <p className="min-w-0 text-sm font-semibold break-words text-fg">{tactic.text}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge tone={outcome ? OUTCOME_TONE[outcome] : "neutral"}>
                                        {outcome ? t(`boutAnalysis.rounds.tacticMark.${outcome}`) : t("boutAnalysis.report.noOutcome")}
                                    </Badge>
                                    {isPrefilled(tactic) && (
                                        <Badge tone="info" variant="outline">
                                            {t("boutAnalysis.report.prefilled")}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <RoundPips
                                effective={tactic.effectiveRounds}
                                ineffective={tactic.ineffectiveRounds}
                                label={t("boutAnalysis.report.tacticRounds", {
                                    effective: tactic.effectiveRounds,
                                    ineffective: tactic.ineffectiveRounds,
                                })}
                            />
                            <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                                <Field label={t("boutAnalysis.report.review.outcomeLabel")} htmlFor={outcomeControl.id}>
                                    <Select {...outcomeControl} defaultValue={outcome ?? "NOT_USED"}>
                                        {tacticOutcomeSchema.options.map((value) => (
                                            <option key={value} value={value}>
                                                {t(`boutAnalysis.rounds.tacticMark.${value}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field
                                    label={t("boutAnalysis.report.review.noteLabel")}
                                    htmlFor={noteControl.id}
                                    error={form.error(noteControl.name)}
                                    optional
                                >
                                    <Textarea
                                        {...noteControl}
                                        rows={2}
                                        maxLength={TACTIC_REVIEW_NOTE_MAX}
                                        defaultValue={tactic.review?.note ?? ""}
                                        placeholder={t("boutAnalysis.report.review.notePlaceholder")}
                                    />
                                </Field>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <FormMessage {...form.message} />
            <div className="flex justify-end">
                <SubmitButton pending={form.pending} pendingLabel={t("boutAnalysis.report.review.saving")}>
                    {t("boutAnalysis.report.review.submit")}
                </SubmitButton>
            </div>
        </form>
    );
}
