import { CalendarDays, CalendarOff } from "lucide-react";
import type { ReactNode } from "react";

import type { ClearanceState } from "@/lib/domain/rules";
import type { Fighter } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { recordSpoken, recordText } from "@/components/dashboard/dashboard-utils";
import { FighterPortrait } from "@/components/fighter-3d/fighter-portrait";
import { capitalize, describeDaysUntil } from "./domain-format";
import { FighterIdentity } from "./fighter-identity";
import { FighterStatusBadges } from "./status-badges";

export interface FighterCardProps {
    fighter: Fighter;
    clearanceState: ClearanceState;
    /** Server time (ISO) used for "days to go". */
    now: string;
    /** Makes the whole card a link to the fighter. */
    href?: string;
    /** Extra content under the bout row, e.g. a performance sparkline. */
    children?: ReactNode;
    className?: string;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

/** Roster card: the fighter's 3D figure, identity, record, discipline, health + clearance, and the next bout. */
export function FighterCard({ fighter, clearanceState, now, href, children, className, locale = "en" }: FighterCardProps) {
    const t = createTranslator(locale);
    const bout = fighter.upcomingBout;
    const daysToBout = bout ? daysBetween(now, bout.date) : null;

    return (
        <article
            className={cn(
                "relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-card",
                href && "transition-colors hover:border-border-strong hover:bg-surface-muted/40",
                className,
            )}
        >
            <div className="relative -mx-4 -mt-4">
                <FighterPortrait figure={fighter} className="h-52 rounded-t-xl" />
                {fighter.record && (
                    <p className="pointer-events-none absolute top-3 right-4 text-right">
                        <span className="block font-display text-[22px] leading-none font-extrabold text-fg italic tabular-nums" aria-hidden>
                            {recordText(fighter)}
                        </span>
                        <span className="sr-only">{recordSpoken(fighter, t)}</span>
                        <span aria-hidden className="mt-1 block text-[11px] tracking-wide text-fg-subtle uppercase">
                            W-L-D
                        </span>
                    </p>
                )}
            </div>

            <FighterIdentity fighter={fighter} href={href} stretchedLink={Boolean(href)} locale={locale} />

            <div className="flex flex-wrap items-center gap-1.5">
                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={clearanceState} size="sm" locale={locale} />
                {fighter.primaryDiscipline && <span className="text-xs text-fg-muted">{fighter.primaryDiscipline}</span>}
            </div>

            {bout && daysToBout !== null ? (
                <div className="flex items-start gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px]">
                    <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                    <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{bout.event}</p>
                        <p className="truncate text-fg-muted">
                            vs {bout.opponent} · <time dateTime={bout.date}>{formatDate(bout.date, locale)}</time>
                        </p>
                    </div>
                    <p className="ml-auto shrink-0 text-right font-medium text-fg">
                        {daysToBout > 1 ? t("screens.roster.daysToGo", { n: daysToBout }) : capitalize(describeDaysUntil(daysToBout, locale))}
                    </p>
                </div>
            ) : (
                <p className="flex items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] text-fg-muted">
                    <CalendarOff aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                    {t("screens.roster.noBoutScheduled")}
                </p>
            )}

            {children && <div className="relative">{children}</div>}
        </article>
    );
}
