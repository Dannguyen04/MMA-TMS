"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { AlertTriangle, Ban, CalendarClock, CalendarPlus, CalendarX2, ClipboardCheck, MessageSquarePlus, PenLine, Play, StickyNote, ThumbsUp, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { dayKey, formatDateTime, formatShortDate, formatTime } from "@/lib/format";
import { suggestRescheduleDate, type TrainingBlockingSuspension } from "@/lib/domain/suspension-rules";
import { previewSessionConflicts, rescheduleSession, type SessionFormResult } from "@/lib/actions/training";
import type { ClearanceConflict } from "@/lib/domain/clearance-rules";
import { ClearanceCheckPanel } from "./clearance-check-panel";
import type { TrainingSession } from "@/lib/domain/types";
import { SuspensionBlockCard } from "./suspension-block-card";

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
    defaultOpen?: boolean;
    locale?: Locale;
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
    const [suspensions, setSuspensions] = useState<TrainingBlockingSuspension[]>([]);
    const start = useConfirmAction((id: string) => startSession(id), {
        onSuccess: (state) => toast({ title: state.message ?? t("training.actions.sessionStarted") }),
        onError: (state) => {
            setReasons(state.data?.reasons ?? []);
            setSuspensions(state.data?.suspensions ?? []);
        },
    });

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={() => {
                    setReasons([]);
                    setSuspensions([]);
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
                <div className="flex flex-col gap-3">
                    {reasons.length > 0 && <EligibilityReasons reasons={reasons} />}
                    {suspensions.length > 0 && <SuspensionBlockCard suspensions={suspensions} />}
                </div>
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
    label?: string;
}

const REASON_MIN_LENGTH = 5;

export function CancelSessionButton({ sessionId, sessionTitle, fighterName, when, label, variant = "danger-soft", size, className }: CancelSessionButtonProps) {
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
                {label ?? t("training.actions.cancelSession")}
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

/* ─── Reschedule session ─────────────────────────────────────────────────── */

export interface RescheduleSessionButtonProps extends TriggerProps {
    session: Pick<TrainingSession, "id" | "title" | "scheduledAt" | "fighterId" | "type" | "durationMin" | "location" | "targetRpe" | "notes" | "planId"> & { exercises?: { exerciseId: string }[] };
    conflicts?: ClearanceConflict[];
    defaultAcknowledged?: boolean;
    fighterName?: string;
    suspensions?: readonly {
        endsOn: string;
        requiresClearance: boolean;
        clearedAt?: Date | string | null;
        startsOn?: string;
        deletedAt?: Date | string | null;
    }[];
    label?: string;
    defaultOpen?: boolean;
    locale?: Locale;
}

export function RescheduleSessionButton({
    session,
    fighterName,
    conflicts,
    defaultAcknowledged = false,
    suspensions = [],
    label,
    variant = "primary",
    size,
    className,
    defaultOpen = false,
}: RescheduleSessionButtonProps) {
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const [open, setOpen] = useState(defaultOpen);
    const [acknowledged, setAcknowledged] = useState(defaultAcknowledged);
    const [previewConflicts, setPreviewConflicts] = useState<ClearanceConflict[] | null>(null);

    const suggestion = suggestRescheduleDate(suspensions);
    const initialDate = suggestion.suggestedDate ?? dayKey(session.scheduledAt);
    const initialTime = formatTime(session.scheduledAt);

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
                <CalendarClock aria-hidden className="size-4" />
                {label ?? t("training.actions.reschedule")}
            </Button>
            <ActionDialog<SessionFormResult>
                open={open}
                onClose={() => setOpen(false)}
                size="md"
                title={t("training.actions.rescheduleTitle")}
                description={t("training.actions.rescheduleDesc", { title: session.title })}
                action={(previous: ActionState<SessionFormResult>, fd: FormData) => rescheduleSession(session.id, previous, fd)}
                showMessage={(state) => !state.data?.suspensions?.length}
                submitDisabled={(state) => {
                    const currentConflicts = conflicts ?? previewConflicts ?? state.data?.conflicts ?? [];
                    const blocks = currentConflicts.filter((c) => c.severity === "block");
                    const warnings = currentConflicts.filter((c) => c.severity === "warn");
                    return blocks.length > 0 || (warnings.length > 0 && !acknowledged);
                }}
                submitLabel={t("training.actions.rescheduleConfirm")}
                pendingLabel={t("training.actions.rescheduling")}
                onSuccess={(state) => {
                    toast({ title: state.message ?? t("training.actions.sessionRescheduled") });
                    setOpen(false);
                }}
            >
                {(form) => (
                    <RescheduleFields
                        session={session}
                        fighterName={fighterName}
                        form={form}
                        suggestion={suggestion}
                        initialDate={initialDate}
                        initialTime={initialTime}
                        t={t}
                        locale={locale}
                        conflicts={conflicts ?? previewConflicts ?? form.state.data?.conflicts}
                        acknowledged={acknowledged}
                        onAcknowledgedChange={setAcknowledged}
                        onConflictsChange={setPreviewConflicts}
                    />
                )}
            </ActionDialog>
        </>
    );
}

export function RescheduleFields({
    session,
    fighterName,
    form,
    suggestion,
    initialDate,
    initialTime,
    t,
    locale,
    conflicts: propConflicts,
    acknowledged,
    onAcknowledgedChange,
    onConflictsChange,
}: {
    session?: Pick<TrainingSession, "id" | "fighterId" | "type" | "targetRpe"> & { exercises?: { exerciseId: string }[] };
    fighterName?: string;
    form: ActionForm<SessionFormResult>;
    suggestion: ReturnType<typeof suggestRescheduleDate>;
    initialDate: string;
    initialTime: string;
    t: Translator;
    locale: Locale;
    conflicts?: ClearanceConflict[];
    acknowledged?: boolean;
    onAcknowledgedChange?: (value: boolean) => void;
    onConflictsChange?: (conflicts: ClearanceConflict[]) => void;
}) {
    const [date, setDate] = useState(initialDate);
    const [time, setTime] = useState(initialTime);
    const [internalAck, setInternalAck] = useState(false);
    const [previewConflicts, setPreviewConflicts] = useState<ClearanceConflict[] | null>(null);

    const isAck = acknowledged ?? internalAck;
    const handleAckChange = onAcknowledgedChange ?? setInternalAck;

    const handleDateChange = (val: string) => {
        setDate(val);
        handleAckChange(false);
    };

    const handleTimeChange = (val: string) => {
        setTime(val);
        handleAckChange(false);
    };

    useEffect(() => {
        if (!session?.fighterId || propConflicts !== undefined) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            const exerciseIds = session.exercises?.map((e) => e.exerciseId) ?? [];
            previewSessionConflicts({
                fighterId: session.fighterId,
                type: session.type,
                targetRpe: session.targetRpe ?? MID_RPE,
                exerciseIds,
                date,
                time,
            }).then(
                (result) => {
                    if (cancelled) return;
                    const loadedConflicts = result.data?.conflicts ?? [];
                    setPreviewConflicts(loadedConflicts);
                    onConflictsChange?.(loadedConflicts);
                },
                () => {
                    if (!cancelled) {
                        setPreviewConflicts([]);
                        onConflictsChange?.([]);
                    }
                },
            );
        }, 350);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [session?.fighterId, session?.type, session?.targetRpe, session?.exercises, date, time, propConflicts, onConflictsChange]);

    const activeConflicts = propConflicts ?? previewConflicts ?? form.state.data?.conflicts ?? [];

    return (
        <div className="flex flex-col gap-4">
            {suggestion.awaitingClearance && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warning-border/80 bg-warning-soft/30 p-3 text-xs text-fg">
                    <AlertTriangle className="size-4 shrink-0 text-warning-solid mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed font-medium">
                        {t("training.actions.awaitingClearanceNotice")}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                    label={t("training.actions.rescheduleDate")}
                    htmlFor="reschedule-date"
                    required
                    error={form.error("date")}
                    hint={
                        suggestion.suggestedDate ? (
                            <button
                                type="button"
                                className="inline-flex items-center text-xs font-medium text-primary-soft-fg hover:underline cursor-pointer"
                                onClick={() => handleDateChange(suggestion.suggestedDate!)}
                            >
                                {t("training.actions.useSuggestedDate", {
                                    date: formatShortDate(suggestion.suggestedDate, locale),
                                })}
                            </button>
                        ) : undefined
                    }
                >
                    <Input
                        id="reschedule-date"
                        name="date"
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        required
                    />
                </Field>
                <Field
                    label={t("training.actions.rescheduleTime")}
                    htmlFor="reschedule-time"
                    required
                    error={form.error("time")}
                >
                    <Input
                        id="reschedule-time"
                        name="time"
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        required
                    />
                </Field>
            </div>

            {activeConflicts.length > 0 && (
                <ClearanceCheckPanel
                    status="ready"
                    pending={false}
                    conflicts={activeConflicts}
                    fighterName={fighterName}
                    acknowledged={isAck}
                    onAcknowledgedChange={handleAckChange}
                    acknowledgeLabel={t("training.actions.rescheduleAcknowledge")}
                />
            )}

            {form.state.data?.suspensions && form.state.data.suspensions.length > 0 && (
                <SuspensionBlockCard suspensions={form.state.data.suspensions} locale={locale} />
            )}
        </div>
    );
}

/* ─── Coach Actions Composite ────────────────────────────────────────────── */

export interface SessionCoachActionsProps {
    session: TrainingSession;
    fighterName: string;
    now?: string;
    locale?: Locale;
    suspensions?: readonly {
        endsOn: string;
        requiresClearance: boolean;
        clearedAt?: Date | string | null;
        startsOn?: string;
        deletedAt?: Date | string | null;
    }[];
    recordButton?: React.ReactNode;
    editHref?: string;
    scheduleAgainHref?: string;
}

export function SessionCoachActions({
    session,
    fighterName,
    now = new Date().toISOString(),
    locale = "vi",
    suspensions = [],
    recordButton,
    editHref,
    scheduleAgainHref,
}: SessionCoachActionsProps) {
    const t = useT();
    const transitionProps = { sessionId: session.id, sessionTitle: session.title, fighterName };

    if (session.status === "pending") {
        return (
            <div className="flex flex-wrap items-center gap-2">
                <RescheduleSessionButton
                    session={session}
                    fighterName={fighterName}
                    suspensions={suspensions}
                    variant="primary"
                />
                <CancelSessionButton
                    {...transitionProps}
                    when={formatDateTime(session.scheduledAt, locale)}
                    label={locale === "vi" ? "Huỷ buổi" : undefined}
                    variant="danger-soft"
                />
            </div>
        );
    }

    const scheduled = session.status === "scheduled";
    const active = scheduled || session.status === "in_progress";
    const started = session.scheduledAt <= now;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {scheduleAgainHref && (
                <ButtonLink href={scheduleAgainHref} variant="secondary">
                    <CalendarPlus aria-hidden className="size-4" />
                    {t("training.repeat.scheduleAgain")}
                </ButtonLink>
            )}
            {scheduled && editHref && (
                <ButtonLink href={editHref} variant="secondary">
                    <PenLine aria-hidden className="size-4" />
                    {t("training.sessionPage.edit")}
                </ButtonLink>
            )}
            {scheduled && started && <MarkMissedButton {...transitionProps} />}
            {active && <CancelSessionButton {...transitionProps} when={formatDateTime(session.scheduledAt, locale)} />}
            {recordButton}
            {scheduled && <StartSessionButton {...transitionProps} />}
        </div>
    );
}
