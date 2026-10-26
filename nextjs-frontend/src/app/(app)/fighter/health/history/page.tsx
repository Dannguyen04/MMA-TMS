import { Bandage, History, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { injuryTitle } from "@/components/clinical/clinical-copy";
import { medicalHistoryItems } from "@/components/dashboard/health-data";
import { ActivityTimeline } from "@/components/domain/activity-timeline";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { ExaminationOutcomeBadge } from "@/components/medical/clinical-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { examinationTitle } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getInjuryDetail, listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("fighterHistory.metaTitle") };
}

export default async function FighterMedicalHistoryPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const ids = [fighter.id];
    const now = new Date().toISOString();
    const { t, locale } = await getTranslator();

    const [examinations, injuries, clearances, doctors] = await Promise.all([
        listExaminations({ fighterIds: ids }),
        listInjuries({ fighterIds: ids }),
        listClearances({ fighterIds: ids }),
        listDoctors(),
    ]);
    const details = await Promise.all(injuries.map((injury) => getInjuryDetail(injury.id)));
    const treatments = details.flatMap((detail) => detail?.treatments ?? []);
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const timeline = medicalHistoryItems({ examinations, injuries, treatments, clearances, doctorNames }, locale);

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.health, label: t("fighterHistory.backLabel") }}
                eyebrow={t("fighterHistory.eyebrow")}
                title={t("fighterHistory.title")}
                description={t("fighterHistory.desc")}
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                <Card className="min-w-0 lg:col-span-5">
                    <CardHeader
                        title={t("fighterHistory.timelineTitle")}
                        description={plural(t, "fighterHistory.eventCount", timeline.length)}
                        icon={<History />}
                    />
                    <CardContent>
                        <ActivityTimeline
                            items={timeline}
                            now={now}
                            emptyText={t("fighterHistory.timelineEmpty")}
                            locale={locale}
                        />

                    </CardContent>
                </Card>

                <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader
                            title={t("fighterHistory.examinationsTitle")}
                            description={plural(t, "fighterHistory.examCount", examinations.length)}
                            icon={<Stethoscope />}
                        />
                        {examinations.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<Stethoscope />}
                                title={t("fighterHistory.noExaminationsTitle")}
                                description={t("fighterHistory.noExaminationsDesc")}
                                className="border-t border-border"
                            />
                        ) : (
                            <div className="hidden border-t border-border sm:block">
                                <Table caption={t("fighterHistory.tableExaminationsCaption")}>
                                    <THead>
                                        <tr>
                                            <TH>{t("fighterHistory.thDate")}</TH>
                                            <TH>{t("fighterHistory.thType")}</TH>
                                            <TH>{t("fighterHistory.thOutcome")}</TH>
                                            <TH>{t("fighterHistory.thDoctor")}</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {examinations.map((exam) => (
                                            <TR key={exam.id}>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={exam.date}>{formatDate(exam.date, locale)}</time>
                                                </TD>
                                                <TD className="min-w-44">{examinationTitle(exam, locale)}</TD>
                                                <TD>
                                                    <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" locale={locale} />
                                                </TD>
                                                <TD className="whitespace-nowrap text-fg-muted">{doctorNames.get(exam.doctorId) ?? t("fighterHistory.doctorFallback")}</TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        )}
                        {examinations.length > 0 && (
                            <ul aria-label={t("fighterHistory.tableExaminationsCaption")} className="flex flex-col divide-y divide-border border-t border-border sm:hidden">
                                {examinations.map((exam) => (
                                    <li key={exam.id} className="flex items-start justify-between gap-3 px-5 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-fg">{examinationTitle(exam, locale)}</p>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">
                                                <time dateTime={exam.date}>{formatDate(exam.date, locale)}</time> · {doctorNames.get(exam.doctorId) ?? t("fighterHistory.doctorFallback")}
                                            </p>
                                        </div>
                                        <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" className="shrink-0" locale={locale} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader
                            title={t("fighterHistory.injuriesTitle")}
                            description={plural(t, "fighterHistory.injuryCount", injuries.length)}
                            icon={<Bandage />}
                        />
                        {injuries.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<Bandage />}
                                title={t("fighterHistory.noInjuriesTitle")}
                                description={t("fighterHistory.noInjuriesDesc")}
                                className="border-t border-border"
                            />
                        ) : (
                            <div className="hidden border-t border-border sm:block">
                                <Table caption={t("fighterHistory.tableInjuriesCaption")}>
                                    <THead>
                                        <tr>
                                            <TH>{t("fighterHistory.thInjury")}</TH>
                                            <TH>{t("fighterHistory.thSeverity")}</TH>
                                            <TH>{t("fighterHistory.thStatus")}</TH>
                                            <TH>{t("fighterHistory.thOccurred")}</TH>
                                            <TH>{t("fighterHistory.thReturn")}</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {injuries.map((injury) => (
                                            <TR key={injury.id}>
                                                <TD className="min-w-48">
                                                    <Link href={routes.fighter.injury(injury.id)} className="rounded-sm font-medium text-fg hover:underline">
                                                        {injuryTitle(injury, locale)}
                                                    </Link>
                                                </TD>
                                                <TD>
                                                    <InjurySeverityBadge severity={injury.severity} size="sm" locale={locale} />
                                                </TD>
                                                <TD>
                                                    <InjuryStatusBadge status={injury.status} size="sm" locale={locale} />
                                                </TD>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time>
                                                </TD>
                                                <TD className="whitespace-nowrap text-fg-muted">
                                                    <ReturnText injury={injury} now={now} locale={locale} />
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        )}
                        {injuries.length > 0 && (
                            <ul aria-label={t("fighterHistory.tableInjuriesCaption")} className="flex flex-col divide-y divide-border border-t border-border sm:hidden">
                                {injuries.map((injury) => (
                                    <li key={injury.id} className="flex flex-col gap-2 px-5 py-3.5">
                                        <Link href={routes.fighter.injury(injury.id)} className="w-fit rounded-sm text-sm font-medium text-fg hover:underline">
                                            {injuryTitle(injury, locale)}
                                        </Link>
                                        <div className="flex flex-wrap gap-1.5">
                                            <InjurySeverityBadge severity={injury.severity} size="sm" locale={locale} />
                                            <InjuryStatusBadge status={injury.status} size="sm" locale={locale} />
                                        </div>
                                        <dl className="grid grid-cols-2 gap-3 text-[13px]">
                                            <div>
                                                <dt className="text-fg-muted">{t("fighterHistory.occurred")}</dt>
                                                <dd className="text-fg">
                                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time>
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-muted">{t("fighterHistory.return")}</dt>
                                                <dd className="text-fg-muted">
                                                    <ReturnText injury={injury} now={now} locale={locale} />
                                                </dd>
                                            </div>
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

/** When the fighter returned or is expected back, or that it is still to be assessed. */
function ReturnText({ injury, now, locale = "en" }: { injury: Injury; now: string; locale?: Locale }) {
    const t = createTranslator(locale);
    if (injury.resolvedAt) {
        return (
            <>
                <time dateTime={injury.resolvedAt} className="text-fg">
                    {formatDate(injury.resolvedAt, locale)}
                </time>
                <span className="block text-xs">{t("fighterHistory.resolved")}</span>
            </>
        );
    }
    if (injury.expectedReturnAt) {
        return (
            <>
                <time dateTime={injury.expectedReturnAt} className="text-fg">
                    {formatDate(injury.expectedReturnAt, locale)}
                </time>
                <span className="block text-xs">
                    {t("fighterHistory.expected", { when: describeDaysUntil(daysBetween(now, injury.expectedReturnAt), locale) })}
                </span>
            </>
        );
    }
    return <>{t("fighterHistory.toBeAssessed")}</>;
}
