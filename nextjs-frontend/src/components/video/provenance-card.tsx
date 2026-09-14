import { ChevronDown, Cpu } from "lucide-react";

import type { AIAnalysis, AIJob, Video } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ProvenanceCardProps {
    analysis: Pick<AIAnalysis, "id" | "jobId" | "processedAt" | "models" | "trackingQuality" | "overallConfidence" | "fps">;
    job: Pick<AIJob, "id" | "durationSec" | "attempts" | "workerId"> | null;
    video: Pick<Video, "resolution" | "fileName">;
    className?: string;
}

/** Where the analysis came from: job, timing and model versions. Collapsed by default. */
export function ProvenanceCard({ analysis, job, video, className }: ProvenanceCardProps) {
    const rows: { label: string; value: string }[] = [
        { label: "Job", value: job?.id ?? analysis.jobId },
        { label: "Processed", value: formatDateTime(analysis.processedAt) },
        { label: "Processing time", value: job?.durationSec != null ? `${formatNumber(job.durationSec)} s` : "—" },
        { label: "Attempts", value: job ? String(job.attempts) : "—" },
        { label: "Tracking quality", value: formatConfidence(analysis.trackingQuality) },
        { label: "Mean confidence", value: formatConfidence(analysis.overallConfidence) },
        { label: "Source", value: `${video.fileName} · ${video.resolution} · ${formatNumber(analysis.fps)} fps` },
        { label: "Fighter detection", value: analysis.models.detection },
        { label: "Pose estimation", value: analysis.models.pose },
        { label: "Action recognition", value: analysis.models.action },
        { label: "Movement anomaly", value: analysis.models.anomaly },
    ];

    return (
        <details className={cn("group rounded-xl border border-border bg-surface shadow-card", className)}>
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                    <Cpu className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">Provenance</span>
                    <span className="block truncate text-xs text-fg-muted">
                        {analysis.models.pose} · {analysis.models.action}
                    </span>
                </span>
                <ChevronDown aria-hidden className="size-4 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[13px]">
                {rows.map((row) => (
                    <div key={row.label} className="contents">
                        <dt className="text-fg-muted">{row.label}</dt>
                        <dd className="min-w-0 text-right font-medium break-words text-fg">{row.value}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
}
