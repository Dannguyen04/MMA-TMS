import Link from "next/link";
import type { CSSProperties } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import type { CampTimelineModel, CampTimelineSession } from "@/lib/domain/camp-timeline";
import { sessionStatusLabel, trainingTypeLabel } from "@/lib/domain/labels";
import type { TrainingType } from "@/lib/domain/types";
import { academyDayStartIso, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import styles from "./camp-timeline.module.css";

/** Chart colours by session type, in the validated categorical order (DESIGN.md: Data visualisation). */
const TYPE_COLOR: Record<TrainingType, string> = {
    pad_work: "var(--chart-1)",
    technical_drilling: "var(--chart-2)",
    recovery_mobility: "var(--chart-3)",
    strength_conditioning: "var(--chart-4)",
    shadow_boxing: "var(--chart-5)",
    heavy_bag: "var(--chart-6)",
    grappling: "var(--chart-7)",
    sparring: "var(--chart-8)",
};

const LANE = 18;

/**
 * The whole camp on one line: fight week, weigh-in and bout day, every session by day and type, suspensions over
 * them and today. Only recorded facts; the list under it says the same in words.
 */
export function CampTimeline({ model, sessionHref, locale = "en" }: { model: CampTimelineModel; sessionHref: (id: string) => string; locale?: Locale }) {
    const t = createTranslator(locale);
    const day = (on: string) => formatShortDate(academyDayStartIso(on), locale);
    const types = [...new Set(model.sessions.map((session) => session.type))];
    // Weigh-in is usually the day before the bout: one label for both lines then.
    const close = model.boutAt - model.weighInAt < 8;
    const left = (at: number): CSSProperties => ({ left: `${at}%` });
    const daysLabel =
        model.daysToBout > 0 ? plural(t, "screens.camp.daysToBout", model.daysToBout) : model.daysToBout === 0 ? t("screens.camp.boutToday") : t("screens.camp.boutOver");

    return (
        <Card className="mb-6 min-w-0 overflow-hidden">
            <CardHeader title={t("screens.camp.title")} description={t("screens.camp.description")} />
            <dl className="flex gap-6 px-5">
                        <div>
                            <dt className="text-[11px] text-fg-subtle">{t("screens.camp.weekLabel")}</dt>
                            <dd className="font-display text-lg leading-tight font-bold text-fg tabular-nums">{t("screens.camp.week", { week: model.week, weeks: model.weeks })}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] text-fg-subtle">{t("screens.camp.countdownLabel")}</dt>
                            <dd className="font-display text-lg leading-tight font-bold text-fg tabular-nums">{daysLabel}</dd>
                        </div>
            </dl>
            <div className="scrollbar-thin overflow-x-auto px-5 pb-2">
                <div className="relative min-w-[640px] pt-7 pb-8" aria-hidden>
                    {/* Fight week band and the camp rail */}
                    <div className="relative h-6 rounded-md bg-surface-muted ring-1 ring-border ring-inset">
                        <div
                            className={cn("absolute inset-y-0 rounded-md bg-warning-soft ring-1 ring-warning-border ring-inset", styles.wipe)}
                            style={{ left: `${model.fightWeek.from}%`, width: `${Math.max(1, model.fightWeek.to - model.fightWeek.from)}%` }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center truncate px-1 text-[11px] font-semibold text-warning-fg">{t("screens.camp.fightWeek")}</span>
                        </div>
                    </div>

                    {/* Sessions, with suspensions laid over them */}
                    <div className="relative mt-3" style={{ height: model.lanes * LANE + 8 }}>
                        {model.suspensions.map((item) => (
                            <div
                                key={item.id}
                                className={cn("absolute inset-y-0 rounded-sm bg-danger-soft ring-1 ring-danger-border ring-inset", styles.hatch)}
                                style={{ left: `${item.from}%`, width: `${Math.max(0.8, item.to - item.from)}%` }}
                            />
                        ))}
                        {model.sessions.map((session, index) => (
                            <Dot key={session.id} session={session} index={index} />
                        ))}
                    </div>

                    {/* Weigh-in, bout and today */}
                    <Marker at={model.weighInAt} label={close ? null : t("screens.camp.weighIn")} className="bg-belt-gold" />
                    <Marker at={model.boutAt} label={close ? `${t("screens.camp.weighIn")} · ${t("screens.camp.bout")}` : t("screens.camp.bout")} className="bg-corner-red" />
                    {model.todayAt !== null && (
                        <div className={cn("absolute top-[22px] bottom-6 w-0.5 -translate-x-1/2 bg-fg", styles.grow)} style={left(model.todayAt)}>
                            <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 rounded bg-fg px-1.5 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap text-fg-inverse">
                                {t("screens.camp.today")}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-5 py-3 text-xs text-fg-muted">
                {types.map((type) => (
                    <span key={type} className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-2.5 rounded-full" style={{ background: TYPE_COLOR[type] }} />
                        {trainingTypeLabel(t, type)}
                    </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-full border-2 border-fg-subtle" />
                    {t("screens.camp.legendUpcoming")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-full bg-fg-subtle opacity-35" />
                    {t("screens.camp.legendMissed")}
                </span>
                {model.suspensions.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className={cn("h-2.5 w-4 rounded-sm bg-danger-soft ring-1 ring-danger-border", styles.hatch)} />
                        {t("screens.camp.legendSuspension")}
                    </span>
                )}
                <span className="ml-auto text-fg-subtle">
                    {t("screens.camp.counts", { done: model.counts.done, upcoming: model.counts.upcoming, missed: model.counts.missed })}
                </span>
            </div>

            <details className="border-t border-border px-5 py-3 text-sm">
                <summary className="cursor-pointer text-fg-muted hover:text-fg">{plural(t, "screens.camp.listToggle", model.sessions.length)}</summary>
                <ol className="mt-2 flex flex-col divide-y divide-border">
                    {model.sessions.map((session) => (
                        <li key={session.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                            <time dateTime={session.on} className="w-20 shrink-0 text-fg-subtle tabular-nums">
                                {day(session.on)}
                            </time>
                            <Link href={sessionHref(session.id)} className="min-w-0 flex-1 text-fg hover:underline">
                                {session.title}
                            </Link>
                            <span className="text-fg-muted">
                                {trainingTypeLabel(t, session.type)} · {sessionStatusLabel(t, session.status)}
                            </span>
                        </li>
                    ))}
                    {model.suspensions.map((item) => (
                        <li key={item.id} className="py-1.5 text-danger-fg">
                            {t("screens.camp.suspensionLine", { from: day(item.fromOn), to: day(item.toOn) })}
                        </li>
                    ))}
                </ol>
            </details>
        </Card>
    );
}

function Dot({ session, index }: { session: CampTimelineSession; index: number }) {
    const upcoming = session.status === "scheduled" || session.status === "in_progress";
    const missed = session.status === "missed" || session.status === "cancelled";
    return (
        <span
            className={cn("absolute size-3 -translate-x-1/2 rounded-full", styles.dot, missed && "opacity-35", upcoming && "border-2 bg-surface")}
            style={{
                left: `${session.at}%`,
                top: 4 + session.lane * LANE,
                background: upcoming ? undefined : TYPE_COLOR[session.type],
                borderColor: upcoming ? TYPE_COLOR[session.type] : undefined,
                animationDelay: `${Math.min(index * 12, 600)}ms`,
            }}
        />
    );
}

/** A day line under the rail; labels near the right edge hang to the left so they stay inside the card. */
function Marker({ at, label, className }: { at: number; label: string | null; className: string }) {
    return (
        <div className="absolute top-7 bottom-6 -translate-x-1/2" style={{ left: `${at}%` }}>
            <div className={cn("mx-auto h-full w-0.5", className)} />
            {label && <span className={cn("absolute top-full mt-1 text-[11px] font-semibold whitespace-nowrap text-fg-muted", at > 92 ? "right-0" : "left-1/2 -translate-x-1/2")}>{label}</span>}
        </div>
    );
}
