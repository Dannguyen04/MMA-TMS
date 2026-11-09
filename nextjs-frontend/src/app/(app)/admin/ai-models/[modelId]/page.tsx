import { Activity, BrainCircuit, GitBranch, SlidersHorizontal, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { countLabel, f1Score, formatRatio, modelTaskLabel, percentOf } from "@/components/admin/admin-format";
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
import { formatConfidence, formatDate, formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getAIModel, listAIJobs, listAIModels } from "@/lib/services/ai";
import { average, cn } from "@/lib/utils";

/** One read per request, shared by the metadata and the page. */
const loadModel = cache((modelId: string) => getAIModel(modelId));

export async function generateMetadata({ params }: PageProps<"/admin/ai-models/[modelId]">): Promise<Metadata> {
    await requireRole("admin");
    const { t } = await getTranslator();
    const { modelId } = await params;
    const model = await loadModel(modelId);
    return { title: model ? t("screens.admin.meta.model", { label: `${model.name} ${model.version}` }) : t("screens.admin.meta.modelNotFound") };
}

export default async function AdminAIModelDetailPage({ params }: PageProps<"/admin/ai-models/[modelId]">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    const { modelId } = await params;
    const now = new Date().toISOString();

    const [model, models, jobs, settings] = await Promise.all([loadModel(modelId), listAIModels(), listAIJobs(), getSettings()]);
    if (!model) notFound();

    const label = `${model.name} ${model.version}`;
    const taskLabel = modelTaskLabel(t, model.task);
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
                back={{ href: routes.admin.aiModels, label: t("screens.admin.common.aiModels") }}
                eyebrow={taskLabel}
                title={
                    <>
                        {model.name} <span className="font-mono text-[0.8em] font-medium text-fg-muted">{model.version}</span>
                    </>
                }
                description={model.description}
                meta={
                    <>
                        <ModelStatusBadge status={model.status} locale={locale} />
                        <Badge tone="neutral" variant="outline">
                            {model.framework}
                        </Badge>
                        <span className="text-[13px] text-fg-muted">{t("screens.admin.model.deployed", { date: formatDate(model.deployedAt, locale) })}</span>
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
                    <CardHeader title={t("screens.admin.model.evaluation")} description={t("screens.admin.model.evaluationDescription")} icon={<BrainCircuit />} />
                    <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        <MetricTile label={t("screens.admin.modelCard.precision")} value={formatRatio(model.precision)} hint={t("screens.admin.model.precisionHint")} locale={locale} />
                        <MetricTile label={t("screens.admin.modelCard.recall")} value={formatRatio(model.recall)} hint={t("screens.admin.model.recallHint")} locale={locale} />
                        <MetricTile
                            label={t("screens.admin.model.f1")}
                            value={formatRatio(f1Score(model.precision, model.recall))}
                            hint={t("screens.admin.model.f1Hint")}
                            locale={locale}
                        />
                        <MetricTile
                            label={t("screens.admin.modelCard.humanAgreement")}
                            value={formatPercent(model.humanAgreementPct, 1)}
                            hint={t("screens.admin.model.agreementHint")}
                            locale={locale}
                        />
                        <MetricTile label={t("screens.admin.modelCard.reviews")} value={formatNumber(model.reviewsCount)} hint={t("screens.admin.model.reviewsHint")} locale={locale} />
                        <MetricTile label={t("screens.admin.model.avgLatency")} value={model.avgLatencyMs} unit="ms" hint={t("screens.admin.model.latencyHint")} locale={locale} />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title={t("screens.admin.model.thresholds")} description={t("screens.admin.model.thresholdsDescription")} icon={<SlidersHorizontal />} />
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
                                    disabledReason={model.status === "deprecated" ? t("screens.admin.model.deprecatedReadOnly") : null}
                                />
                                <AINotice audience="admin" compact locale={locale} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("screens.admin.model.usage")}
                                description={
                                    usage.length > 0
                                        ? t("screens.admin.model.usageDescription", { jobs: countLabel(t, "screens.admin.count.jobs", usage.length) })
                                        : t("screens.admin.model.usageEmpty")
                                }
                                icon={<Activity />}
                            />
                            <CardContent>
                                {usage.length === 0 ? (
                                    <EmptyState
                                        compact
                                        title={t("screens.admin.model.noJobsTitle")}
                                        description={model.status === "staging" ? t("screens.admin.model.noJobsStaging") : t("screens.admin.model.noJobsHistory")}
                                    />
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <MetricTile
                                            label={t("screens.admin.common.completed")}
                                            value={completed.length}
                                            hint={t("screens.admin.model.failedCount", { n: failed.length })}
                                            locale={locale}
                                        />
                                        <MetricTile
                                            label={t("screens.admin.model.failureRate")}
                                            value={formatPercent(percentOf(failed.length, completed.length + failed.length), 1)}
                                            hint={t("screens.admin.today.ofFinishedJobs")}
                                            locale={locale}
                                        />
                                        <MetricTile
                                            label={t("screens.admin.model.avgJobConfidence")}
                                            value={confidences.length > 0 ? formatConfidence(average(confidences)) : "—"}
                                            hint={t("screens.admin.model.lowConfidenceCount", { n: completed.filter((job) => job.lowConfidence).length })}
                                            locale={locale}
                                        />
                                        <MetricTile
                                            label={t("screens.admin.model.lastUsed")}
                                            value={lastUsed ? formatRelative(lastUsed, now, locale) : "—"}
                                            hint={lastUsed ? formatDateTime(lastUsed, locale) : undefined}
                                            locale={locale}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title={t("screens.admin.model.feedback")} description={t("screens.admin.model.feedbackDescription")} icon={<UserCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {model.reviewsCount === 0 ? (
                                    <p className="text-sm text-fg-muted">{t("screens.admin.model.noReviews")}</p>
                                ) : (
                                    <>
                                        <ProgressBar
                                            value={model.humanAgreementPct}
                                            label={t("screens.admin.model.agreed")}
                                            showLabel
                                            tone={model.humanAgreementPct >= 85 ? "success" : model.humanAgreementPct >= 75 ? "warning" : "danger"}
                                            valueText={formatPercent(model.humanAgreementPct, 1)}
                                        />
                                        <dl className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">{t("screens.admin.model.confirmed")}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(agreed)}</dd>
                                            </div>
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">{t("screens.admin.model.corrected")}</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(disagreed)}</dd>
                                            </div>
                                        </dl>
                                        <p className="text-[13px] text-fg-muted">
                                            {t("screens.admin.model.basedOn", { reviews: countLabel(t, "screens.admin.count.reviews", model.reviewsCount) })}
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader title={t("screens.admin.model.versions")} description={taskLabel} icon={<GitBranch />} />
                            <ul className="divide-y divide-border border-t border-border">
                                {siblings.map((sibling) => {
                                    const current = sibling.id === model.id;
                                    const meta = {
                                        f1: formatRatio(f1Score(sibling.precision, sibling.recall)),
                                        date: formatDate(sibling.deployedAt, locale),
                                    };
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
                                                    {current ? t("screens.admin.model.versionMetaCurrent", meta) : t("screens.admin.model.versionMeta", meta)}
                                                </p>
                                            </div>
                                            <ModelStatusBadge status={sibling.status} size="sm" locale={locale} />
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>

                        <p className="flex items-start gap-2 px-1 text-[13px] text-fg-subtle">
                            <GitBranch aria-hidden className="mt-px size-4 shrink-0" />
                            {t("screens.admin.model.oneActive")}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
