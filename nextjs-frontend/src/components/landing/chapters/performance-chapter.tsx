import { getTranslator } from "@/lib/i18n/server";
import { SAMPLE_GOALS, SAMPLE_SCORES } from "../landing-data";
import { ChapterTitle, Kicker, Panel, SampleTag, TONE_BG, TONE_TEXT } from "./chapter-parts";

const TREND = [61, 63, 64, 66, 68, 71, 73, 76];
const GOAL = 78;
const CHART = { width: 320, height: 120, min: 55, max: 82 };

function chartPoint(value: number, index: number): [number, number] {
    const x = (index / (TREND.length - 1)) * CHART.width;
    const y = CHART.height - ((value - CHART.min) / (CHART.max - CHART.min)) * CHART.height;
    return [x, y];
}

const TREND_PATH = TREND.map((value, index) => `${index === 0 ? "M" : "L"}${chartPoint(value, index).join(" ")}`).join(" ");
const TREND_AREA = `${TREND_PATH} L${CHART.width} ${CHART.height} L0 ${CHART.height} Z`;
const GOAL_Y = chartPoint(GOAL, 0)[1];

/** 03 — Performance. Pinned: 3D score bars rise around the fighter while the numbers count up. */
export async function PerformanceChapter() {
    const { t } = await getTranslator();
    return (
        <section id="performance" data-chapter="performance" aria-labelledby="performance-title" className="landing-chapter">
            <div className="landing-chapter-inner flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full max-w-[26rem]">
                    <Kicker index="03">{t("landing.performance.kicker")}</Kicker>
                    <ChapterTitle id="performance-title">{t("landing.performance.title")}</ChapterTitle>
                    <p data-reveal className="mt-5 text-[15px] leading-7 text-nav-fg">
                        {t("landing.performance.text")}
                    </p>
                    <Panel data-reveal className="mt-6 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{t("landing.performance.techniqueScores")}</p>
                            <SampleTag>{t("landing.sampleTag.fighter")}</SampleTag>
                        </div>
                        <ul className="grid grid-cols-2 gap-x-5 gap-y-2">
                            {SAMPLE_SCORES.map(({ id, techniqueKey, score, baseline }) => (
                                <li key={id} className="flex items-baseline justify-between gap-2 text-[13px]">
                                    <span className="truncate text-nav-fg">{t(techniqueKey)}</span>
                                    <span className="font-mono text-white">
                                        <span data-count-to={score}>{score}</span>
                                        <span className={`ml-1.5 text-[11px] ${score >= baseline ? "text-landing-success" : "text-landing-danger"}`}>
                                            {score >= baseline ? "+" : "−"}
                                            {Math.abs(score - baseline)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>

                <div className="w-full max-w-[24rem] space-y-3">
                    <Panel data-reveal className="p-5">
                        <p className="flex items-center justify-between text-sm font-semibold text-white">
                            {t("landing.performance.trendTitle")}
                            <span className="font-mono text-xs font-normal text-nav-fg">{t("landing.performance.trendDuration")}</span>
                        </p>
                        <svg viewBox={`0 -6 ${CHART.width} ${CHART.height + 12}`} className="mt-4 h-32 w-full overflow-visible" role="img" aria-label={t("landing.performance.chartAria")}>
                            <defs>
                                <linearGradient id="landing-trend-fill" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-landing-cyan)" stopOpacity="0.28" />
                                    <stop offset="100%" stopColor="var(--color-landing-cyan)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <line x1="0" x2={CHART.width} y1={GOAL_Y} y2={GOAL_Y} stroke="white" strokeOpacity="0.35" strokeDasharray="4 5" />
                            <text x={CHART.width} y={GOAL_Y - 6} textAnchor="end" className="fill-white/50 font-mono text-[10px]">
                                {t("landing.performance.goalTarget", { goal: String(GOAL) })}
                            </text>
                            <path data-trend-area d={TREND_AREA} fill="url(#landing-trend-fill)" />
                            <path data-trend-line d={TREND_PATH} pathLength={1} fill="none" stroke="var(--color-landing-cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            {TREND.map((value, index) => {
                                const [x, y] = chartPoint(value, index);
                                return <circle key={index} data-trend-dot cx={x} cy={y} r="3" className="fill-landing-ink" stroke="var(--color-landing-cyan)" strokeWidth="2" />;
                            })}
                        </svg>
                    </Panel>
                    <Panel data-reveal className="p-5">
                        <p className="text-sm font-semibold text-white">{t("landing.performance.goals")}</p>
                        <ul className="mt-3 space-y-3">
                            {SAMPLE_GOALS.map((goal) => (
                                <li key={goal.id} data-goal>
                                    <p className="flex items-baseline justify-between gap-3 text-[13px]">
                                        <span className="text-white">
                                            {t(goal.goalKey)} <span className="text-nav-fg">· {t(goal.targetKey)}</span>
                                        </span>
                                        <span className={`shrink-0 text-[11px] font-semibold ${TONE_TEXT[goal.tone]}`}>{t(goal.statusKey)}</span>
                                    </p>
                                    <div className="mt-1.5 h-1 rounded-full bg-white/10">
                                        <div data-goal-bar className={`h-full origin-left rounded-full ${TONE_BG[goal.tone]}`} style={{ width: `${goal.progress * 100}%` }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>
            </div>
        </section>
    );
}
