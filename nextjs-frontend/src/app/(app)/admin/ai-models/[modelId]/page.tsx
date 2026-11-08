import { Activity, BrainCircuit, GitBranch, SlidersHorizontal, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { f1Score, formatRatio, percentOf } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { ModelThresholdsForm } from "@/components/admin/model-thresholds-form";
import { PromoteModelButton } from "@/components/admin/promote-model-button";
import { AINotice } from "@/components/domain/ai-notice";
import { MetricTile } from "@/components/domain/metric-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import { formatConfidence, formatDate, formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getAIModel, listAIJobs, listAIModels } from "@/lib/services/ai";
import { average, cn } from "@/lib/utils";

/** One read per request, shared by the metadata and the page. */
const loadModel = cache((modelId: string) => getAIModel(modelId));

export async function generateMetadata({ params }: PageProps<"/admin/ai-models/[modelId]">): Promise<Metadata> {
    await requireRole("admin");
    const { modelId } = await params;
    const model = await loadModel(modelId);
    return { title: model ? `${model.name} ${model.version} — AI model` : "Model not found" };
}

export default async function AdminAIModelDetailPage({ params }: PageProps<"/admin/ai-models/[modelId]">) {
    const { t } = await getTranslator();
    const locale = t.locale === "en" ? "en" : "vi";
    await requireRole("admin");
    const { modelId } = await params;
    const now = new Date().toISOString();

    const [model, models, jobs, settings] = await Promise.all([loadModel(modelId), listAIModels(), listAIJobs(), getSettings()]);
    if (!model) notFound();

    const label = `${model.name} ${model.version}`;
    const taskLabel = AI_MODEL_TASK_LABELS[model.task];
    const siblings = models.filter((m) => m.task === model.task);
    const active = siblings.find((m) => m.status === "active" && m.id !== model.id) ?? null;

    const usage = jobs.filter(({ job }) => job.modelIds.includes(model.id)).map(({ job }) => job);
    const completed = usage.filter((job) => job.status === "completed");
    const failed = usage.filter((job) => job.status === "failed");
    const confidences = completed.map((job) => job.avgConfidence).filter((value): value is number => value !== null);
    const lastUsed = usage.map((job) => job.queuedAt).sort().at(-1) ?? null;

    const agreed = Math.round((model.reviewsCount * model.humanAgreementPct) / 100);
    const disagreed = model.reviewsCount - agreed;

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.aiModels, label: t("adminBody.models.back") }}
                eyebrow={taskLabel}
                title={
                    <>
                        {model.name} <span className="font-mono text-[0.8em] font-medium text-fg-muted">{model.version}</span>
                    </>
                }
                description={model.description}
                meta={
                    <>
                        <ModelStatusBadge status={model.status} />
                        <Badge tone="neutral" variant="outline">
                            {model.framework}
                        </Badge>
                        <span className="text-[13px] text-fg-muted">{t("adminBody.models.deployed", { when: formatDate(model.deployedAt) })}</span>
                    </>
                }
                actions={
                    model.status === "staging" ? (
                        <PromoteModelButton modelId={model.id} modelLabel={label} taskLabel={taskLabel} activeLabel={active ? `${active.name} ${active.version}` : null} />
                    ) : undefined
                }
            />

            <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader title={t("adminBody.models.evaluation")} description={t("adminBody.models.evaluationDesc")} icon={<BrainCircuit />} />
                    <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        <MetricTile label={t("adminBody.models.precision")} value={formatRatio(model.precision)} hint={t("adminBody.models.precisionHint")} />
                        <MetricTile label={t("adminBody.models.recall")} value={formatRatio(model.recall)} hint={t("adminBody.models.recallHint")} />
                        <MetricTile label={t("adminBody.models.f1")} value={formatRatio(f1Score(model.precision, model.recall))} hint={t("adminBody.models.f1Hint")} />
                        <MetricTile label={t("adminBody.models.agreement")} value={formatPercent(model.humanAgreementPct, 1)} hint={t("adminBody.models.agreementHint")} />
                        <MetricTile label={t("adminBody.models.reviews")} value={formatNumber(model.reviewsCount)} hint={t("adminBody.models.reviewsHint")} />
                        <MetricTile label={t("adminBody.models.latency")} value={model.avgLatencyMs} unit="ms" hint={t("adminBody.models.latencyHint")} />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader
                                title={t("adminBody.models.thresholds")}
                                description={t("adminBody.models.thresholdsDesc")}
                                icon={<SlidersHorizontal />}
                            />
                            <CardContent className="flex flex-col gap-5">
                                <ModelThresholdsForm
                                    key={`${model.confidenceThreshold}-${model.lowConfidenceThreshold}`}
                                    modelId={model.id}
                                    confidencePct={Math.round(model.confidenceThreshold * 100)}
                                    lowConfidencePct={Math.round(model.lowConfidenceThreshold * 100)}
                                    defaults={{
                                        confidencePct: Math.round(settings.aiConfidenceThreshold * 100),
                                        lowConfidencePct: Math.round(settings.aiLowConfidenceThreshold * 100),
                                    }}
                                    disabledReason={
                                        model.status === "deprecated" ? t("adminBody.models.deprecated") : null
                                    }
                                />
                                <AINotice audience="admin" compact />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("adminBody.models.usage")}
                                description={usage.length > 0 ? plural(t, "adminBody.models.usageCount", usage.length) : t("adminBody.models.usageEmpty")}
                                icon={<Activity />}
                            />
                            <CardContent>
                                {usage.length === 0 ? (
                                    <EmptyState
                                        compact
                                        title={t("adminBody.models.noJobs")}
                                        description={model.status === "staging" ? t("adminBody.models.stagingWait") : t("adminBody.models.noHistory")}
                                    />
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <MetricTile label={t("adminBody.today.completed")} value={completed.length} hint={t("adminBody.models.failedHint", { n: failed.length })} />
                                        <MetricTile
                                            label={t("adminBody.today.failureRate")}
                                            value={formatPercent(percentOf(failed.length, completed.length + failed.length), 1)}
                                            hint={t("adminBody.today.ofFinished")}
                                        />
                                        <MetricTile
                                            label={t("adminBody.models.avgConfidence")}
                                            value={confidences.length > 0 ? formatConfidence(average(confidences)) : "—"}
                                            hint={t("adminBody.models.lowJobs", { n: completed.filter((job) => job.lowConfidence).length })}
                                        />
                                        <MetricTile label={t("adminBody.models.lastUsed")} value={lastUsed ? formatRelative(lastUsed, now, locale) : "—"} hint={lastUsed ? formatDateTime(lastUsed) : undefined} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title={t("adminBody.models.feedback")} description={t("adminBody.models.feedbackDesc")} icon={<UserCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {model.reviewsCount === 0 ? (
                                    <p className="text-sm text-fg-muted">{t("adminBody.models.noReviews")}</p>
                                ) : (
                                    <>
                                        <ProgressBar
                                            value={model.humanAgreementPct}
                                            label={t("adminBody.models.agreed")}
                                            showLabel
                                            tone={model.humanAgreementPct >= 85 ? "success" : model.humanAgreementPct >= 75 ? "warning" : "danger"}
                                            valueText={formatPercent(model.humanAgreementPct, 1)}
                                        />
                                        <dl className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">{t("adminBody.models.confirmed")}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(agreed)}</dd>
                                            </div>
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">{t("adminBody.models.corrected")}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(disagreed)}</dd>
                                            </div>
                                        </dl>
                                        <p className="text-[13px] text-fg-muted">
                                            {plural(t, "adminBody.models.basedOn", model.reviewsCount)}
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader title={t("adminBody.models.siblings")} description={taskLabel} icon={<GitBranch />} />
                            <ul className="divide-y divide-border border-t border-border">
                                {siblings.map((sibling) => {
                                    const current = sibling.id === model.id;
                                    return (
                                        <li key={sibling.id} className={cn("flex items-center justify-between gap-3 px-5 py-3", current && "bg-primary-soft/40")}>
                                            <div className="min-w-0">
                                                {current ? (
                                                    <p className="truncate text-sm font-medium text-fg" aria-current="page">
                                                        {sibling.name} <span className="font-mono text-[13px] text-fg-muted">{sibling.version}</span>
                                                    </p>
                                                ) : (
                                                    <Link href={routes.admin.aiModel(sibling.id)} className="block truncate text-sm font-medium text-fg hover:underline">
                                                        {sibling.name} <span className="font-mono text-[13px] text-fg-muted">{sibling.version}</span>
                                                    </Link>
                                                )}
                                                <p className="text-xs text-fg-subtle">
                                                    {current ? `${t("adminBody.models.thisVersion")} · ` : ""}
                                                    {t("adminBody.models.versionLine", { f1: formatRatio(f1Score(sibling.precision, sibling.recall)), deployed: t("adminBody.models.deployedShort", { when: formatDate(sibling.deployedAt) }) })}
                                                </p>
                                            </div>
                                            <ModelStatusBadge status={sibling.status} size="sm" />
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>

                        <p className="flex items-start gap-2 px-1 text-[13px] text-fg-subtle">
                            <GitBranch aria-hidden className="mt-px size-4 shrink-0" />
                            {t("adminBody.models.oneActive")}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
