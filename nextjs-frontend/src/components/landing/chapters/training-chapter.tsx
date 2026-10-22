import { CalendarDays, ShieldCheck } from "lucide-react";

import { getTranslator } from "@/lib/i18n/server";
import { TRAINING_PHASES } from "../landing-data";
import { ChapterTitle, Kicker, Panel } from "./chapter-parts";

/** 02 — Training. Pinned: the camp's phases slide past horizontally while the fighter turns in profile. */
export async function TrainingChapter() {
    const { t } = await getTranslator();
    return (
        <section id="training" data-chapter="training" aria-labelledby="training-title" className="landing-chapter">
            <div className="landing-chapter-inner flex-col items-stretch justify-between gap-10 lg:py-24">
                <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,22rem)] lg:justify-between">
                    <div>
                        <Kicker index="02">{t("landing.training.kicker")}</Kicker>
                        <ChapterTitle id="training-title">{t("landing.training.title")}</ChapterTitle>
                        <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                            {t("landing.training.text")}
                        </p>
                    </div>
                    <Panel data-training-session className="self-start p-5 lg:mt-24">
                        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-nav-fg uppercase">
                            <CalendarDays aria-hidden className="size-3.5 text-landing-cyan" />
                            {t("landing.training.sessionTime")}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">{t("landing.training.sessionTitle")}</p>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                                <dt className="text-nav-fg">{t("landing.training.targetRpe")}</dt>
                                <dd className="font-mono text-white">7 / 10</dd>
                            </div>
                            <div>
                                <dt className="text-nav-fg">{t("landing.training.rounds")}</dt>
                                <dd className="font-mono text-white">6 × 3 min</dd>
                            </div>
                        </dl>
                        <p className="mt-4 flex items-center gap-2 rounded-lg bg-landing-success/10 px-3 py-2 text-[13px] text-landing-success">
                            <ShieldCheck aria-hidden className="size-4" />
                            {t("landing.training.clearanceChecked")}
                        </p>
                        <p className="mt-3 text-[12px] leading-5 text-nav-fg">{t("landing.training.sessionNote")}</p>
                    </Panel>
                </div>

                <div className="-mx-5 overflow-hidden sm:-mx-8 lg:-mx-12">
                    <ol data-training-track className="flex w-max gap-4 px-5 sm:px-8 lg:px-12">
                        {TRAINING_PHASES.map((phase, index) => (
                            <li key={phase.id} data-training-phase className="w-[min(80vw,24rem)] shrink-0">
                                <Panel className="relative overflow-hidden p-6">
                                    <p className="font-mono text-[11px] tracking-[0.18em] text-nav-fg uppercase">
                                        {t("landing.training.phaseHeading", { index: String(index + 1), weeks: t(phase.weeksKey) })}
                                    </p>
                                    <p className="mt-6 text-3xl font-semibold tracking-tight text-white">{t(phase.phaseKey)}</p>
                                    <p className="mt-2 text-[14px] leading-6 text-nav-fg">{t(phase.textKey)}</p>
                                    <div className="mt-6">
                                        <p className="flex justify-between text-[11px] text-nav-fg">
                                            <span>{t("landing.training.load")}</span>
                                            <span className="font-mono">{Math.round(phase.load * 100)}%</span>
                                        </p>
                                        <div className="mt-1.5 h-1 rounded-full bg-white/10">
                                            <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-landing-cyan" style={{ width: `${phase.load * 100}%` }} />
                                        </div>
                                    </div>
                                    <span aria-hidden className="pointer-events-none absolute -top-4 -right-2 font-mono text-[7rem] leading-none font-bold text-white/[0.04]">
                                        {index + 1}
                                    </span>
                                </Panel>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
