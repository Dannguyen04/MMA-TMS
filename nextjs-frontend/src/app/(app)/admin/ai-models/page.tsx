import type { Metadata } from "next";

import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { ModelCard } from "@/components/admin/model-card";
import { AINotice } from "@/components/domain/ai-notice";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import type { AIModelStatus, AIModelTask } from "@/lib/domain/types";
import { plural } from "@/lib/i18n/translate";
import { listAIModels } from "@/lib/services/ai";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export const metadata: Metadata = { title: "AI models" };

const TASKS = Object.keys(AI_MODEL_TASK_LABELS) as AIModelTask[];
const STATUSES: AIModelStatus[] = ["active", "staging", "deprecated"];

const TASK_KEYS: Record<AIModelTask, "adminBody.models.detect" | "adminBody.models.pose" | "adminBody.models.action" | "adminBody.models.anomaly"> = {
    fighter_detection: "adminBody.models.detect",
    pose_estimation: "adminBody.models.pose",
    action_recognition: "adminBody.models.action",
    anomaly_detection: "adminBody.models.anomaly",
};

export default async function AdminAIModelsPage() {
    const { t } = await getTranslator();
    await requireRole("admin");
    if (!platformFeatureAvailable("aiModels")) {
        return (
            <>
                <PageHeader title={t("screens.misc.adminPages.models.title")} />
                <FeatureUnavailable service="video analysis" title={t("adminBody.models.unavailable")} />
            </>
        );
    }
    const models = await listAIModels();

    return (
        <>
            <PageHeader
                title={t("screens.misc.adminPages.models.title")}
                description={t("adminBody.models.description")}
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
                    <EmptyState title={t("screens.misc.adminPages.models.empty")} description={t("screens.misc.adminPages.models.emptyDescription")} />
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
                                        <p className="text-sm text-fg-muted">{t(TASK_KEYS[task])}</p>
                                    </div>
                                    <Badge tone="neutral" variant="outline" size="sm">
                                        {plural(t, "adminBody.models.version", taskModels.length)}
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
