import { Lock, Radar, ShieldCheck } from "lucide-react";

import { CLEARANCE_STEPS, RECOVERY_CHECK_IN } from "../landing-data";
import { ChapterTitle, Kicker, Panel, TONE_BG, TONE_TEXT } from "./chapter-parts";

/**
 * 04 — Sports medicine. Pinned: the fighter turns to hologram, the flagged knee pulses, recovery
 * check-ins improve and the clearance steps up to "Cleared".
 */
export function MedicineChapter() {
    return (
        <section id="medicine" data-chapter="medicine" aria-labelledby="medicine-title" className="landing-chapter">
            <div className="landing-chapter-inner lg:justify-end">
                <div className="w-full max-w-[33rem]">
                    <Kicker index="04">Sports medicine</Kicker>
                    <ChapterTitle id="medicine-title">Cleared by a doctor, not a guess.</ChapterTitle>
                    <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                        Sports doctors run examinations, log injuries and guide phased recovery. Medical Clearance decides which training is allowed, and only
                        the sports doctor can change it.
                    </p>

                    <Panel data-medicine-observation className="mt-7 p-4">
                        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-landing-danger uppercase">
                            <Radar aria-hidden className="size-3.5" />
                            AI observation · Left knee
                        </p>
                        <p className="mt-2 text-[14px] leading-6 text-white">Knee valgus on roundhouse-kick landing, compared with this fighter&apos;s earlier footage.</p>
                        <p className="mt-1 text-[12px] text-nav-fg">An observation for the doctor to review — never a diagnosis.</p>
                    </Panel>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                        <Panel data-reveal className="p-4">
                            <p className="text-sm font-semibold text-white">Recovery check-in</p>
                            <ul className="mt-3 space-y-2.5">
                                {RECOVERY_CHECK_IN.map((metric) => (
                                    <li key={metric.label} className="text-[13px]">
                                        <p className="flex justify-between">
                                            <span className="text-nav-fg">{metric.label}</span>
                                            <span className="font-mono text-white">
                                                <span data-recovery-value data-from={metric.from} data-to={metric.to}>
                                                    {metric.to}
                                                </span>
                                                {metric.unit}
                                            </span>
                                        </p>
                                        <div className="mt-1 h-1 rounded-full bg-white/10">
                                            <div
                                                data-recovery-bar
                                                data-from={metric.lowerIsBetter ? metric.from / 10 : metric.from / 100}
                                                data-to={metric.lowerIsBetter ? metric.to / 10 : metric.to / 100}
                                                className={`h-full origin-left rounded-full ${metric.lowerIsBetter ? "bg-landing-danger" : "bg-landing-success"}`}
                                                style={{ transform: `scaleX(${metric.lowerIsBetter ? metric.to / 10 : metric.to / 100})` }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        <Panel data-reveal className="p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                <ShieldCheck aria-hidden className="size-4 text-landing-success" />
                                Medical Clearance
                            </p>
                            <ol className="mt-3 space-y-2">
                                {CLEARANCE_STEPS.map((step, index) => (
                                    <li
                                        key={step.level}
                                        data-clearance-step
                                        data-active={index === CLEARANCE_STEPS.length - 1 ? "true" : "false"}
                                        className="landing-clearance-step flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]"
                                    >
                                        <span aria-hidden className={`size-2 shrink-0 rounded-full ${TONE_BG[step.tone]}`} />
                                        <span className="min-w-0">
                                            <span className={`block font-semibold ${TONE_TEXT[step.tone]}`}>{step.level}</span>
                                            <span className="block text-[11px] text-nav-fg">{step.detail}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </Panel>
                    </div>
                    <p data-reveal className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-nav-fg">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        Clinical notes stay with the medical team. Coaches see the clearance, never the record.
                    </p>
                </div>
            </div>
        </section>
    );
}
