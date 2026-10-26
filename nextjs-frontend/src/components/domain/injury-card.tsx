import Link from "next/link";

import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { injuryMechanismLabel } from "@/lib/domain/labels";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { describeDaysUntil } from "./domain-format";
import { InjurySeverityBadge, InjuryStatusBadge } from "./status-badges";

export interface InjuryCardProps {
    injury: Injury;
    /** Server time (ISO) used for days to expected return. */
    now: string;
    /** Makes the whole card a link to the injury. */
    href?: string;
    headingLevel?: 2 | 3;
    className?: string;
    locale?: Locale;
}

/** Injury summary: what and where, severity + status, key dates and mechanism. */
export function InjuryCard({ injury, now, href, headingLevel = 3, className, locale = "en" }: InjuryCardProps) {
    const t = createTranslator(locale);
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const title = injuryTitle(injury, locale);

    // The medical service records the joint but no diagnosis date, mechanism or expected return: show only what it keeps.
    const serviceRecord = injury.joint !== undefined;
    const notRecorded = t("health.notRecorded");
    const items: DescriptionItem[] = serviceRecord
        ? [
              { label: t("injuryCard.occurred"), value: <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time> },
              ...(injury.resolvedAt ? [{ label: t("injuryCard.resolved"), value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt, locale)}</time> }] : []),
          ]
        : [
              { label: t("injuryCard.occurred"), value: <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time> },
              { label: t("injuryCard.diagnosed"), value: injury.diagnosedAt ? <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt, locale)}</time> : notRecorded },
              { label: t("injuryCard.mechanism"), value: injury.mechanism ? injuryMechanismLabel(injury.mechanism, locale) : notRecorded },
              { label: injury.resolvedAt ? t("injuryCard.resolved") : t("injuryCard.expectedReturn"), value: <ReturnValue injury={injury} now={now} locale={locale} /> },
          ];

    return (
        <article
            className={cn(
                "relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card",
                href && "transition-colors hover:border-border-strong hover:bg-surface-muted/40",
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <Heading className="min-w-0 text-[15px] leading-6 font-semibold text-fg">
                    {href ? (
                        <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline">
                            {title}
                        </Link>
                    ) : (
                        title
                    )}
                </Heading>
                <div className="flex flex-wrap gap-1.5">
                    <InjurySeverityBadge severity={injury.severity} size="sm" locale={locale} />
                    <InjuryStatusBadge status={injury.status} size="sm" locale={locale} />
                </div>
            </div>
            <p className="line-clamp-2 text-sm text-pretty text-fg-muted">{injury.description}</p>
            <DescriptionList items={items} className="gap-y-3" />
        </article>
    );
}

function ReturnValue({ injury, now, locale = "en" }: { injury: Injury; now: string; locale?: Locale }) {
    const t = createTranslator(locale);
    if (injury.resolvedAt) {
        return <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt, locale)}</time>;
    }
    if (!injury.expectedReturnAt) {
        return <span className="font-normal text-fg-muted">{t("injuryCard.toBeAssessed")}</span>;
    }
    const days = daysBetween(now, injury.expectedReturnAt);
    return (
        <span className="flex flex-col gap-0.5">
            <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt, locale)}</time>
            <span className="text-[13px] font-normal text-fg-muted">
                {days < 0
                    ? t("injuryCard.targetPassed", { when: describeDaysUntil(days, locale) })
                    : t("injuryCard.returnWhen", { when: describeDaysUntil(days, locale) })}
            </span>
        </span>
    );
}
