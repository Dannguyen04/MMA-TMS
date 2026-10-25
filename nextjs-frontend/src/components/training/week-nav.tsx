import type { Locale } from "@/lib/i18n/config";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { addDaysToKey, formatDate, formatShortDate } from "@/lib/format";
import { createTranslator } from "@/lib/i18n/translate";
import { hrefWith, type SearchParams } from "@/lib/query";
import { MAX_WEEK_OFFSET, describeWeekOffset } from "./training-utils";

/** Week range as text, e.g. "14 – 20 Sept 2026". */
export function weekRangeLabel(startKey: string, locale: Locale = "en"): string {
    const start = `${startKey}T12:00:00Z`;
    const end = `${addDaysToKey(startKey, 6)}T12:00:00Z`;
    return `${formatShortDate(start, locale)} – ${formatDate(end, locale)}`;
}

export interface WeekNavProps {
    locale?: Locale;
    pathname: string;
    searchParams: SearchParams;
    offset: number;
    /** Monday of the shown week, YYYY-MM-DD. */
    startKey: string;
}

/** Previous / next week and "This week" links driven by ?week=. */
export function WeekNav({ pathname, searchParams, offset, startKey, locale = "en" }: WeekNavProps) {
    const t = createTranslator(locale);
    const href = (week: number) => hrefWith(pathname, searchParams, { week: week === 0 ? null : week });
    const range = weekRangeLabel(startKey, locale);
    return (
        <nav aria-label={t("training.weekNav.aria")} className="flex items-center gap-1.5">
            <ButtonLink
                href={href(offset - 1)}
                variant="secondary"
                size="icon-sm"
                scroll={false}
                aria-label={t("training.weekNav.prevWeekLabel", { offset: describeWeekOffset(offset - 1, locale).toLowerCase() })}
                aria-disabled={offset <= -MAX_WEEK_OFFSET}
                tabIndex={offset <= -MAX_WEEK_OFFSET ? -1 : undefined}
            >
                <ChevronLeft />
            </ButtonLink>
            <ButtonLink
                href={href(0)}
                variant="secondary"
                size="sm"
                scroll={false}
                aria-current={offset === 0 ? "date" : undefined}
                aria-disabled={offset === 0}
                tabIndex={offset === 0 ? -1 : undefined}
            >
                {t("training.weekNav.thisWeek")}
            </ButtonLink>
            <ButtonLink
                href={href(offset + 1)}
                variant="secondary"
                size="icon-sm"
                scroll={false}
                aria-label={t("training.weekNav.nextWeekLabel", { offset: describeWeekOffset(offset + 1, locale).toLowerCase() })}
                aria-disabled={offset >= MAX_WEEK_OFFSET}
                tabIndex={offset >= MAX_WEEK_OFFSET ? -1 : undefined}
            >
                <ChevronRight />
            </ButtonLink>
            <span className="sr-only" aria-live="polite">
                {t("training.weekNav.showing", { range })}
            </span>
        </nav>
    );
}
