"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MOVEMENT_REVIEW_LABELS, type MovementEvidence } from "@/lib/domain/movement-evidence";
import { formatTimestamp } from "@/lib/format";
import { usePlaybackStore } from "./playback-store";
import { MovementReviewPanel } from "./movement-review-panel";
import { z } from 'zod';

const PROTOCOL_LABELS = { whole_body_v1: "Whole body", upper_body_v1: "Upper body", lower_body_v1: "Lower body" };
const PURPOSE_LABELS = { training: "Training review", longitudinal_monitoring: "Long-term monitoring", rehabilitation: "Rehabilitation review" };

/** Video navigation only. Does not grant review/clinical permissions or create findings. */
export function MovementEvidencePanel({ report, jobId }: { report: MovementEvidence; jobId?: string }) {
    const store = usePlaybackStore();
    const [limit, setLimit] = useState(12);
    return (
        <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-fg">Movement evidence</h2>
            <p className="text-sm font-medium text-fg">{MOVEMENT_REVIEW_LABELS[report.status]}</p>
            <p className="text-xs text-fg-muted">
                {PURPOSE_LABELS[report.context.purpose]} · {PROTOCOL_LABELS[report.context.protocolId]}
                <br />Exercise: {report.context.exerciseId ?? "Not declared"} · Camera: {report.context.cameraView ?? "Not declared"}
            </p>
            <p className="text-sm text-fg-muted">
                {report.coverage.usableFrames} / {report.coverage.totalFrames} frames meet the visibility checks.
                This is evidence coverage, not AI accuracy. Declared exercise execution has not been verified.
            </p>
            <div className="rounded-lg border border-warning-border bg-warning-soft p-3 text-xs text-warning-fg">
                Review support only. No validated technique score, repetition count, ROM assessment, automatic trend comparison or medical clearance.
            </div>
            {report.recordingGuidance.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-fg">Recording and review checks</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-4 text-xs text-fg-muted">
                        {report.recordingGuidance.map(g => <li key={g.code}>{g.message}</li>)}
                    </ul>
                </div>
            )}
            <div>
                <h3 className="text-sm font-medium text-fg">Footage windows ({report.windows.length})</h3>
                <p className="mt-1 text-xs text-fg-muted">These are continuous visible intervals, not detected actions or repetitions.</p>
                <ul className="mt-2 space-y-2">
                    {report.windows.slice(0, limit).map(w => (
                        <li key={w.id}>
                            <Button variant="secondary" size="sm" onClick={() => { store.pause(); store.seek(w.startMs); }}
                                aria-label={`Review footage ${formatTimestamp(w.startMs)} to ${formatTimestamp(w.endMs)}`}>
                                {formatTimestamp(w.startMs)} – {formatTimestamp(w.endMs)}
                            </Button>
                            <span className="ml-2 text-xs text-fg-muted">{w.sampleCount} frames · requires review</span>
                        </li>
                    ))}
                </ul>
                {limit < report.windows.length && <Button variant="ghost" size="sm" onClick={() => setLimit(n => n + 12)}>Show more windows</Button>}
            </div>
            {jobId && z.string().uuid().safeParse(jobId).success && <MovementReviewPanel key={jobId} jobId={jobId} report={report} />}
            <details className="text-xs text-fg-muted">
                <summary className="cursor-pointer">Method and limitations</summary>
                <p className="mt-2">{report.reportVersion} · pose model: {report.provenance.poseModel ?? "Unavailable"}</p>
                <p>Visibility thresholds are engineering defaults, not clinically validated thresholds.</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">{report.limitations.map(text => <li key={text}>{text}</li>)}</ul>
            </details>
        </Card>
    );
}
