"use client";

import { Ban, ClipboardCheck, MessageSquarePlus, PenLine, StickyNote, ThumbsUp, Wrench } from "lucide-react";
import { useRef, useState } from "react";

import { CoachRatingInput } from "@/components/domain/coach-rating";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import type { ActionState } from "@/lib/actions/state";
import { addSessionFeedback, cancelSession, recordSessionResult } from "@/lib/actions/training";
import type { FeedbackKind, SessionResult, Technique } from "@/lib/domain/types";
import { RpeSlider } from "./rpe-slider";
import { TechniqueCheckboxes } from "./technique-checkboxes";

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
    plannedDurationMin: number;
    targetRpe: number;
    plannedRounds: number;
    exercises: ResultExercise[];
    /** Existing result when correcting a completed session. */
    result: SessionResult | null;
    label?: string;
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
    variant = "primary",
    size,
    className,
}: RecordResultButtonProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();
    const correcting = result !== null;

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
                {correcting ? <PenLine aria-hidden /> : <ClipboardCheck aria-hidden />}
                {label ?? (correcting ? "Edit result" : "Record result")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={correcting ? "Edit session result" : "Record session result"}
                description={`${sessionTitle} — what actually happened. The fighter is notified when you save.`}
                action={(previous: ActionState, fd: FormData) => recordSessionResult(sessionId, previous, fd)}
                submitLabel={correcting ? "Save result" : "Record result"}
                pendingLabel="Saving…"
                onSuccess={(state) => toast({ title: state.message ?? "Result saved." })}
            >
                {(form) => (
                    <RecordResultFields
                        form={form}
                        plannedDurationMin={plannedDurationMin}
                        targetRpe={targetRpe}
                        plannedRounds={plannedRounds}
                        exercises={exercises}
                        result={result}
                    />
                )}
            </ActionDialog>
        </>
    );
}

interface RecordResultFieldsProps {
    form: ActionForm<undefined>;
    plannedDurationMin: number;
    targetRpe: number;
    plannedRounds: number;
    exercises: ResultExercise[];
    result: SessionResult | null;
}

function RecordResultFields({ form, plannedDurationMin, targetRpe, plannedRounds, exercises, result }: RecordResultFieldsProps) {
    const [rpe, setRpe] = useState(result?.rpe ?? targetRpe);
    const [rating, setRating] = useState(result?.coachRating ?? 0);
    const [done, setDone] = useState<string[]>(exercises.filter((e) => (result ? e.completed : true)).map((e) => e.exerciseId));
    const { control, error } = form;

    const numberField = (name: "actualDurationMin" | "roundsCompleted", label: string, defaultValue: number, max: number, hint: string) => (
        <Field label={label} htmlFor={control(name).id} required error={error(name)} hint={hint}>
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
    const summaryHint = "What went well and what to work on. The fighter sees this.";

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {numberField("actualDurationMin", "Actual duration (min)", result?.actualDurationMin ?? plannedDurationMin, 300, `Planned ${plannedDurationMin} min`)}
                {numberField(
                    "roundsCompleted",
                    "Rounds completed",
                    result?.roundsCompleted ?? plannedRounds,
                    100,
                    plannedRounds > 0 ? `Planned ${plannedRounds} rounds` : "Enter 0 if not round-based",
                )}
            </div>
            <RpeSlider
                id={control("rpe").id}
                name="rpe"
                label="Session RPE"
                value={rpe}
                onChange={setRpe}
                hint="Reported by the fighter, from 1 (very easy) to 10 (maximal)."
                required
                error={error("rpe")}
            />
            <CoachRatingInput
                id={control("coachRating").id}
                name="coachRating"
                legend="Your rating of the session"
                value={rating}
                onChange={setRating}
                error={error("coachRating")}
                required
            />
            <Field label="Summary" htmlFor={control("summary").id} required error={error("summary")} hint={summaryHint}>
                <Textarea {...control("summary", { hint: summaryHint, required: true })} rows={3} maxLength={1000} defaultValue={result?.summary ?? ""} />
            </Field>
            {exercises.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium text-fg">Exercises completed</legend>
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

/* ─── Cancel session ──────────────────────────────────────────────────────── */

export interface CancelSessionButtonProps extends TriggerProps {
    sessionId: string;
    sessionTitle: string;
    fighterName: string;
    when: string;
}

const REASON_MIN_LENGTH = 5;
const REASON_HINT = "e.g. Coach unwell — moving pads to Thursday.";

export function CancelSessionButton({ sessionId, sessionTitle, fighterName, when, variant = "danger-soft", size, className }: CancelSessionButtonProps) {
    const toast = useToast();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const [reason, setReason] = useState("");
    const [reasonEdited, setReasonEdited] = useState(false);

    const cancel = useConfirmAction(
        async (id: string): Promise<ActionState> =>
            reason.trim().length < REASON_MIN_LENGTH
                ? { status: "error", message: "Add a reason for the fighter.", fieldErrors: { reason: "Give the fighter a short reason (at least 5 characters)." } }
                : cancelSession(id, { reason }),
        {
            onSuccess: (state) => toast({ title: state.message ?? "Session cancelled." }),
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
                Cancel session
            </Button>
            <ConfirmDialog
                {...cancel.dialogProps}
                title="Cancel this session?"
                description={`${sessionTitle} on ${when} is removed from ${fighterName}'s schedule and they're notified with your reason. This can't be undone — you'd need to schedule a new session.`}
                confirmLabel="Confirm cancellation"
            >
                <Field label="Reason for the fighter" htmlFor="cancel-reason" required error={reasonError} hint={REASON_HINT}>
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

const FEEDBACK_KINDS: ChoiceOption<FeedbackKind>[] = [
    { value: "praise", label: "Praise", icon: ThumbsUp, tone: "success", description: "Something to keep doing" },
    { value: "correction", label: "Correction", icon: Wrench, tone: "warning", description: "Something to fix" },
    { value: "note", label: "Note", icon: StickyNote, tone: "info", description: "Context or reminder" },
];

export function AddFeedbackButton({ sessionId, fighterName, variant = "secondary", size, className }: AddFeedbackButtonProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
                <MessageSquarePlus aria-hidden />
                Add feedback
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title="Add feedback"
                description={`${fighterName} is notified and sees this on the session page.`}
                action={(previous: ActionState, fd: FormData) => addSessionFeedback(sessionId, previous, fd)}
                submitLabel="Share feedback"
                pendingLabel="Sharing…"
                onSuccess={() => toast({ title: "Feedback shared", description: `${fighterName} has been notified.` })}
            >
                {(form) => <FeedbackFields form={form} />}
            </ActionDialog>
        </>
    );
}

function FeedbackFields({ form }: { form: ActionForm<undefined> }) {
    const [kind, setKind] = useState<FeedbackKind>("correction");
    const [techniques, setTechniques] = useState<Technique[]>([]);
    const hint = "Be specific: what you saw, why it matters and what to do next.";

    return (
        <>
            <ChoiceGroup
                id={form.control("kind").id}
                name="kind"
                legend="Kind"
                required
                columns={3}
                value={kind}
                onChange={setKind}
                error={form.error("kind")}
                options={FEEDBACK_KINDS}
            />
            <TechniqueCheckboxes
                id={form.control("techniques").id}
                name="techniques"
                legend="Techniques"
                optional
                value={techniques}
                onChange={setTechniques}
                error={form.error("techniques")}
            />
            <Field label="Feedback" htmlFor={form.control("body").id} required error={form.error("body")} hint={hint}>
                <Textarea {...form.control("body", { hint, required: true })} rows={4} maxLength={1000} />
            </Field>
        </>
    );
}
