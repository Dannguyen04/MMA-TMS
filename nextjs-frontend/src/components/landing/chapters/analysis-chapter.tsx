import { Check, Pencil, ScanLine, X } from "lucide-react";

import { PIPELINE_STAGES, SAMPLE_FINDINGS, SAMPLE_METRICS } from "../landing-data";
import { ChapterTitle, Kicker, Panel, SampleTag, TONE_BG, TONE_TEXT } from "./chapter-parts";

/**
 * 01 — AI video analysis. While this chapter is pinned the stage scans the fighter and draws the
 * pose skeleton; the copy runs the pipeline, then shows what the analysis returns.
 */
export function AnalysisChapter() {
    return (
        <section id="analysis" data-chapter="analysis" aria-labelledby="analysis-title" className="landing-chapter">
            <div className="landing-chapter-inner lg:justify-end">
                <div className="w-full max-w-[34rem]">
                    <Kicker index="01">AI video analysis</Kicker>
                    <ChapterTitle id="analysis-title">Every rep, read like a scorecard.</ChapterTitle>
                    <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                        Upload shadow boxing, pad work, heavy bag or sparring. The pipeline tracks the fighter, estimates 17 pose keypoints per frame and
                        turns every strike into numbers a coach can check.
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
                                {PIPELINE_STAGES.map((stage) => (
                                    <li key={stage} data-analysis-stage className="landing-stage-step flex items-center gap-3 text-[13px]">
                                        <span aria-hidden className="landing-stage-dot" />
                                        {stage}
                                    </li>
                                ))}
                            </ol>
                        </Panel>

                        <div data-analysis-results className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white">What comes back</p>
                                <SampleTag />
                            </div>
                            <dl className="grid grid-cols-3 gap-2">
                                {SAMPLE_METRICS.map((metric) => (
                                    <Panel key={metric.label} data-analysis-metric className="px-3 py-3">
                                        <dt className="text-[11px] leading-4 text-nav-fg">{metric.label}</dt>
                                        <dd className="mt-1.5 font-mono text-xl font-semibold text-white">
                                            <span data-count-to={metric.value} data-decimals={metric.decimals}>
                                                {metric.value.toFixed(metric.decimals)}
                                            </span>
                                            <span className="ml-0.5 text-xs text-nav-fg">{metric.unit}</span>
                                        </dd>
                                    </Panel>
                                ))}
                            </dl>
                            <ul className="space-y-2">
                                {SAMPLE_FINDINGS.map((finding) => (
                                    <li key={finding.kind} data-analysis-finding>
                                        <Panel className="flex gap-3 px-4 py-3">
                                            <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_BG[finding.tone]}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[11px] font-semibold tracking-wide uppercase ${TONE_TEXT[finding.tone]}`}>{finding.kind}</p>
                                                <p className="mt-0.5 text-[13px] leading-5 text-white/90">{finding.text}</p>
                                            </div>
                                            <p className="shrink-0 text-right font-mono text-[11px] text-nav-fg">
                                                AI confidence
                                                <span className="block text-sm text-white">{finding.confidence.toFixed(2)}</span>
                                            </p>
                                        </Panel>
                                    </li>
                                ))}
                            </ul>
                            <div data-analysis-review className="flex flex-wrap items-center gap-2 pt-1 text-[13px] text-nav-fg">
                                <span className="font-semibold text-white">Coach review:</span>
                                <span className="landing-chip">
                                    <Check aria-hidden className="size-3.5 text-landing-success" /> Confirm
                                </span>
                                <span className="landing-chip">
                                    <Pencil aria-hidden className="size-3.5 text-landing-warning" /> Correct
                                </span>
                                <span className="landing-chip">
                                    <X aria-hidden className="size-3.5 text-landing-danger" /> Reject
                                </span>
                                <span>— the fighter sees findings once a coach signs off.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
