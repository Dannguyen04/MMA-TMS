"use client";

import { CircleCheck, CloudUpload, PenLine, RotateCcw, Sparkles, TriangleAlert, Upload, X } from "lucide-react";
import { useState } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DescriptionList } from "@/components/ui/description-list";
import { FormMessage } from "@/components/ui/form";
import { ProgressBar, ProgressIndeterminate } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { retryAnalysis } from "@/lib/actions/video";
import { trainingTypeLabel } from "@/lib/domain/labels";
import type { AIJob, CameraAngle, VideoTrainingType } from "@/lib/domain/types";
import { formatClock, formatFileSize, formatNumber } from "@/lib/format";
import type { AIJobPollResponse } from "@/lib/video/job-progress";
import { describeJobFailure } from "./job-failure";
import { PipelineProgress } from "./pipeline-progress";
import { cameraAngleLabel } from "./video-copy";

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
    /** Offers to run a failed analysis again. */
    canRetry: boolean;
}

/** Step 3: upload progress, live AI pipeline progress and the outcome. */
export function RunStep({ phase, summary, now, onStart, onCancelUpload, onEditStep, onSettled, onRetried, onReset, canRetry }: RunStepProps) {
    const t = useT();
    const locale = useLocale();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);

    const facts = (
        <DescriptionList
            columns={2}
            className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3.5"
            items={[
                { label: t("screens.video.title"), value: summary.title, wide: true },
                { label: t("screens.video.fighter"), value: summary.fighterName },
                { label: t("screens.video.trainingType"), value: trainingTypeLabel(t, summary.trainingType) },
                { label: t("screens.video.cameraAngle"), value: cameraAngleLabel(t, summary.cameraAngle) },
                { label: t("screens.video.fileLabel"), value: `${summary.fileName} · ${formatFileSize(summary.sizeMb)} · ${formatClock(summary.durationSec)}` },
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
                    <p className="text-lg font-semibold text-fg">{t("screens.video.upload.analysisReady")}</p>
                    <p className="mt-1 text-sm text-pretty text-fg-muted">{t("screens.video.upload.analysisReadyDesc", { title: summary.title })}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    <ButtonLink href={phase.href} size="lg">
                        <Sparkles aria-hidden />
                        {t("screens.video.upload.openAnalysis")}
                    </ButtonLink>
                    <Button variant="secondary" size="lg" onClick={onReset}>
                        <Upload aria-hidden />
                        {t("screens.video.upload.uploadAnother")}
                    </Button>
                </div>
            </div>
        );
    }

    if (phase.kind === "analysis_failed") {
        const copy = describeJobFailure(phase.job.errorCode, locale);
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
                        {canRetry && (
                            <form
                                action={async (formData) => {
                                    setRetryError(null);
                                    const result = await retryAnalysis({ status: "idle" }, formData);
                                    if (result.status === "success") onRetried();
                                    else setRetryError(result.message ?? t("screens.video.upload.restartFailed"));
                                }}
                            >
                                <input type="hidden" name="videoId" value={phase.videoId} />
                                <SubmitButton pendingLabel={t("screens.video.queuing")}>
                                    <RotateCcw aria-hidden />
                                    {t("screens.video.retryAnalysis")}
                                </SubmitButton>
                            </form>
                        )}
                        <ButtonLink href={phase.href} variant="secondary">
                            {t("screens.video.upload.viewVideo")}
                        </ButtonLink>
                        <Button variant="ghost" onClick={onReset}>
                            {t("screens.video.upload.differentFile")}
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
                    <p className="text-sm text-fg-muted">{t("screens.video.upload.timing")}</p>
                    <Button size="lg" onClick={onStart}>
                        <CloudUpload aria-hidden />
                        {t("screens.video.upload.start")}
                    </Button>
                </div>
            )}

            {phase.kind === "uploading" && (
                <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-4" aria-live="polite">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-fg">{phase.pct === 100 ? t("screens.video.upload.saving") : t("screens.video.upload.uploading")}</p>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
                            <X aria-hidden />
                            {t("screens.video.upload.cancelUpload")}
                        </Button>
                    </div>
                    {phase.pct === null ? (
                        <ProgressIndeterminate label={t("screens.video.upload.uploading")} />
                    ) : (
                        <ProgressBar
                            value={phase.pct}
                            label={t("screens.video.upload.progress")}
                            valueText={t("screens.video.upload.progressValue", { done: formatNumber((summary.sizeMb * phase.pct) / 100, 1), total: formatFileSize(summary.sizeMb), pct: Math.round(phase.pct) })}
                        />
                    )}
                </div>
            )}

            {phase.kind === "registering" && (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-border px-4 py-4 text-sm font-medium text-fg">
                    <Spinner className="text-primary" />
                    {t("screens.video.upload.starting")}
                </p>
            )}

            {phase.kind === "processing" && (
                <div className="rounded-xl border border-border px-4 py-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                        <Sparkles aria-hidden className="size-4 text-ai-fg" />
                        {t("screens.video.aiAnalysisInProgress")}
                    </p>
                    <PipelineProgress jobId={phase.jobId} initialJob={null} now={now} onSettled={onSettled} restartKey={phase.restartKey} />
                    <p className="mt-3 text-[13px] text-fg-muted">{t("screens.video.upload.canLeave")}</p>
                </div>
            )}

            {phase.kind === "upload_failed" && (
                <Callout
                    tone="danger"
                    icon={TriangleAlert}
                    role="alert"
                    title={t("screens.video.upload.didntGoThrough")}
                    action={
                        phase.editableStep === null ? (
                            <Button onClick={onStart}>
                                <RotateCcw aria-hidden />
                                {t("screens.video.tryAgain")}
                            </Button>
                        ) : (
                            <Button onClick={() => onEditStep(phase.editableStep ?? 2)}>
                                <PenLine aria-hidden />
                                {phase.editableStep === 1 ? t("screens.video.upload.anotherFile") : t("screens.video.upload.fixDetails")}
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
                title={t("screens.video.upload.cancelTitle")}
                description={t("screens.video.upload.cancelDesc")}
                confirmLabel={t("screens.video.upload.cancelUpload")}
            />
        </div>
    );
}
