import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { describeDaysUntil, presentFacts } from "@/components/domain/domain-format";
import { FighterStatusBadges } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { stanceLabel, trainingLevelLabel, weightClassFullLabel } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { Fighter } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { recordSpoken, recordText } from "./dashboard-utils";

export interface FighterProfileHeaderProps {
    fighter: Fighter;
    clearanceState: ClearanceState;
    back: { href: string; label: string };
    actions?: ReactNode;
    /** Server time (ISO). */
    now: string;
    /** Small label above the name. */
    eyebrow?: string;
    /** Replaces the default facts (discipline, weight class, stance, level); the record always follows. */
    facts?: string[];
    /** Extra row under the status badges, e.g. clinical key facts. */
    meta?: ReactNode;
    /** Replaces the octagon avatar with a larger figure (the coach profile's 3D figure). */
    figure?: ReactNode;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

/** Page header for a fighter profile: octagon avatar, name as the page h1, key facts, status and the next bout. */
export function FighterProfileHeader({ fighter, clearanceState, back, actions, now, eyebrow, facts, meta, figure, locale = "en" }: FighterProfileHeaderProps) {
    const t = createTranslator(locale);
    const bout = fighter.upcomingBout;
    const factList =
        facts ??
        presentFacts(
            fighter.primaryDiscipline,
            weightClassFullLabel(fighter.weightClass, locale),
            fighter.stance === null ? null : stanceLabel(fighter.stance, locale),
            fighter.level === null ? null : trainingLevelLabel(fighter.level, locale),
        );
    const record = recordText(fighter);

    return (
        <header className="mb-6 flex flex-col gap-4">
            <Link href={back.href} className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm text-fg-muted hover:text-fg">
                <ChevronLeft aria-hidden className="size-4" />
                {back.label}
            </Link>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className={cn("flex min-w-0 items-start gap-4", figure ? "max-sm:flex-col max-sm:items-stretch sm:items-center sm:gap-6" : undefined)}>
                    {figure ?? <Avatar name={fighter.name} shape="octagon" size="xl" className="max-sm:size-14 max-sm:text-lg" />}
                    <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-fg-subtle uppercase">{eyebrow ?? t("screens.roster.header.eyebrow")}</p>
                        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance text-fg sm:text-[28px]">
                            {fighter.name}
                            {fighter.nickname && <span className="ml-2 text-lg font-normal tracking-normal text-fg-muted">“{fighter.nickname}”</span>}
                        </h1>
                        <p className="mt-1 text-[15px] text-pretty text-fg-muted">
                            {factList.join(" · ")}
                            {record && (
                                <>
                                    {" · "}
                                    <span className="font-medium whitespace-nowrap text-fg" aria-hidden>
                                        {record}
                                    </span>
                                    <span className="sr-only">{recordSpoken(fighter, t)}</span>
                                </>
                            )}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={clearanceState} locale={locale} />
                            {bout ? (
                                <span className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-surface-muted px-2 text-xs text-fg-muted ring-1 ring-border ring-inset">
                                    <Trophy aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                                    <span className="truncate">
                                        <span className="font-medium text-fg">{bout.event}</span> vs {bout.opponent} ·{" "}
                                        <time dateTime={bout.date}>{formatDate(bout.date, locale)}</time> ({describeDaysUntil(daysBetween(now, bout.date), locale)})
                                    </span>
                                </span>
                            ) : (
                                <span className="text-xs text-fg-subtle">{t("screens.roster.noBoutScheduled")}</span>
                            )}
                        </div>
                        {meta && <div className="mt-2 text-[13px] text-fg-muted">{meta}</div>}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
            </div>
        </header>
    );
}
