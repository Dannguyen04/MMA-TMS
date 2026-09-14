"use client";

import { CircleCheck, CloudUpload, PenLine, RotateCcw, Sparkles, TriangleAlert, Upload, X } from "lucide-react";
import { useState } from "react";

import { Callout } from "@/components/training/callout";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DescriptionList } from "@/components/ui/description-list";
import { FormMessage } from "@/components/ui/form";
import { ProgressBar, ProgressIndeterminate } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { retryAnalysis } from "@/lib/actions/video";
import { CAMERA_ANGLE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { AIJob, CameraAngle, VideoTrainingType } from "@/lib/domain/types";
import { formatClock, formatFileSize, formatNumber } from "@/lib/format";
import type { AIJobPollResponse } from "@/lib/video/job-progress";
import { describeJobFailure } from "./job-failure";
import { PipelineProgress } from "./pipeline-progress";

export type RunPhase =
    | { kind: "ready" }
    | { kind: "uploading"; pct: number | null }
    | { kind: "registering" }
    | { kind: "upload_failed"; message: string; editableStep: 1 | 2 | null }
    | { kind: "processing"; jobId: string; restartKey: number }
    | { kind: "completed"; href: string }
    | { kind: "analysis_failed"; videoId: string; job: AIJob; href: string };

export interface RunSummary {
    fileName: string;
    sizeMb: number;
    durationSec: number;
    fighterName: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    title: string;
}

export interface RunStepProps {
    phase: RunPhase;
    summary: RunSummary;
    now: string;
    onStart: () => void;
    onCancelUpload: () => void;
    onEditStep: (step: 1 | 2) => void;
    onSettled: (response: AIJobPollResponse) => void;
    onRetried: () => void;
    onReset: () => void;
}

/** Step 3: upload progress, live AI pipeline progress and the outcome. */
export function RunStep({ phase, summary, now, onStart, onCancelUpload, onEditStep, onSettled, onRetried, onReset }: RunStepProps) {
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);

    const facts = (
        <DescriptionList
            columns={2}
            className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3.5"
            items={[
                { label: "Title", value: summary.title, wide: true },
                { label: "Fighter", value: summary.fighterName },
                { label: "Training type", value: TRAINING_TYPE_LABELS[summary.trainingType] },
                { label: "Camera angle", value: CAMERA_ANGLE_LABELS[summary.cameraAngle] },
                { label: "File", value: `${summary.fileName} · ${formatFileSize(summary.sizeMb)} · ${formatClock(summary.durationSec)}` },
            ]}
        />
    );

    if (phase.kind === "completed") {
        return (
            <div role="status" className="flex flex-col items-center gap-4 rounded-xl border border-success-border bg-success-soft/40 px-6 py-10 text-center">
                <span aria-hidden className="octagon flex size-14 items-center justify-center bg-success-solid text-fg-inverse">
                    <CircleCheck className="size-7" />
                </span>
                <div className="max-w-md">
                    <p className="text-lg font-semibold text-fg">Analysis ready</p>
                    <p className="mt-1 text-sm text-pretty text-fg-muted">
                        “{summary.title}” has been analysed. Open it to replay the strikes the AI detected and review its findings.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    <ButtonLink href={phase.href} size="lg">
                        <Sparkles aria-hidden />
                        Open analysis
                    </ButtonLink>
                    <Button variant="secondary" size="lg" onClick={onReset}>
                        <Upload aria-hidden />
                        Upload another video
                    </Button>
                </div>
            </div>
        );
    }

    if (phase.kind === "analysis_failed") {
        const copy = describeJobFailure(phase.job.errorCode);
        return (
            <div className="flex flex-col gap-5">
                <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger-border bg-danger-soft/40 px-5 py-5">
                    <p className="flex items-center gap-2 text-base font-semibold text-fg">
                        <TriangleAlert aria-hidden className="size-5 text-danger-fg" />
                        {copy.title}
                    </p>
                    <p className="text-sm text-fg-muted">{copy.explanation}</p>
                    <p className="text-sm text-fg">{copy.guidance}</p>
                    <div className="flex flex-wrap gap-2">
                        <form
                            action={async (formData) => {
                                setRetryError(null);
                                const result = await retryAnalysis({ status: "idle" }, formData);
                                if (result.status === "success") onRetried();
                                else setRetryError(result.message ?? "The analysis couldn't be restarted.");
                            }}
                        >
                            <input type="hidden" name="videoId" value={phase.videoId} />
                            <SubmitButton pendingLabel="Queuing…">
                                <RotateCcw aria-hidden />
                                Retry analysis
                            </SubmitButton>
                        </form>
                        <ButtonLink href={phase.href} variant="secondary">
                            View video
                        </ButtonLink>
                        <Button variant="ghost" onClick={onReset}>
                            Upload a different file
                        </Button>
                    </div>
                    <FormMessage status={retryError ? "error" : "idle"} message={retryError ?? undefined} />
                </div>
                {facts}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {facts}

            {phase.kind === "ready" && (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-fg-muted">The upload takes a few seconds; analysis usually finishes in under a minute.</p>
                    <Button size="lg" onClick={onStart}>
                        <CloudUpload aria-hidden />
                        Upload and analyse
                    </Button>
                </div>
            )}

            {phase.kind === "uploading" && (
                <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-4" aria-live="polite">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-fg">Uploading footage</p>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
                            <X aria-hidden />
                            Cancel upload
                        </Button>
                    </div>
                    {phase.pct === null ? (
                        <ProgressIndeterminate label="Uploading footage" />
                    ) : (
                        <ProgressBar
                            value={phase.pct}
                            label="Upload progress"
                            valueText={`${formatNumber((summary.sizeMb * phase.pct) / 100, 1)} of ${formatFileSize(summary.sizeMb)} · ${Math.round(phase.pct)}%`}
                        />
                    )}
                </div>
            )}

            {phase.kind === "registering" && (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-border px-4 py-4 text-sm font-medium text-fg">
                    <Spinner className="text-primary" />
                    Upload complete — starting AI analysis…
                </p>
            )}

            {phase.kind === "processing" && (
                <div className="rounded-xl border border-border px-4 py-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                        <Sparkles aria-hidden className="size-4 text-ai-fg" />
                        AI analysis in progress
                    </p>
                    <PipelineProgress jobId={phase.jobId} initialJob={null} now={now} onSettled={onSettled} restartKey={phase.restartKey} />
                    <p className="mt-3 text-[13px] text-fg-muted">You can leave this page — you&apos;ll get a notification when the analysis is ready.</p>
                </div>
            )}

            {phase.kind === "upload_failed" && (
                <Callout
                    tone="danger"
                    icon={TriangleAlert}
                    role="alert"
                    title="The upload didn't go through"
                    action={
                        phase.editableStep === null ? (
                            <Button onClick={onStart}>
                                <RotateCcw aria-hidden />
                                Try again
                            </Button>
                        ) : (
                            <Button onClick={() => onEditStep(phase.editableStep ?? 2)}>
                                <PenLine aria-hidden />
                                {phase.editableStep === 1 ? "Choose another file" : "Fix the details"}
                            </Button>
                        )
                    }
                >
                    {phase.message}
                </Callout>
            )}

            <ConfirmDialog
                open={confirmCancel}
                onClose={() => setConfirmCancel(false)}
                onConfirm={() => {
                    setConfirmCancel(false);
                    onCancelUpload();
                }}
                title="Cancel this upload?"
                description="The upload stops and nothing is saved or analysed. Your file and details stay filled in so you can start again."
                confirmLabel="Cancel upload"
            />
        </div>
    );
}
