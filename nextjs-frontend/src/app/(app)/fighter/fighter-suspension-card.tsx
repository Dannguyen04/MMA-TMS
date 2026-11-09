import { Ban, CircleAlert, Lock } from "lucide-react";

import { CardLink } from "@/components/dashboard/card-link";
import { GradedReturnSteps } from "@/components/domain/graded-return-steps";
import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { SuspensionStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    pickFighterSuspension,
    sessionTypesUpToTier,
    suspensionHeadline,
    suspensionLadder,
    suspensionTierToday,
    type SuspensionHeadline,
} from "@/lib/domain/fighter-suspension-view";
import type { SessionType } from "@/lib/domain/medical-contract";
import { suspensionReasonLabel } from "@/lib/domain/suspension-rules";
import type { Suspension } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface FighterSuspensionCardProps {
    /** The fighter's live suspensions (`listLiveSuspensions`); null when the suspensions service didn't answer. */
    suspensions: readonly Suspension[] | null;
    /** Academy date (YYYY-MM-DD), for the badge's "day 2 of 7". */
    today: string;
    locale: Locale;
    /** Where the full story lives; Today links to Health. */
    href?: string;
    className?: string;
}

/**
 * T-048 §2.1: the fighter's suspension, read only. One suspension (the strictest), its main sentence, the reason,
 * the intensity ladder with what may be trained, and the graded-return steps. Nothing when no suspension is live.
 */
export function FighterSuspensionCard({ suspensions, today, locale, href, className }: FighterSuspensionCardProps) {
    const t = createTranslator(locale);
    if (suspensions === null) {
        return (
            <Callout tone="warning" icon={CircleAlert} title={t("fighterSuspension.unavailableTitle")} className={className}>
                {t("fighterSuspension.unavailableBody")}
            </Callout>
        );
    }

    const pick = pickFighterSuspension(suspensions);
    if (!pick) return null;
    const { main, others } = pick;
    const headline = suspensionHeadline(main);

    return (
        <Card className={cn("min-w-0", className)} data-suspension-id={main.id}>
            <CardHeader
                title={t("fighterSuspension.title")}
                icon={<Ban />}
                action={
                    href ? (
                        <CardLink href={href} srContext={t("fighterSuspension.detailsContext")}>
                            {t("health.details")}
                        </CardLink>
                    ) : undefined
                }
            />
            <CardContent className="flex flex-col gap-4">
                {/* Phones read top to bottom; wider cards put the ladder beside the sentence. */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <SuspensionStatusBadge
                            status={main.gradedReturn ? "GRADED_RETURN" : main.status}
                            ceiling={main.gradedReturn?.ceiling}
                            startsOn={main.startsOn}
                            endsOn={main.endsOn}
                            today={today}
                            locale={locale}
                            className="w-fit"
                        />
                        <p className="text-[17px] leading-snug font-semibold text-pretty text-fg">{headlineText(headline, t, locale)}</p>
                        {headline.kind === "active" && headline.clearanceAfter && (
                            <p className="text-sm text-pretty text-fg-muted">{t("fighterSuspension.clearanceAfterEnd")}</p>
                        )}
                        <p className="text-sm text-fg-muted">{t("fighterSuspension.reason", { reason: suspensionReasonLabel(main.reason, t) })}</p>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2">
                        <p className="text-[13px] font-medium text-fg-muted">{t("fighterSuspension.ladderCaption")}</p>
                        <IntensityLadder {...suspensionLadder(main)} size="md" locale={locale} className="max-w-xs" />
                        <p className="text-sm font-medium text-pretty text-fg">{allowedText(main, sessionTypesUpToTier(suspensionTierToday(main)), t, locale)}</p>
                    </div>
                </div>

                {main.gradedReturn && <GradedReturnSteps gradedReturn={main.gradedReturn} locale={locale} className="md:max-w-xl" />}

                {others > 0 && <p className="text-sm font-medium text-fg">{plural(t, "fighterSuspension.others", others)}</p>}

                <p className="flex items-start gap-1.5 text-xs text-fg-subtle">
                    <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
                    {t("fighterSuspension.readOnly")}
                </p>
            </CardContent>
        </Card>
    );
}

function headlineText(headline: SuspensionHeadline, t: Translator, locale: Locale): string {
    switch (headline.kind) {
        case "gradedReturn":
            return t("fighterSuspension.headline.gradedReturn", { date: formatShortDate(headline.fullReturnOn, locale) });
        case "awaitingClearance":
            return t("fighterSuspension.headline.awaitingClearance");
        case "active":
            return t("fighterSuspension.headline.active", { date: formatShortDate(headline.endsOn, locale) });
        case "upcoming":
            return t("fighterSuspension.headline.upcoming", {
                start: formatShortDate(headline.startsOn, locale),
                end: formatShortDate(headline.endsOn, locale),
            });
    }
}

/** "Được tập: hồi phục, vật lý trị liệu"; "Hôm nay …" in graded return, whose ceiling moves daily; "Từ {date} …" before it starts. */
function allowedText(suspension: Suspension, types: SessionType[], t: Translator, locale: Locale): string {
    if (types.length === 0) return t("fighterSuspension.allowedNone");
    const list = types.map((type) => t(`fighterSuspension.sessionType.${type}`)).join(", ");
    if (suspension.status === "UPCOMING") {
        return t("fighterSuspension.allowedFrom", { date: formatShortDate(suspension.startsOn, locale), types: list });
    }
    return t(suspension.gradedReturn ? "fighterSuspension.allowedToday" : "fighterSuspension.allowed", { types: list });
}
