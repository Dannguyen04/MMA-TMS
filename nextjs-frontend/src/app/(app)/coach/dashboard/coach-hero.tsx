import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CardLink } from "@/components/dashboard/card-link";
import { ReadinessCell, ReadinessNumber } from "@/components/dashboard/readiness-strip";
import { CornerTag } from "@/components/ui/corner-tag";
import type { CampBout } from "@/lib/domain/bout";
import type { ClearanceState } from "@/lib/domain/rules";
import { academyDateOf, daysBetweenDates } from "@/lib/domain/suspension-rules";
import type { TrainingSession } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { ActiveSuspensionLine } from "./coach-todo-card";

export interface CoachHeroProps {
    /** Bouts in scope; null when the bout service failed. */
    bouts: CampBout[] | null;
    suspensions: ActiveSuspensionLine[];
    roster: { clearanceState: ClearanceState }[];
    todaySessions: Pick<TrainingSession, "status">[];
    fighterNames: Map<string, string>;
    now: string;
    t: Translator;
    locale: Locale;
}

/** The coach's version of the fighter hero: the nearest weigh-in on the hero ground, the camps' figures beside it (T-064). */
export function CoachHero({ bouts, suspensions, roster, todaySessions, fighterNames, now, t, locale }: CoachHeroProps) {
    const today = academyDateOf(now);
    const running = (bouts ?? [])
        .filter((b) => b.phase !== "COMPLETED" && b.phase !== "CANCELLED" && academyDateOf(b.boutAt) >= today)
        .sort((a, b) => a.weighInAt.localeCompare(b.weighInAt));
    const nearest = running[0];
    const days = nearest ? Math.max(0, daysBetweenDates(today, academyDateOf(nearest.weighInAt))) : 0;
    const scheduled = todaySessions.filter((s) => s.status !== "cancelled");
    const stats = [
        [t("coachToday.hero.running"), running.length],
        [t("coachToday.hero.suspended"), suspensions.length],
        [t("coachToday.hero.notCleared"), roster.filter((r) => r.clearanceState !== "full").length],
        [t("coachToday.hero.sessionsToday"), `${scheduled.filter((s) => s.status === "completed").length}/${scheduled.length}`, t("coachToday.hero.sessionsDone")],
    ] as const;

    return (
        <section aria-label={t("coachToday.hero.section")} className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="relative isolate flex min-w-0 flex-col gap-4 px-6 py-6 text-white sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-tl cage-hatch bg-hero-bg" />
                {nearest ? (
                    <>
                        <CornerTag tone="stage">{t("coachToday.hero.nearest")}</CornerTag>
                        <div>
                            <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">{nearest.event}</h2>
                            <p className="mt-1 text-[15px] text-white/85">
                                {fighterNames.get(nearest.fighterId) ?? t("weight.fighterFallback")} ·{" "}
                                {t("coachToday.hero.weighIn", { date: formatShortDate(nearest.weighInAt, locale) })}
                            </p>
                        </div>
                        <p className="flex items-end gap-3">
                            <span className="font-display text-[76px] leading-[0.8] font-extrabold tracking-tight tabular-nums italic sm:text-[88px]">{days}</span>
                            <span className="pb-1 font-display text-[15px] leading-tight font-bold tracking-[0.1em] uppercase">
                                {days > 0
                                    ? plural(t, "coachToday.hero.daysToWeighIn", days)
                                    : t(nearest.phase === "WEIGHED_IN" ? "coachToday.hero.weighedIn" : "weight.weighInTodayShort")}
                            </span>
                        </p>
                    </>
                ) : (
                    <div>
                        <h2 className="font-display text-[30px] leading-[1.05] font-extrabold italic sm:text-[34px]">{t("coachToday.hero.noBout")}</h2>
                        <p className="mt-1 max-w-md text-[15px] text-pretty text-white/85">{t("coachToday.hero.noBoutText")}</p>
                        <Link
                            href={routes.coach.newBout}
                            className="mt-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-sm text-[14px] font-semibold text-white underline-offset-2 hover:underline"
                        >
                            {t("coachToday.newBout")}
                            <ArrowRight aria-hidden className="size-4" />
                        </Link>
                    </div>
                )}
            </div>
            <div className="relative isolate flex min-w-0 flex-col gap-3 px-6 py-6 sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-br bg-surface" />
                <div role="group" aria-label={t("coachToday.hero.stats")} className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
                    {stats.map(([label, value, hint]) => (
                        <ReadinessCell
                            key={label}
                            label={label}
                            value={<ReadinessNumber value={<span className="tabular-nums">{value}</span>} />}
                            hint={hint}
                        />
                    ))}
                </div>
                <CardLink href={routes.coach.fighters} className="min-h-11 w-fit">
                    {t("coachToday.hero.roster")}
                </CardLink>
            </div>
        </section>
    );
}
