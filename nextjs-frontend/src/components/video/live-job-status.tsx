"use client";

import { useRouter } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { ProgressBar } from "@/components/ui/progress";
import type { AIJob } from "@/lib/domain/types";
import { useJobProgress } from "./use-job-progress";
import { pipelineStageLabel } from "./video-copy";

/** Compact live progress for a processing video card; refreshes the list when the job settles. */
export function LiveJobStatus({ jobId, initialJob }: { jobId: string; initialJob: AIJob | null }) {
    const router = useRouter();
    const t = useT();
    const { job } = useJobProgress({ jobId, initialJob, onSettled: () => router.refresh() });
    const label = pipelineStageLabel(t, !job || job.status === "queued" ? "queued" : job.stage);
    const pct = job?.progressPct ?? 0;
    return (
        <div className="w-full">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span className="truncate">{label}</span>
                <span className="tabular-nums">{pct}%</span>
            </div>
            <ProgressBar value={pct} size="sm" label={t("screens.video.aiAnalysisProgress")} hideValue valueText={`${pct}%, ${label}`} />
        </div>
    );
}
