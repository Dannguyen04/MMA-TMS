import { CalendarDays, ShieldCheck } from "lucide-react";

import { TRAINING_PHASES } from "../landing-data";
import { ChapterTitle, Kicker, Panel } from "./chapter-parts";

/** 02 — Training. Pinned: the camp's phases slide past horizontally while the fighter turns in profile. */
export function TrainingChapter() {
    return (
        <section id="training" data-chapter="training" aria-labelledby="training-title" className="landing-chapter">
            <div className="landing-chapter-inner flex-col items-stretch justify-between gap-10 lg:py-24">
                <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,22rem)] lg:justify-between">
                    <div>
                        <Kicker index="02">Training</Kicker>
                        <ChapterTitle id="training-title">Plans that move with the camp.</ChapterTitle>
                        <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                            Coaches build phased plans with objectives, focus areas and a weekly session target, then schedule sessions with a target RPE and
                            exercise rounds. Fighters see their week; drafts stay private until a coach activates them.
                        </p>
                    </div>
                    <Panel data-training-session className="self-start p-5 lg:mt-24">
                        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-nav-fg uppercase">
                            <CalendarDays aria-hidden className="size-3.5 text-landing-cyan" />
                            Tue · 18:00 · 75 min
                        </p>
                        <p className="mt-3 text-lg font-semibold text-white">Pad work — combinations</p>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                                <dt className="text-nav-fg">Target RPE</dt>
                                <dd className="font-mono text-white">7 / 10</dd>
                            </div>
                            <div>
                                <dt className="text-nav-fg">Rounds</dt>
                                <dd className="font-mono text-white">6 × 3 min</dd>
                            </div>
                        </dl>
                        <p className="mt-4 flex items-center gap-2 rounded-lg bg-landing-success/10 px-3 py-2 text-[13px] text-landing-success">
                            <ShieldCheck aria-hidden className="size-4" />
                            Checked against Medical Clearance
                        </p>
                        <p className="mt-3 text-[12px] leading-5 text-nav-fg">Afterwards the fighter logs RPE and rounds completed; the coach rates the session 1–5.</p>
                    </Panel>
                </div>

                <div className="-mx-5 overflow-hidden sm:-mx-8 lg:-mx-12">
                    <ol data-training-track className="flex w-max gap-4 px-5 sm:px-8 lg:px-12">
                        {TRAINING_PHASES.map((phase, index) => (
                            <li key={phase.phase} data-training-phase className="w-[min(80vw,24rem)] shrink-0">
                                <Panel className="relative overflow-hidden p-6">
                                    <p className="font-mono text-[11px] tracking-[0.18em] text-nav-fg uppercase">
                                        Phase {index + 1} · {phase.weeks}
                                    </p>
                                    <p className="mt-6 text-3xl font-semibold tracking-tight text-white">{phase.phase}</p>
                                    <p className="mt-2 text-[14px] leading-6 text-nav-fg">{phase.text}</p>
                                    <div className="mt-6">
                                        <p className="flex justify-between text-[11px] text-nav-fg">
                                            <span>Training load</span>
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
