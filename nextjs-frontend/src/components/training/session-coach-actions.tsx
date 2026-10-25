"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Ban, CalendarX2, ClipboardCheck, MessageSquarePlus, PenLine, Play, StickyNote, ThumbsUp, Wrench } from "lucide-react";
import { useRef, useState } from "react";

import { CoachRatingInput } from "@/components/domain/coach-rating";
import { EligibilityReasons } from "@/components/medical/eligibility-reasons";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import type { ActionState } from "@/lib/actions/state";
import { addSessionFeedback, cancelSession, markSessionMissed, recordSessionResult, startSession } from "@/lib/actions/training";
import { feedbackKindLabel } from "@/lib/domain/labels";
import type { EligibilityReason } from "@/lib/domain/medical-contract";
import type { FeedbackKind, SessionResult, Technique } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { RpeSlider } from "./rpe-slider";
import { TechniqueCheckboxes } from "./technique-checkboxes";
import { MID_RPE } from "./training-utils";

type TriggerProps = Pick<ButtonProps, "variant" | "size" | "className">;

/* ─── Record result ───────────────────────────────────────────────────────── */

export interface ResultExercise {
    exerciseId: string;
    name: string;
    completed: boolean;
}

export interface RecordResultButtonProps extends TriggerProps {
    sessionId: string;
    sessionTitle: string;
    plannedDurationMin: number | null;
    targetRpe: number | null;
    plannedRounds: number;
    exercises: ResultExercise[];
    /** Existing result when correcting a completed session. */
    result: SessionResult | null;
    label?: string;
    /** Only what the training service keeps: RPE and rounds (it measures the duration and keeps no rating or summary). */
    serviceForm: boolean;
}

export function RecordResultButton({
    sessionId,
    sessionTitle,
    plannedDurationMin,
    targetRpe,
    plannedRounds,
    exercises,
    result,
    label,
    serviceForm,
    variant = "primary",
    size,
    className,
}: RecordResultButtonProps) {
    const t = useT();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const toast = useToast();
    const correcting = result !== null;

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
                {correcting ? <PenLine aria-hidden /> : <ClipboardCheck aria-hidden />}
                {label ?? (correcting ? t("training.actions.editResult") : t("training.actions.recordResult"))}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={correcting ? t("training.actions.dialogEditTitle") : t("training.actions.dialogRecordTitle")}
                description={t("training.actions.dialogResultDesc", { title: sessionTitle })}
                action={(previous: ActionState, fd: FormData) => recordSessionResult(sessionId, previous, fd)}
                submitLabel={correcting ? t("training.actions.saveResult") : t("training.actions.recordResult")}
                pendingLabel={t("training.actions.saving")}
                onSuccess={(state) => toast({ title: state.message ?? t("training.actions.resultSaved") })}
            >
                {(form) => (
                    <RecordResultFields
                        form={form}
                        plannedDurationMin={plannedDurationMin}
                        targetRpe={targetRpe}
                        plannedRounds={plannedRounds}
                        exercises={exercises}
                        result={result}
                        serviceForm={serviceForm}
                        t={t}
                        locale={locale}
                    />
                )}
            </ActionDialog>
        </>
    );
}

interface RecordResultFieldsProps {
    form: ActionForm<undefined>;
    plannedDurationMin: number | null;
    targetRpe: number | null;
    plannedRounds: number;
    exercises: ResultExercise[];
    result: SessionResult | null;
    serviceForm: boolean;
    t: Translator;
    locale: Locale;
}

function RecordResultFields({ form, plannedDurationMin, targetRpe, plannedRounds, exercises, result, serviceForm, t, locale }: RecordResultFieldsProps) {
    // The slider needs a starting point; with no target it starts mid-scale.
    const [rpe, setRpe] = useState(result?.rpe ?? targetRpe ?? MID_RPE);
    const [rating, setRating] = useState(result?.coachRating ?? 0);
    const [done, setDone] = useState<string[]>(exercises.filter((e) => (result ? e.completed : true)).map((e) => e.exerciseId));
    const { control, error } = form;

    const numberField = (name: "actualDurationMin" | "roundsCompleted", fieldLabel: string, defaultValue: number | undefined, max: number, hint: string) => (
        <Field label={fieldLabel} htmlFor={control(name).id} required error={error(name)} hint={hint}>
            <Input
                {...control(name, { hint, required: true })}
                type="number"
                inputMode="numeric"
                min={name === "roundsCompleted" ? 0 : 1}
                max={max}
                defaultValue={defaultValue}
            />
        </Field>
    );
    const summaryHint = t("training.actions.summaryHint");

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {!serviceForm &&
                    numberField(
                        "actualDurationMin",
                        t("training.actions.actualDuration"),
                        result?.actualDurationMin ?? plannedDurationMin ?? undefined,
                        300,
                        plannedDurationMin === null ? t("training.actions.noPlannedLength") : t("training.actions.plannedMinHint", { min: plannedDurationMin }),
                    )}
                {numberField(
                    "roundsCompleted",
                    t("training.actions.roundsCompleted"),
                    result?.roundsCompleted ?? plannedRounds,
                    100,
                    plannedRounds > 0 ? t("training.actions.plannedRoundsHint", { rounds: plannedRounds }) : t("training.actions.enter0Rounds"),
                )}
            </div>
            <RpeSlider
                id={control("rpe").id}
                name="rpe"
                label={t("training.actions.sessionRpe")}
                value={rpe}
                onChange={setRpe}
                hint={t("training.actions.rpeReportedHint")}
                required
                error={error("rpe")}
            />
            {!serviceForm && (
                <>
                    <CoachRatingInput
                        id={control("coachRating").id}
                        name="coachRating"
                        legend={t("training.actions.ratingLegend")}
                        value={rating}
                        onChange={setRating}
                        error={error("coachRating")}
                        required
                        locale={locale}
                    />
                    <Field label={t("training.actions.summary")} htmlFor={control("summary").id} required error={error("summary")} hint={summaryHint}>
                        <Textarea {...control("summary", { hint: summaryHint, required: true })} rows={3} maxLength={1000} defaultValue={result?.summary ?? ""} />
                    </Field>
                </>
            )}
            {serviceForm && <p className="text-[13px] text-fg-muted">{t("training.actions.serviceLengthMeasured")}</p>}
            {!serviceForm && exercises.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium text-fg">{t("training.actions.exercisesCompletedLegend")}</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {exercises.map((exercise) => (
                            <Checkbox
                                key={exercise.exerciseId}
                                id={control(`exercise-${exercise.exerciseId}`).id}
                                name="completedExerciseIds"
                                value={exercise.exerciseId}
                                checked={done.includes(exercise.exerciseId)}
                                onChange={(event) =>
                                    setDone((current) =>
                                        event.target.checked ? [...current, exercise.exerciseId] : current.filter((id) => id !== exercise.exerciseId),
                                    )
                                }
                                label={exercise.name}
                                className="rounded-lg border border-border px-3 py-2.5"
                            />
                        ))}
                    </div>
                </fieldset>
            )}
        </>
    );
}

/* ─── Start session ───────────────────────────────────────────────────────── */

export interface SessionTransitionButtonProps extends TriggerProps {
    sessionId: string;
    sessionTitle: string;
    fighterName: string;
}

/** Checks the fighter in. A refusal from the fighter's Medical Clearance lists its reasons in the dialog. */
export function StartSessionButton({ sessionId, sessionTitle, fighterName, variant = "primary", size, className }: SessionTransitionButtonProps) {
    const t = useT();
    const toast = useToast();
    const [reasons, setReasons] = useState<EligibilityReason[]>([]);
    const start = useConfirmAction((id: string) => startSession(id), {
        onSuccess: (state) => toast({ title: state.message ?? t("training.actions.sessionStarted") }),
        onError: (state) => setReasons(state.data?.reasons ?? []),
    });

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={() => {
                    setReasons([]);
                    start.request(sessionId);
                }}
            >
                <Play aria-hidden />
                {t("training.actions.startSession")}
            </Button>
            <ConfirmDialog
                {...start.dialogProps}
                title={t("training.actions.startDialogTitle")}
                description={t("training.actions.startDialogDesc", { title: sessionTitle, fighter: fighterName })}
                confirmLabel={t("training.actions.startSession")}
            >
                {reasons.length > 0 && <EligibilityReasons reasons={reasons} />}
            </ConfirmDialog>
        </>
    );
}

/** Records that a scheduled session didn't happen. */
export function MarkMissedButton({ sessionId, sessionTitle, fighterName, variant = "secondary", size, className }: SessionTransitionButtonProps) {
    const t = useT();
    const toast = useToast();
    const miss = useConfirmAction((id: string) => markSessionMissed(id), { onSuccess: (state) => toast({ title: state.message ?? t("training.actions.markedMissed") }) });

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => miss.request(sessionId)}>
                <CalendarX2 aria-hidden />
                {t("training.actions.markMissed")}
            </Button>
            <ConfirmDialog
                {...miss.dialogProps}
                title={t("training.actions.markMissedDialogTitle")}
                description={t("training.actions.markMissedDialogDesc", { title: sessionTitle, fighter: fighterName })}
                confirmLabel={t("training.actions.markMissed")}
            />
        </>
    );
}

/* ─── Cancel session ──────────────────────────────────────────────────────── */

export interface CancelSessionButtonProps extends TriggerProps {
    sessionId: string;
    sessionTitle: string;
    fighterName: string;
    when: string;
}

const REASON_MIN_LENGTH = 5;

export function CancelSessionButton({ sessionId, sessionTitle, fighterName, when, variant = "danger-soft", size, className }: CancelSessionButtonProps) {
    const t = useT();
    const toast = useToast();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const [reason, setReason] = useState("");
    const [reasonEdited, setReasonEdited] = useState(false);

    const cancel = useConfirmAction(
        async (id: string): Promise<ActionState> =>
            reason.trim().length < REASON_MIN_LENGTH
                ? { status: "error", message: t("training.actions.cancelReasonErrorEmpty"), fieldErrors: { reason: t("training.actions.cancelReasonErrorMin") } }
                : cancelSession(id, { reason }),
        {
            onSuccess: (state) => toast({ title: state.message ?? t("training.actions.sessionCancelled") }),
            onError: () => {
                setReasonEdited(false);
                window.requestAnimationFrame(() => reasonRef.current?.focus());
            },
        },
    );
    const reasonError = reasonEdited ? undefined : cancel.fieldErrors.reason;

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={() => {
                    setReason("");
                    setReasonEdited(false);
                    cancel.request(sessionId);
                }}
            >
                <Ban aria-hidden />
                {t("training.actions.cancelSession")}
            </Button>
            <ConfirmDialog
                {...cancel.dialogProps}
                title={t("training.actions.cancelDialogTitle")}
                description={t("training.actions.cancelDialogDesc", { title: sessionTitle, when, fighter: fighterName })}
                confirmLabel={t("training.actions.confirmCancel")}
            >
                <Field label={t("training.actions.cancelReasonLabel")} htmlFor="cancel-reason" required error={reasonError} hint={t("training.actions.cancelReasonHint")}>
                    <Textarea
                        ref={reasonRef}
                        id="cancel-reason"
                        rows={3}
                        maxLength={300}
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setReasonEdited(true);
                        }}
                        required
                    />
                </Field>
            </ConfirmDialog>
        </>
    );
}

/* ─── Feedback ────────────────────────────────────────────────────────────── */

export interface AddFeedbackButtonProps extends TriggerProps {
    sessionId: string;
    fighterName: string;
}

export function AddFeedbackButton({ sessionId, fighterName, variant = "secondary", size, className }: AddFeedbackButtonProps) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
                <MessageSquarePlus aria-hidden />
                {t("training.actions.addFeedback")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={t("training.actions.dialogFeedbackTitle")}
                description={t("training.actions.dialogFeedbackDesc", { name: fighterName })}
                action={(previous: ActionState, fd: FormData) => addSessionFeedback(sessionId, previous, fd)}
                submitLabel={t("training.actions.shareFeedback")}
                pendingLabel={t("training.actions.sharingFeedback")}
                onSuccess={() => toast({ title: t("training.actions.feedbackSharedTitle"), description: t("training.actions.feedbackSharedDesc", { name: fighterName }) })}
            >
                {(form) => <FeedbackFields form={form} t={t} />}
            </ActionDialog>
        </>
    );
}

function FeedbackFields({ form, t }: { form: ActionForm<undefined>; t: Translator }) {
    const [kind, setKind] = useState<FeedbackKind>("correction");
    const [techniques, setTechniques] = useState<Technique[]>([]);
    const hint = t("training.actions.feedbackBodyHint");

    const feedbackKinds: ChoiceOption<FeedbackKind>[] = [
        { value: "praise", label: feedbackKindLabel(t, "praise"), icon: ThumbsUp, tone: "success", description: t("training.actions.feedbackPraiseDesc") },
        { value: "correction", label: feedbackKindLabel(t, "correction"), icon: Wrench, tone: "warning", description: t("training.actions.feedbackCorrectionDesc") },
        { value: "note", label: feedbackKindLabel(t, "note"), icon: StickyNote, tone: "info", description: t("training.actions.feedbackNoteDesc") },
    ];

    return (
        <>
            <ChoiceGroup
                id={form.control("kind").id}
                name="kind"
                legend={t("training.actions.feedbackKind")}
                required
                columns={3}
                value={kind}
                onChange={setKind}
                error={form.error("kind")}
                options={feedbackKinds}
            />
            <TechniqueCheckboxes
                id={form.control("techniques").id}
                name="techniques"
                legend={t("training.actions.feedbackTechniques")}
                optional
                value={techniques}
                onChange={setTechniques}
                error={form.error("techniques")}
            />
            <Field label={t("training.actions.feedbackBody")} htmlFor={form.control("body").id} required error={form.error("body")} hint={hint}>
                <Textarea {...form.control("body", { hint, required: true })} rows={4} maxLength={1000} />
            </Field>
        </>
    );
}
