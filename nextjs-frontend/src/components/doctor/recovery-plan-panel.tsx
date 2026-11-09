import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import type { RecoveryPlan } from "@/lib/domain/types";
import { routes } from "@/lib/routes";

import { PLAN_STATUS, dayDiff, fmtDate } from "./labels";
import { planSteps } from "./plan-steps";
import { Pill } from "./ui";

/**
 * One fighter's active recovery plan, opened up: its milestones as a timeline (done, the next one, then the rest), the
 * overall progress, and on the side what is next and who is in charge.
 */
export function RecoveryPlanPanel({ plan, injury, doctorName, now }: { plan: RecoveryPlan; injury: string | null; doctorName: string | null; now: string }) {
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
                                    Cho <b>{injury}</b>
                                </span>
                            )}
                            <span>
                                {fmtDate(plan.startDate)} → {fmtDate(plan.targetReturnDate)}
                            </span>
                            {overdue > 0 ? (
                                <span className="rp-late">Quá hạn {overdue} ngày</span>
                            ) : (
                                plan.status === "active" &&
                                totalDays && (
                                    <span>
                                        Ngày <b>{dayNow}</b>/{totalDays}
                                    </span>
                                )
                            )}
                        </p>
                    </div>
                    <Pill tone={PLAN_STATUS[plan.status].tone}>{PLAN_STATUS[plan.status].label}</Pill>
                </header>

                {steps.length === 0 ? (
                    <p className="rp-none">Chưa có mốc nào. Mở kế hoạch để thêm các mốc trở lại tập.</p>
                ) : (
                    <>
                <div className="rp-progress">
                    <p>
                        <span>
                            <b>
                                {done}/{steps.length}
                            </b>{" "}
                            mốc hoàn tất
                        </span>
                        <span>{pct}%</span>
                    </p>
                    <div className="rp-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ kế hoạch">
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
                                {step.date && <time>{step.done ? `Xong ${fmtDate(step.date)}` : state === "now" ? `Mục tiêu ${fmtDate(step.date)}` : fmtDate(step.date)}</time>}
                            </li>
                        );
                    })}
                </ol>
                    </>
                )}
            </div>

            <aside className="rp-side" aria-label="Tóm tắt kế hoạch">
                {next ? (
                    <div className="rp-next">
                        <small>Mốc tiếp theo</small>
                        <b>{next.title}</b>
                        {next.date && (
                            <span>
                                Mục tiêu {fmtDate(next.date)}
                                {daysToNext !== null && (daysToNext > 0 ? ` · còn ${daysToNext} ngày` : daysToNext === 0 ? " · hôm nay" : ` · trễ ${-daysToNext} ngày`)}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="rp-next" data-done="true">
                        <small>Mốc tiếp theo</small>
                        <b>Đã xong mọi mốc</b>
                    </div>
                )}
                <dl>
                    {plan.targetReturnDate && (
                        <div>
                            <dt>Dự kiến trở lại</dt>
                            <dd>{fmtDate(plan.targetReturnDate)}</dd>
                        </div>
                    )}
                    {doctorName && (
                        <div>
                            <dt>Bác sĩ phụ trách</dt>
                            <dd>{doctorName}</dd>
                        </div>
                    )}
                </dl>
                <Link href={routes.doctor.fighterRecoveryPlan(plan.fighterId, plan.id)} className="yt-btn" data-v="primary">
                    Mở kế hoạch
                    <ArrowRight aria-hidden />
                </Link>
            </aside>
        </article>
    );
}
