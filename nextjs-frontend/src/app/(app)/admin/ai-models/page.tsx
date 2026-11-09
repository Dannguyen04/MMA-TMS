import type { Metadata } from "next";

import { countLabel, modelTaskLabel } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { ModelCard } from "@/components/admin/model-card";
import { AINotice } from "@/components/domain/ai-notice";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import type { AIModelStatus, AIModelTask } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { listAIModels } from "@/lib/services/ai";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.aiModels") };
}

const TASKS = Object.keys(AI_MODEL_TASK_LABELS) as AIModelTask[];
const STATUSES: AIModelStatus[] = ["active", "staging", "deprecated"];

export default async function AdminAIModelsPage() {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("aiModels")) {
        return (
            <>
                <PageHeader title={t("screens.admin.common.aiModels")} />
                <FeatureUnavailable
                    service="video analysis"
                    title={t("screens.admin.models.unavailable")}
                    description={t("screens.admin.common.unavailable.videoAnalysis")}
                />
            </>
        );
    }
    const models = await listAIModels();

    return (
        <>
            <PageHeader
                title={t("screens.admin.common.aiModels")}
                description={t("screens.admin.models.description")}
                meta={STATUSES.map((status) => {
                    const count = models.filter((m) => m.status === status).length;
                    return count > 0 ? (
                        <span key={status} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
                            <ModelStatusBadge status={status} size="sm" locale={locale} />
                            {count}
                        </span>
                    ) : null;
                })}
            />

            <div className="flex flex-col gap-8">
                <AINotice audience="admin" locale={locale} />

                {models.length === 0 ? (
                    <EmptyState title={t("screens.admin.models.emptyTitle")} description={t("screens.admin.models.emptyDescription")} />
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
                                            {modelTaskLabel(t, task)}
                                        </h2>
                                        <p className="text-sm text-fg-muted">{t(`screens.admin.models.task.${task}` as MessageKey)}</p>
                                    </div>
                                    <Badge tone="neutral" variant="outline" size="sm">
                                        {countLabel(t, "screens.admin.count.versions", taskModels.length)}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                                    {taskModels.map((model) => (
                                        <ModelCard key={model.id} model={model} locale={locale} />
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
