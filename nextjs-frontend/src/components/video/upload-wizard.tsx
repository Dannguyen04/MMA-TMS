"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage, focusFirstInvalid } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/state";
import { createUpload, registerExternalUpload, type UploadActionData } from "@/lib/actions/video";
import { VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import { clamp, cn, round } from "@/lib/utils";
import type { AIJobPollResponse } from "@/lib/video/job-progress";
import { DetailsStep } from "./upload-details-step";
import { FootageStep } from "./upload-footage-step";
import { RunStep, type RunPhase } from "./upload-run-step";
import type { UploadWizardData } from "./upload-wizard-data";
import {
    defaultTitle,
    durationProblem,
    effectiveDuration,
    EMPTY_FOOTAGE,
    fileProblem,
    fileSizeMb,
    readVideoDuration,
    type DetailsState,
    type FootageState,
} from "./upload-wizard-state";

type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string; description: string }[] = [
    { step: 1, label: "Footage", description: "Choose the video" },
    { step: 2, label: "Details", description: "Fighter, type and angle" },
    { step: 3, label: "Upload & analyse", description: "AI processing" },
];

const FILE_FIELDS = new Set(["file", "fileName", "fileSizeMb", "durationSec"]);

export interface UploadWizardProps extends UploadWizardData {
    role: "fighter" | "coach";
    viewerId: string;
    initialFighterId: string | null;
    initialSessionId: string | null;
    cancelHref: string;
}

/** Three-step upload: footage → details → upload & AI analysis. "Upload another" starts a fresh instance. */
export function UploadWizard(props: UploadWizardProps) {
    const [instance, setInstance] = useState(0);
    return <WizardFlow key={instance} {...props} onReset={() => setInstance((n) => n + 1)} />;
}

type Transfer = { kind: "ready" } | { kind: "uploading"; pct: number | null } | { kind: "failed"; message: string } | { kind: "submitted" };

function WizardFlow({
    role,
    viewerId,
    fighters,
    sessions,
    settings,
    mode,
    now,
    initialFighterId,
    initialSessionId,
    cancelHref,
    onReset,
}: UploadWizardProps & { onReset: () => void }) {
    const toast = useToast();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const stepRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number | undefined>(undefined);
    const cancelledRef = useRef(false);
    const firstRender = useRef(true);

    const initialFighter = fighters.find((f) => f.id === initialFighterId) ?? (role === "fighter" ? fighters[0] : undefined);
    const initialSession = sessions.find((s) => s.id === initialSessionId && s.fighterId === initialFighter?.id);
    const initialType = initialSession ? VIDEO_TRAINING_TYPES.find((t) => t === initialSession.type) : undefined;

    const [step, setStep] = useState<Step>(1);
    const [footage, setFootage] = useState<FootageState>(EMPTY_FOOTAGE);
    const [footageError, setFootageError] = useState<string | null>(null);
    const [details, setDetails] = useState<DetailsState>({
        fighterId: initialFighter?.id ?? "",
        trainingType: initialType ?? "",
        cameraAngle: "",
        sessionId: initialSession?.id ?? "",
        title: defaultTitle(initialType ?? "", now),
        titleEdited: false,
        notes: "",
    });
    const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
    /** Server field errors kept while the user goes back to fix them. */
    const [savedServerErrors, setSavedServerErrors] = useState<Record<string, string>>({});
    const [transfer, setTransfer] = useState<Transfer>({ kind: "ready" });
    const [outcome, setOutcome] = useState<AIJobPollResponse | null>(null);
    const [restartKey, setRestartKey] = useState(0);
    /** Bumped after a failed step check so focus moves to the first problem. */
    const [invalidAttempt, setInvalidAttempt] = useState(0);
    const [uploadState, submitUpload, registering] = useActionState<ActionState<UploadActionData>, FormData>(mode === "api" ? registerExternalUpload : createUpload, { status: "idle" });

    useEffect(() => () => window.clearInterval(timerRef.current), []);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        headingRef.current?.focus();
    }, [step]);

    // Declared after the heading effect so it wins when a failed check also changes the step.
    useEffect(() => {
        if (invalidAttempt === 0) return;
        const frame = window.requestAnimationFrame(() => focusFirstInvalid(stepRef.current));
        return () => window.cancelAnimationFrame(frame);
    }, [invalidAttempt]);

    /* ─── Derived state ─────────────────────────────────────────────────── */

    const duration = effectiveDuration(footage);
    const serverErrors = transfer.kind === "submitted" && uploadState.status === "error" ? (uploadState.fieldErrors ?? {}) : {};
    const visibleServerErrors = { ...savedServerErrors, ...serverErrors };
    const serverFileError = Object.entries(visibleServerErrors).find(([key]) => FILE_FIELDS.has(key))?.[1] ?? null;
    const fighter = fighters.find((f) => f.id === details.fighterId);

    let phase: RunPhase = { kind: "ready" };
    if (transfer.kind === "uploading") phase = { kind: "uploading", pct: transfer.pct };
    else if (transfer.kind === "failed") phase = { kind: "upload_failed", message: transfer.message, editableStep: null };
    else if (transfer.kind === "submitted") {
        if (registering || uploadState.status === "idle") phase = { kind: "registering" };
        else if (uploadState.status === "error") {
            const keys = Object.keys(serverErrors);
            phase = {
                kind: "upload_failed",
                message: uploadState.message ?? "The upload couldn't be saved.",
                editableStep: keys.some((k) => FILE_FIELDS.has(k)) ? 1 : keys.length > 0 ? 2 : null,
            };
        } else if (uploadState.data) {
            const { data } = uploadState;
            if (outcome?.job.status === "completed") phase = { kind: "completed", href: data.href };
            else if (outcome?.job.status === "failed") phase = { kind: "analysis_failed", videoId: data.videoId, job: outcome.job, href: data.href };
            else phase = { kind: "processing", jobId: data.jobId, restartKey };
        }
    }
    const locked = phase.kind === "uploading" || phase.kind === "registering" || phase.kind === "processing" || phase.kind === "completed" || phase.kind === "analysis_failed";

    /* ─── Validation & navigation ───────────────────────────────────────── */

    const validateFootage = (): boolean => {
        if (!footage.file) {
            setFootageError("Choose a video file to continue.");
            return false;
        }
        if (footage.durationStatus === "reading") {
            setFootageError("Still reading the video length — try again in a moment.");
            return false;
        }
        const problem = fileProblem(footage.file, settings) ?? durationProblem(duration);
        setFootageError(problem);
        return problem === null;
    };

    const validateDetails = (): boolean => {
        const errors: Record<string, string> = {};
        if (!details.fighterId) errors.fighterId = "Choose the fighter in this video.";
        if (!details.trainingType) errors.trainingType = "Choose the type of training in the video.";
        if (!details.cameraAngle) errors.cameraAngle = "Choose the camera angle.";
        if (details.title.trim().length < 3) errors.title = "Give the video a title of at least 3 characters.";
        setDetailErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const failStep = (target: Step) => {
        setStep(target);
        setInvalidAttempt((n) => n + 1);
    };

    const goTo = (target: Step) => {
        if (locked) return;
        if (target > 1 && !validateFootage()) return failStep(1);
        if (target > 2 && !validateDetails()) return failStep(2);
        setStep(target);
    };

    /* ─── File selection ────────────────────────────────────────────────── */

    const selectFile = async (file: File) => {
        const problem = fileProblem(file, settings);
        setFootage({ ...EMPTY_FOOTAGE, file, durationStatus: problem ? "idle" : "reading" });
        setFootageError(problem);
        setSavedServerErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !FILE_FIELDS.has(key))));
        if (transfer.kind !== "ready") setTransfer({ kind: "ready" });
        if (problem) return;
        const seconds = await readVideoDuration(file);
        setFootage((current) =>
            current.file === file
                ? { ...current, durationSec: seconds === null ? null : round(seconds, 1), durationStatus: seconds === null ? "unreadable" : "read" }
                : current,
        );
        if (seconds !== null) setFootageError(durationProblem(seconds));
    };

    const updateDetails = (patch: Partial<DetailsState>) => {
        setDetails((current) => {
            const next = { ...current, ...patch };
            if (patch.trainingType !== undefined && !next.titleEdited) next.title = defaultTitle(next.trainingType, now);
            return next;
        });
        // A chosen training type also fills in the default title, so its error clears too.
        const cleared = new Set([...Object.keys(patch), ...(patch.trainingType !== undefined && !details.titleEdited ? ["title"] : [])]);
        const withoutPatched = (current: Record<string, string>) => Object.fromEntries(Object.entries(current).filter(([key]) => !cleared.has(key)));
        setDetailErrors(withoutPatched);
        setSavedServerErrors(withoutPatched);
    };

    /* ─── Upload ────────────────────────────────────────────────────────── */

    const buildFormData = (): FormData | null => {
        if (!footage.file || !details.trainingType || !details.cameraAngle || duration === null) return null;
        const formData = new FormData();
        formData.set("fighterId", details.fighterId);
        formData.set("title", details.title.trim());
        formData.set("trainingType", details.trainingType);
        formData.set("cameraAngle", details.cameraAngle);
        formData.set("fileName", footage.file.name);
        formData.set("fileSizeMb", String(round(fileSizeMb(footage.file), 2)));
        formData.set("durationSec", String(Math.round(duration)));
        formData.set("sessionId", details.sessionId);
        formData.set("notes", details.notes);
        return formData;
    };

    const submit = (formData: FormData) => {
        setTransfer({ kind: "submitted" });
        startTransition(() => submitUpload(formData));
    };

    const start = async () => {
        if (!validateFootage()) return failStep(1);
        if (!validateDetails()) return failStep(2);
        const formData = buildFormData();
        const file = footage.file;
        if (!formData || !file) return;
        setOutcome(null);
        setSavedServerErrors({});
        cancelledRef.current = false;

        if (mode === "mock") {
            const sizeMb = Math.max(0.1, fileSizeMb(file));
            const perTick = clamp(((48 * 0.12) / sizeMb) * 100, 2.2, 7);
            let pct = 0;
            setTransfer({ kind: "uploading", pct: 0 });
            window.clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
                pct = Math.min(100, pct + perTick * (0.6 + Math.random() * 0.8));
                if (pct >= 100) {
                    window.clearInterval(timerRef.current);
                    submit(formData);
                } else {
                    setTransfer({ kind: "uploading", pct });
                }
            }, 120);
            return;
        }

        setTransfer({ kind: "uploading", pct: null });
        try {
            const [{ uploadVideoToStorage }, { createJob }] = await Promise.all([import("@/lib/api/storage"), import("@/lib/api/jobs-client")]);
            const stored = await uploadVideoToStorage(file);
            if (cancelledRef.current) return;
            const { jobId } = await createJob({ videoUrl: stored.publicUrl, userId: viewerId });
            if (cancelledRef.current) return;
            formData.set("sourceUrl", stored.publicUrl);
            formData.set("externalJobId", jobId);
            submit(formData);
        } catch (error) {
            if (!cancelledRef.current) setTransfer({ kind: "failed", message: error instanceof Error ? error.message : "The upload failed. Check your connection and try again." });
        }
    };

    const cancelUpload = () => {
        window.clearInterval(timerRef.current);
        cancelledRef.current = true;
        setTransfer({ kind: "ready" });
        toast({ tone: "info", title: "Upload cancelled", description: "Nothing was saved. Your details are still filled in." });
    };

    const onSettled = (response: AIJobPollResponse) => {
        setOutcome(response);
        if (response.job.status === "completed") toast({ title: "AI analysis ready", description: `“${details.title}” is ready to review.` });
        else toast({ tone: "error", title: "AI analysis didn't finish", description: "See the details below to retry." });
    };

    const summaryReady = footage.file && details.trainingType && details.cameraAngle && duration !== null;
    const visibleDetailErrors = { ...visibleServerErrors, ...detailErrors };
    const detailErrorCount = Object.keys(visibleDetailErrors).filter((key) => !FILE_FIELDS.has(key)).length;
    const needsFile = step === 1 && !footage.file;

    return (
        <Card className="mx-auto w-full max-w-4xl overflow-hidden">
            <nav aria-label="Upload steps" className="border-b border-border bg-surface-muted/50 px-3 py-3 sm:px-5">
                <ol className="grid grid-cols-3 gap-2">
                    {STEPS.map(({ step: n, label, description }) => {
                        const current = step === n;
                        const done = n < step || (n === 3 && phase.kind === "completed");
                        return (
                            <li key={n} aria-current={current ? "step" : undefined} className="min-w-0">
                                <button
                                    type="button"
                                    onClick={() => goTo(n)}
                                    disabled={locked || n === step}
                                    className={cn(
                                        "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:cursor-default",
                                        !locked && n !== step && "hover:bg-surface-hover",
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1",
                                            current ? "bg-primary text-primary-fg ring-primary" : done ? "bg-success-soft text-success-fg ring-success-border" : "bg-surface text-fg-muted ring-border",
                                        )}
                                    >
                                        {done && !current ? <Check className="size-4" /> : n}
                                    </span>
                                    <span className="min-w-0">
                                        <span className={cn("block truncate text-sm font-semibold", current ? "text-fg" : "text-fg-muted max-sm:sr-only")}>{label}</span>
                                        <span className="block truncate text-xs text-fg-subtle max-md:hidden">{description}</span>
                                    </span>
                                    <span className="sr-only">{done ? "(completed)" : current ? "(current step)" : ""}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <div ref={stepRef} className="px-4 py-5 sm:px-6 sm:py-6">
                <h2 ref={headingRef} tabIndex={-1} className="mb-1 text-lg font-semibold text-fg focus:outline-none">
                    {step === 1 ? "Choose the footage" : step === 2 ? "Describe the session" : "Upload and analyse"}
                </h2>
                <p className="mb-5 text-sm text-fg-muted">
                    {step === 1
                        ? "Pick a clip from your device. Nothing is uploaded until the last step."
                        : step === 2
                          ? "This tells the AI what to look for and helps your team find the video later."
                          : "Check the details, then upload. The AI analysis starts as soon as the upload finishes."}
                </p>

                {step === 1 && (
                    <FootageStep
                        footage={footage}
                        limits={settings}
                        error={footageError ?? serverFileError}
                        onSelect={selectFile}
                        onRemove={() => {
                            setFootage(EMPTY_FOOTAGE);
                            setFootageError(null);
                        }}
                        onManualDuration={(value) => {
                            setFootage((current) => ({ ...current, manualDurationSec: value }));
                            setFootageError(null);
                        }}
                    />
                )}
                {step === 2 && (
                    <div className="flex flex-col gap-5">
                        {detailErrorCount > 0 && (
                            <FormMessage
                                status="error"
                                message={detailErrorCount === 1 ? "Fix the highlighted detail to continue." : `Fix the ${detailErrorCount} highlighted details to continue.`}
                            />
                        )}
                        <DetailsStep role={role} details={details} fighters={fighters} sessions={sessions} errors={visibleDetailErrors} onChange={updateDetails} />
                    </div>
                )}
                {step === 3 && summaryReady && footage.file && details.trainingType && details.cameraAngle && duration !== null && (
                    <RunStep
                        phase={phase}
                        now={now}
                        summary={{
                            fileName: footage.file.name,
                            sizeMb: fileSizeMb(footage.file),
                            durationSec: duration,
                            fighterName: fighter?.name ?? "",
                            trainingType: details.trainingType,
                            cameraAngle: details.cameraAngle,
                            title: details.title.trim(),
                        }}
                        onStart={start}
                        onCancelUpload={cancelUpload}
                        onEditStep={(target) => {
                            setSavedServerErrors(visibleServerErrors);
                            setTransfer({ kind: "ready" });
                            setStep(target);
                        }}
                        onSettled={onSettled}
                        onRetried={() => {
                            setOutcome(null);
                            setRestartKey((k) => k + 1);
                        }}
                        onReset={onReset}
                    />
                )}
            </div>

            {!locked && (
                <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-4 py-3 sm:px-6">
                    {step === 1 ? (
                        <ButtonLink href={cancelHref} variant="ghost">
                            Cancel
                        </ButtonLink>
                    ) : (
                        <Button variant="secondary" onClick={() => setStep((step - 1) as Step)}>
                            <ArrowLeft aria-hidden />
                            Back
                        </Button>
                    )}
                    {step < 3 && (
                        <div className="flex min-w-0 items-center gap-3">
                            {needsFile && (
                                <p id="upload-next-hint" className="text-[13px] text-fg-muted max-sm:hidden">
                                    Choose a video to continue.
                                </p>
                            )}
                            <Button
                                variant={needsFile ? "secondary" : "primary"}
                                aria-disabled={needsFile || undefined}
                                aria-describedby={needsFile ? "upload-next-hint" : undefined}
                                onClick={() => goTo((step + 1) as Step)}
                            >
                                Next: {STEPS[step].label}
                                <ArrowRight aria-hidden />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
