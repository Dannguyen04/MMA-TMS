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
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import { formatConfidence, formatDate, formatDateTime, formatNumber, formatPercent, formatRelative, pluralize } from "@/lib/format";
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
                back={{ href: routes.admin.aiModels, label: "AI models" }}
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
                        <span className="text-[13px] text-fg-muted">Deployed {formatDate(model.deployedAt)}</span>
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
                    <CardHeader title="Evaluation" description="Offline evaluation and live review figures for this version" icon={<BrainCircuit />} />
                    <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        <MetricTile label="Precision" value={formatRatio(model.precision)} hint="correct when flagged" />
                        <MetricTile label="Recall" value={formatRatio(model.recall)} hint="share of events found" />
                        <MetricTile label="F1 score" value={formatRatio(f1Score(model.precision, model.recall))} hint="balance of both" />
                        <MetricTile label="Human agreement" value={formatPercent(model.humanAgreementPct, 1)} hint="reviews confirming" />
                        <MetricTile label="Reviews" value={formatNumber(model.reviewsCount)} hint="human decisions" />
                        <MetricTile label="Avg latency" value={model.avgLatencyMs} unit="ms" hint="per inference" />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader
                                title="Confidence thresholds"
                                description="Decide which outputs are dropped, flagged for human review, or shown as-is"
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
                                        model.status === "deprecated" ? "Deprecated models don't process new jobs, so their thresholds are read-only." : null
                                    }
                                />
                                <AINotice audience="admin" compact />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Pipeline usage"
                                description={usage.length > 0 ? `${pluralize(usage.length, "job")} in the job history used this model` : "Jobs that ran on this model"}
                                icon={<Activity />}
                            />
                            <CardContent>
                                {usage.length === 0 ? (
                                    <EmptyState
                                        compact
                                        title="No production jobs yet"
                                        description={
                                            model.status === "staging"
                                                ? "Staging models aren't used for new jobs until they're promoted to active."
                                                : "No job in the current history ran on this version."
                                        }
                                    />
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <MetricTile label="Completed" value={completed.length} hint={`${failed.length} failed`} />
                                        <MetricTile
                                            label="Failure rate"
                                            value={formatPercent(percentOf(failed.length, completed.length + failed.length), 1)}
                                            hint="of finished jobs"
                                        />
                                        <MetricTile
                                            label="Avg job confidence"
                                            value={confidences.length > 0 ? formatConfidence(average(confidences)) : "—"}
                                            hint={`${completed.filter((job) => job.lowConfidence).length} low confidence`}
                                        />
                                        <MetricTile label="Last used" value={lastUsed ? formatRelative(lastUsed, now) : "—"} hint={lastUsed ? formatDateTime(lastUsed) : undefined} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Human feedback" description="Coach and doctor review decisions on this model's outputs" icon={<UserCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {model.reviewsCount === 0 ? (
                                    <p className="text-sm text-fg-muted">No outputs from this version have been reviewed yet.</p>
                                ) : (
                                    <>
                                        <ProgressBar
                                            value={model.humanAgreementPct}
                                            label="Reviewers agreed with the model"
                                            showLabel
                                            tone={model.humanAgreementPct >= 85 ? "success" : model.humanAgreementPct >= 75 ? "warning" : "danger"}
                                            valueText={formatPercent(model.humanAgreementPct, 1)}
                                        />
                                        <dl className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">Confirmed</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(agreed)}</dd>
                                            </div>
                                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                                <dt className="text-xs text-fg-muted">Corrected or rejected</dt>
                                                <dd className="mt-0.5 text-lg font-semibold text-fg">≈ {formatNumber(disagreed)}</dd>
                                            </div>
                                        </dl>
                                        <p className="text-[13px] text-fg-muted">
                                            Based on {pluralize(model.reviewsCount, "review")}. Corrections and rejections are collected as training data for the next version.
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader title="Versions for this task" description={taskLabel} icon={<GitBranch />} />
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
                                                    {current ? "This version · " : ""}F1 {formatRatio(f1Score(sibling.precision, sibling.recall))} · deployed {formatDate(sibling.deployedAt)}
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
                            Only one model per task is active. Promoting a staging version deprecates the current one, which stays available for rollback.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
