"use client";

import { useRouter } from "next/navigation";

import { ProgressBar } from "@/components/ui/progress";
import { PIPELINE_STAGE_LABELS } from "@/lib/domain/labels";
import type { AIJob } from "@/lib/domain/types";
import { useJobProgress } from "./use-job-progress";

/** Compact live progress for a processing video card; refreshes the list when the job settles. */
export function LiveJobStatus({ jobId, initialJob }: { jobId: string; initialJob: AIJob | null }) {
    const router = useRouter();
    const { job } = useJobProgress({ jobId, initialJob, onSettled: () => router.refresh() });
    const label = !job || job.status === "queued" ? "Waiting in queue" : PIPELINE_STAGE_LABELS[job.stage];
    const pct = job?.progressPct ?? 0;
    return (
        <div className="w-full">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span className="truncate">{label}</span>
                <span className="tabular-nums">{pct}%</span>
            </div>
            <ProgressBar value={pct} size="sm" label="AI analysis progress" hideValue valueText={`${pct}%, ${label}`} />
        </div>
    );
}
