import { Check, Pencil, ScanLine, X } from "lucide-react";

import { getTranslator } from "@/lib/i18n/server";
import { PIPELINE_STAGES, SAMPLE_FINDINGS, SAMPLE_METRICS } from "../landing-data";
import { ChapterTitle, Kicker, Panel, SampleTag, TONE_BG, TONE_TEXT } from "./chapter-parts";

/**
 * 01 — AI video analysis. While this chapter is pinned the stage scans the fighter and draws the
 * pose skeleton; the copy runs the pipeline, then shows what the analysis returns.
 */
export async function AnalysisChapter() {
    const { t } = await getTranslator();
    return (
        <section id="analysis" data-chapter="analysis" aria-labelledby="analysis-title" className="landing-chapter">
            <div className="landing-chapter-inner lg:justify-end">
                <div className="w-full max-w-[34rem]">
                    <Kicker index="01">{t("landing.analysis.kicker")}</Kicker>
                    <ChapterTitle id="analysis-title">{t("landing.analysis.title")}</ChapterTitle>
                    <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                        {t("landing.analysis.text")}
                    </p>

                    <div className="landing-stack mt-7">
                        <Panel data-analysis-pipeline className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <ScanLine aria-hidden className="size-4 text-landing-cyan" />
                                    heavy-bag-round-3.mp4
                                </p>
                                <p className="font-mono text-xs text-landing-cyan">
                                    <span data-analysis-percent>100</span>%
                                </p>
                            </div>
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                                <div data-analysis-bar className="h-full origin-left rounded-full bg-gradient-to-r from-landing-cyan to-brand-blue" />
                            </div>
                            <ol className="mt-4 space-y-2">
                                {PIPELINE_STAGES.map((stageKey) => (
                                    <li key={stageKey} data-analysis-stage className="landing-stage-step flex items-center gap-3 text-[13px]">
                                        <span aria-hidden className="landing-stage-dot" />
                                        {t(stageKey)}
                                    </li>
                                ))}
                            </ol>
                        </Panel>

                        <div data-analysis-results className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white">{t("landing.analysis.results")}</p>
                                <SampleTag>{t("landing.sampleTag.analysis")}</SampleTag>
                            </div>
                            <dl className="grid grid-cols-3 gap-2">
                                {SAMPLE_METRICS.map((metric) => (
                                    <Panel key={metric.id} data-analysis-metric className="px-3 py-3">
                                        <dt className="text-[11px] leading-4 text-nav-fg">{t(metric.labelKey)}</dt>
                                        <dd className="mt-1.5 font-mono text-xl font-semibold text-white">
                                            <span data-count-to={metric.value} data-decimals={metric.decimals}>
                                                {metric.value.toFixed(metric.decimals)}
                                            </span>
                                            <span className="ml-0.5 text-xs text-nav-fg">{t(metric.unitKey)}</span>
                                        </dd>
                                    </Panel>
                                ))}
                            </dl>
                            <ul className="space-y-2">
                                {SAMPLE_FINDINGS.map((finding) => (
                                    <li key={finding.kindKey} data-analysis-finding>
                                        <Panel className="flex gap-3 px-4 py-3">
                                            <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_BG[finding.tone]}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[11px] font-semibold tracking-wide uppercase ${TONE_TEXT[finding.tone]}`}>{t(finding.kindKey)}</p>
                                                <p className="mt-0.5 text-[13px] leading-5 text-white/90">{t(finding.textKey)}</p>
                                            </div>
                                            <p className="shrink-0 text-right font-mono text-[11px] text-nav-fg">
                                                {t("landing.analysis.confidence")}
                                                <span className="block text-sm text-white">{finding.confidence.toFixed(2)}</span>
                                            </p>
                                        </Panel>
                                    </li>
                                ))}
                            </ul>
                            <div data-analysis-review className="flex flex-wrap items-center gap-2 pt-1 text-[13px] text-nav-fg">
                                <span className="font-semibold text-white">{t("landing.analysis.reviewLabel")}</span>
                                <span className="landing-chip">
                                    <Check aria-hidden className="size-3.5 text-landing-success" /> {t("landing.analysis.confirm")}
                                </span>
                                <span className="landing-chip">
                                    <Pencil aria-hidden className="size-3.5 text-landing-warning" /> {t("landing.analysis.correct")}
                                </span>
                                <span className="landing-chip">
                                    <X aria-hidden className="size-3.5 text-landing-danger" /> {t("landing.analysis.reject")}
                                </span>
                                <span>{t("landing.analysis.reviewNote")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
