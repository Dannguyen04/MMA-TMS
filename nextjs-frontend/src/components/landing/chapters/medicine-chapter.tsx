import { Lock, Radar, ShieldCheck } from "lucide-react";

import { getTranslator } from "@/lib/i18n/server";
import { CLEARANCE_STEPS, RECOVERY_CHECK_IN } from "../landing-data";
import { ChapterTitle, Kicker, Panel, TONE_BG, TONE_TEXT } from "./chapter-parts";

/**
 * 04 — Sports medicine. Pinned: the fighter turns to hologram, the flagged knee pulses, recovery
 * check-ins improve and the clearance steps up to "Cleared".
 */
export async function MedicineChapter() {
    const { t } = await getTranslator();
    return (
        <section id="medicine" data-chapter="medicine" aria-labelledby="medicine-title" className="landing-chapter">
            <div className="landing-chapter-inner lg:justify-end">
                <div className="w-full max-w-[33rem]">
                    <Kicker index="04">{t("landing.medicine.kicker")}</Kicker>
                    <ChapterTitle id="medicine-title">{t("landing.medicine.title")}</ChapterTitle>
                    <p data-reveal className="mt-5 max-w-md text-[15px] leading-7 text-nav-fg">
                        {t("landing.medicine.text")}
                    </p>

                    <Panel data-medicine-observation className="mt-7 p-4">
                        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-landing-danger uppercase">
                            <Radar aria-hidden className="size-3.5" />
                            {t("landing.medicine.observationHeading")}
                        </p>
                        <p className="mt-2 text-[14px] leading-6 text-white">{t("landing.medicine.observationText")}</p>
                        <p className="mt-1 text-[12px] text-nav-fg">{t("landing.medicine.observationNote")}</p>
                    </Panel>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                        <Panel data-reveal className="p-4">
                            <p className="text-sm font-semibold text-white">{t("landing.medicine.recoveryCheckIn")}</p>
                            <ul className="mt-3 space-y-2.5">
                                {RECOVERY_CHECK_IN.map((metric) => (
                                    <li key={metric.id} className="text-[13px]">
                                        <p className="flex justify-between">
                                            <span className="text-nav-fg">{t(metric.labelKey)}</span>
                                            <span className="font-mono text-white">
                                                <span data-recovery-value data-from={metric.from} data-to={metric.to}>
                                                    {metric.to}
                                                </span>
                                                {t(metric.unitKey)}
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
                                {t("landing.medicine.clearanceTitle")}
                            </p>
                            <ol className="mt-3 space-y-2">
                                {CLEARANCE_STEPS.map((step, index) => (
                                    <li
                                        key={step.id}
                                        data-clearance-step
                                        data-active={index === CLEARANCE_STEPS.length - 1 ? "true" : "false"}
                                        className="landing-clearance-step flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]"
                                    >
                                        <span aria-hidden className={`size-2 shrink-0 rounded-full ${TONE_BG[step.tone]}`} />
                                        <span className="min-w-0">
                                            <span className={`block font-semibold ${TONE_TEXT[step.tone]}`}>{t(step.levelKey)}</span>
                                            <span className="block text-[11px] text-nav-fg">{t(step.detailKey)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </Panel>
                    </div>
                    <p data-reveal className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-nav-fg">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        {t("landing.medicine.privacy")}
                    </p>
                </div>
            </div>
        </section>
    );
}
