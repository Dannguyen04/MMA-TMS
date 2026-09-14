import type { Metadata } from "next";

import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { ModelCard } from "@/components/admin/model-card";
import { AINotice } from "@/components/domain/ai-notice";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import type { AIModelStatus, AIModelTask } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { listAIModels } from "@/lib/services/ai";

export const metadata: Metadata = { title: "AI models" };

const TASKS = Object.keys(AI_MODEL_TASK_LABELS) as AIModelTask[];
const STATUSES: AIModelStatus[] = ["active", "staging", "deprecated"];

const TASK_DESCRIPTIONS: Record<AIModelTask, string> = {
    fighter_detection: "Finds the fighter in each frame and keeps a steady track on them.",
    pose_estimation: "Estimates 17 body keypoints per frame for movement metrics.",
    action_recognition: "Classifies strikes and combinations from pose sequences.",
    anomaly_detection: "Surfaces possible abnormal movement for doctor review — supporting information only.",
};

export default async function AdminAIModelsPage() {
    await requireRole("admin");
    const models = await listAIModels();

    return (
        <>
            <PageHeader
                title="AI models"
                description="Versions running in the video analysis pipeline, with evaluation metrics, human agreement and confidence thresholds."
                meta={STATUSES.map((status) => {
                    const count = models.filter((m) => m.status === status).length;
                    return count > 0 ? (
                        <span key={status} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
                            <ModelStatusBadge status={status} size="sm" />
                            {count}
                        </span>
                    ) : null;
                })}
            />

            <div className="flex flex-col gap-8">
                <AINotice audience="admin" />

                {models.length === 0 ? (
                    <EmptyState title="No models registered" description="Models appear here once the pipeline registers them." />
                ) : (
                    TASKS.map((task) => {
                        const taskModels = models.filter((m) => m.task === task);
                        if (taskModels.length === 0) return null;
                        const headingId = `task-${task}`;
                        return (
                            <section key={task} aria-labelledby={headingId} className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <div className="min-w-0">
                                        <h2 id={headingId} className="text-lg font-semibold text-fg">
                                            {AI_MODEL_TASK_LABELS[task]}
                                        </h2>
                                        <p className="text-sm text-fg-muted">{TASK_DESCRIPTIONS[task]}</p>
                                    </div>
                                    <Badge tone="neutral" variant="outline" size="sm">
                                        {pluralize(taskModels.length, "version")}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                                    {taskModels.map((model) => (
                                        <ModelCard key={model.id} model={model} />
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}
            </div>
        </>
    );
}
