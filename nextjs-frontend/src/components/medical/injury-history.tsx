import { Bandage } from "lucide-react";
import Link from "next/link";

import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { bodyRegionLabel, injuryMechanismLabel, injuryTypeName } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export interface InjuryHistoryProps {
    injuries: Injury[];
    locale?: Locale;
}

/** Every injury recorded for a fighter, open and resolved, most recent first. */
export function InjuryHistory({ injuries, locale = "en" }: InjuryHistoryProps) {
    const t = createTranslator(locale);

    if (injuries.length === 0) {
        return (
            <EmptyState
                compact
                icon={<Bandage />}
                title={t("injuryHistory.emptyTitle")}
                description={t("injuryHistory.emptyDesc")}
            />
        );
    }

    return (
        <Table caption={t("injuryHistory.caption")}>
            <THead>
                <tr>
                    <TH>{t("injuryHistory.thInjury")}</TH>
                    <TH>{t("injuryHistory.thSeverity")}</TH>
                    <TH>{t("injuryHistory.thStatus")}</TH>
                    <TH>{t("injuryHistory.thOccurred")}</TH>
                    <TH>{t("injuryHistory.thReturnResolved")}</TH>
                    <TH>{t("injuryHistory.thMechanism")}</TH>
                </tr>
            </THead>
            <TBody>
                {injuries.map((injury) => (
                    <TR key={injury.id}>
                        <TD className="min-w-52">
                            <Link href={routes.doctor.injury(injury.id)} className="rounded-sm font-medium text-fg hover:underline">
                                {injuryTypeName(injury, locale)}
                            </Link>
                            <span className="block text-xs text-fg-muted">{bodyRegionLabel(injury.bodyRegion, locale)}</span>
                        </TD>
                        <TD>
                            <InjurySeverityBadge severity={injury.severity} size="sm" locale={locale} />
                        </TD>
                        <TD>
                            <InjuryStatusBadge status={injury.status} size="sm" locale={locale} />
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">
                            <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time>
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">
                            {injury.resolvedAt ? (
                                <span>
                                    {t("injuryHistory.resolvedOn", { date: formatDate(injury.resolvedAt, locale) })}
                                </span>
                            ) : injury.expectedReturnAt ? (
                                <span>
                                    {t("injuryHistory.expectedOn", { date: formatDate(injury.expectedReturnAt, locale) })}
                                </span>
                            ) : (
                                <span className="text-fg-muted">{t("injuryHistory.toBeAssessed")}</span>
                            )}
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">
                            {injury.mechanism ? injuryMechanismLabel(injury.mechanism, locale) : t("health.notRecorded")}
                        </TD>
                    </TR>
                ))}
            </TBody>
        </Table>
    );
}
