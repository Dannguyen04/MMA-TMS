"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MovementEvidence } from "@/lib/domain/movement-evidence";
import { formatTimestamp } from "@/lib/format";
import { usePlaybackStore } from "./playback-store";
import { MovementReviewPanel } from "./movement-review-panel";
import { movementReviewLabel } from "./video-copy";
import { z } from 'zod';


/** Video navigation only. Does not grant review/clinical permissions or create findings. */
export function MovementEvidencePanel({ report, jobId }: { report: MovementEvidence; jobId?: string }) {
    const store = usePlaybackStore();
    const t = useT();
    const [limit, setLimit] = useState(12);
    return (
        <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-fg">{t("screens.video.evidence.title")}</h2>
            <p className="text-sm font-medium text-fg">{movementReviewLabel(t, report.status)}</p>
            <p className="text-xs text-fg-muted">
                {t(`screens.video.evidence.purpose.${report.context.purpose}`)} · {t(`screens.video.evidence.protocol.${report.context.protocolId}`)}
                <br />
                {t("screens.video.evidence.context", {
                    exercise: report.context.exerciseId ?? t("screens.video.evidence.notDeclared"),
                    camera: report.context.cameraView ?? t("screens.video.evidence.notDeclared"),
                })}
            </p>
            <p className="text-sm text-fg-muted">{t("screens.video.evidence.coverage", { usable: report.coverage.usableFrames, total: report.coverage.totalFrames })}</p>
            <div className="rounded-lg border border-warning-border bg-warning-soft p-3 text-xs text-warning-fg">{t("screens.video.evidence.supportOnly")}</div>
            {report.recordingGuidance.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-fg">{t("screens.video.evidence.checks")}</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-4 text-xs text-fg-muted">
                        {report.recordingGuidance.map(g => <li key={g.code}>{g.message}</li>)}
                    </ul>
                </div>
            )}
            <div>
                <h3 className="text-sm font-medium text-fg">{t("screens.video.evidence.windows", { n: report.windows.length })}</h3>
                <p className="mt-1 text-xs text-fg-muted">{t("screens.video.evidence.windowsDesc")}</p>
                <ul className="mt-2 space-y-2">
                    {report.windows.slice(0, limit).map(w => (
                        <li key={w.id}>
                            <Button variant="secondary" size="sm" onClick={() => { store.pause(); store.seek(w.startMs); }}
                                aria-label={t("screens.video.evidence.windowAria", { from: formatTimestamp(w.startMs), to: formatTimestamp(w.endMs) })}>
                                {formatTimestamp(w.startMs)} – {formatTimestamp(w.endMs)}
                            </Button>
                            <span className="ml-2 text-xs text-fg-muted">{t("screens.video.evidence.windowFrames", { n: w.sampleCount })}</span>
                        </li>
                    ))}
                </ul>
                {limit < report.windows.length && <Button variant="ghost" size="sm" onClick={() => setLimit(n => n + 12)}>{t("screens.video.evidence.showMore")}</Button>}
            </div>
            {jobId && z.string().uuid().safeParse(jobId).success && <MovementReviewPanel key={jobId} jobId={jobId} report={report} />}
            <details className="text-xs text-fg-muted">
                <summary className="cursor-pointer">{t("screens.video.evidence.method")}</summary>
                <p className="mt-2">{t("screens.video.evidence.poseModel", { version: report.reportVersion, model: report.provenance.poseModel ?? t("screens.video.unavailable") })}</p>
                <p>{t("screens.video.evidence.thresholds")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">{report.limitations.map(text => <li key={text}>{text}</li>)}</ul>
            </details>
        </Card>
    );
}
