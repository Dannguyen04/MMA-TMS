import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import type { RecoveryPlan } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

import { PLAN_STATUS, dayDiff, fmtDate } from "./labels";
import { planSteps } from "./plan-steps";
import { Pill } from "./ui";

/**
 * One fighter's active recovery plan, opened up: its milestones as a timeline (done, the next one, then the rest), the
 * overall progress, and on the side what is next and who is in charge.
 */
export async function RecoveryPlanPanel({ plan, injury, doctorName, now }: { plan: RecoveryPlan; injury: string | null; doctorName: string | null; now: string }) {
    const { t, locale } = await getTranslator();
    const date = (v: string | null | undefined) => fmtDate(v, locale);
    const steps = planSteps(plan);
    const done = steps.filter((step) => step.done).length;
    const nextIndex = steps.findIndex((step) => !step.done);
    const next = steps[nextIndex] ?? null;
    const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
    // The day counter needs a target date; plans without one show their start only.
    const totalDays = plan.targetReturnDate ? Math.max(1, dayDiff(plan.targetReturnDate, plan.startDate)) : null;
    const dayNow = totalDays ? Math.min(totalDays, Math.max(1, -dayDiff(plan.startDate, now) + 1)) : null;
    // An active plan past its return date says so, rather than sitting on its last day.
    const overdue = plan.status === "active" && plan.targetReturnDate ? Math.max(0, -dayDiff(plan.targetReturnDate, now)) : 0;
    const daysToNext = next?.date ? dayDiff(next.date, now) : null;

    return (
        <article className="yt-panel rp" aria-labelledby={`rp-${plan.id}`}>
            <div className="rp-main">
                <header className="rp-head">
                    <div>
                        <h3 id={`rp-${plan.id}`}>{plan.title}</h3>
                        <p className="rp-meta">
                            {injury && (
                                <span>
                                    {t("doctorUi.plan.for")} <b>{injury}</b>
                                </span>
                            )}
                            <span>
                                {date(plan.startDate)} → {date(plan.targetReturnDate)}
                            </span>
                            {overdue > 0 ? (
                                <span className="rp-late">{plural(t, "doctorUi.plan.overdue", overdue)}</span>
                            ) : (
                                plan.status === "active" &&
                                totalDays && (
                                    <span>
                                        {t("doctorUi.plan.day")} <b>{dayNow}</b>/{totalDays}
                                    </span>
                                )
                            )}
                        </p>
                    </div>
                    <Pill tone={PLAN_STATUS[plan.status].tone}>{t(PLAN_STATUS[plan.status].label)}</Pill>
                </header>

                {steps.length === 0 ? (
                    <p className="rp-none">{t("doctorUi.plan.noSteps")}</p>
                ) : (
                    <>
                <div className="rp-progress">
                    <p>
                        <span>
                            <b>
                                {done}/{steps.length}
                            </b>{" "}
                            {t("doctorUi.plan.stepsDone")}
                        </span>
                        <span>{pct}%</span>
                    </p>
                    <div className="rp-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("doctorUi.plan.progress")}>
                        <i style={{ width: `${pct}%` }} />
                    </div>
                </div>

                <ol className="rp-tl">
                    {steps.map((step, index) => {
                        const state = step.done ? "done" : index === nextIndex ? "now" : "later";
                        return (
                            <li key={step.key} data-s={state} aria-current={state === "now" ? "step" : undefined}>
                                <span className="rp-dot" aria-hidden>
                                    {step.done ? <Check /> : index + 1}
                                </span>
                                <div>
                                    <b>{step.title}</b>
                                    {step.detail && state !== "later" && <small>{step.detail}</small>}
                                </div>
                                {step.date && <time>{step.done ? t("doctorUi.plan.doneOn", { date: date(step.date) }) : state === "now" ? t("doctorUi.plan.targetOn", { date: date(step.date) }) : date(step.date)}</time>}
                            </li>
                        );
                    })}
                </ol>
                    </>
                )}
            </div>

            <aside className="rp-side" aria-label={t("doctorUi.plan.summary")}>
                {next ? (
                    <div className="rp-next">
                        <small>{t("doctorUi.plan.next")}</small>
                        <b>{next.title}</b>
                        {next.date && (
                            <span>
                                {t("doctorUi.plan.targetOn", { date: date(next.date) })}
                                {daysToNext !== null && (daysToNext > 0 ? plural(t, "doctorUi.plan.daysLeft", daysToNext) : daysToNext === 0 ? t("doctorUi.plan.dueToday") : plural(t, "doctorUi.plan.daysLate", -daysToNext))}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="rp-next" data-done="true">
                        <small>{t("doctorUi.plan.next")}</small>
                        <b>{t("doctorUi.plan.allDone")}</b>
                    </div>
                )}
                <dl>
                    {plan.targetReturnDate && (
                        <div>
                            <dt>{t("doctorUi.plan.expectedReturn")}</dt>
                            <dd>{date(plan.targetReturnDate)}</dd>
                        </div>
                    )}
                    {doctorName && (
                        <div>
                            <dt>{t("doctorUi.plan.doctor")}</dt>
                            <dd>{doctorName}</dd>
                        </div>
                    )}
                </dl>
                <Link href={routes.doctor.fighterRecoveryPlan(plan.fighterId, plan.id)} className="yt-btn" data-v="primary">
                    {t("doctorUi.plan.open")}
                    <ArrowRight aria-hidden />
                </Link>
            </aside>
        </article>
    );
}
