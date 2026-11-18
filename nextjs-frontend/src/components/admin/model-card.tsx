import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { AIModel } from "@/lib/domain/types";
import { formatConfidence, formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { f1Score, formatRatio } from "./admin-format";
import { ModelStatusBadge } from "./admin-badges";

/** Registry card for one model version: status, evaluation metrics, human agreement and thresholds. */
export function ModelCard({ model, locale }: { model: AIModel; locale: Locale }) {
    const t = createTranslator(locale);
    const metrics = [
        { label: t("screens.admin.modelCard.precision"), value: formatRatio(model.precision) },
        { label: t("screens.admin.modelCard.recall"), value: formatRatio(model.recall) },
        { label: t("screens.admin.modelCard.f1"), value: formatRatio(f1Score(model.precision, model.recall)) },
        { label: t("screens.admin.modelCard.humanAgreement"), value: formatPercent(model.humanAgreementPct, 1) },
        { label: t("screens.admin.modelCard.reviews"), value: formatNumber(model.reviewsCount) },
        { label: t("screens.admin.modelCard.latency"), value: t("screens.admin.modelCard.ms", { n: model.avgLatencyMs }) },
    ];

    return (
        <Card
            className={cn(
                "relative flex min-w-0 flex-col transition-colors hover:border-border-strong",
                model.status === "active" && "border-success-border",
            )}
        >
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-fg">
                        <Link href={routes.admin.aiModel(model.id)} className="after:absolute after:inset-0 after:rounded-xl hover:underline">
                            {model.name} <span className="font-mono text-sm font-medium text-fg-muted">{model.version}</span>
                        </Link>
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">
                        {t("screens.admin.modelCard.deployed", { framework: model.framework, date: formatDate(model.deployedAt, locale) })}
                    </p>
                </div>
                <ModelStatusBadge status={model.status} size="sm" className="shrink-0" locale={locale} />
            </div>
            <p className="mt-2 line-clamp-2 px-5 text-[13px] text-fg-muted">{model.description}</p>
            <dl className="mt-4 grid grid-cols-3 gap-px border-y border-border bg-border">
                {metrics.map((metric) => (
                    <div key={metric.label} className="min-w-0 bg-surface px-3 py-2.5 [&:nth-child(3n+1)]:pl-5">
                        <dt className="truncate text-[11px] text-fg-subtle">{metric.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{metric.value}</dd>
                    </div>
                ))}
            </dl>
            <p className="px-5 py-3 text-xs text-fg-muted">
                {t("screens.admin.modelCard.discardBelow")} <span className="font-medium text-fg">{formatConfidence(model.confidenceThreshold)}</span> ·{" "}
                {t("screens.admin.modelCard.reviewBelow")} <span className="font-medium text-fg">{formatConfidence(model.lowConfidenceThreshold)}</span>
            </p>
        </Card>
    );
}
