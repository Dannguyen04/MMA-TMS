import { Activity, CircleCheck, Flag, HeartHandshake, Hourglass, LineChart as LineChartIcon, MapPinned, NotebookPen, RefreshCw, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { injuryTitle } from "@/components/clinical/clinical-copy";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { CheckInTrends } from "@/components/dashboard/check-in-trends";
import { InlineNote } from "@/components/dashboard/inline-note";
import { BodyMapAuto } from "@/components/fighter-3d/body/body-map-auto";
import { toFigureSource } from "@/components/fighter-3d/figure-params";
import { CheckInCharts } from "@/components/domain/check-in-charts";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { INJURY_STATUS_META, InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import type { Tone } from "@/components/ui/tone";
import { requireRole } from "@/lib/auth/session";
import { bodyRegionLabel, injuryMechanismLabel, injurySeverityLabel, injuryStatusLabel, injuryTypeName } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getInjuryDetail, type InjuryDetail } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getFighter, listDoctors } from "@/lib/services/people";

/** The injury, only when it belongs to the signed-in fighter. Loaded once per request for the metadata and the page. */
const loadOwnInjury = cache(async (injuryId: string): Promise<InjuryDetail> => {
    const user = await requireRole("fighter");
    const detail = await getInjuryDetail(injuryId);
    if (!detail || !user.profileId || detail.injury.fighterId !== user.profileId) notFound();
    return detail;
});

export async function generateMetadata({ params }: PageProps<"/fighter/health/injuries/[injuryId]">): Promise<Metadata> {
    const [{ injury }, { locale }] = await Promise.all([loadOwnInjury((await params).injuryId), getTranslator()]);
    return { title: injuryTitle(injury, locale) };
}

export default async function FighterInjuryPage({ params }: PageProps<"/fighter/health/injuries/[injuryId]">) {
    const [detail, doctors, { t, locale }] = await Promise.all([
        params.then(({ injuryId }) => loadOwnInjury(injuryId)),
        listDoctors(),
        getTranslator(),
    ]);
    const { injury, treatments, recoveryPlan, recordedBy } = detail;
    // Only shapes the 3D figure (sex, height, build); the body map still works without it.
    const fighter = await getFighter(injury.fighterId).catch(() => null);
    const now = new Date().toISOString();
    const planDoctor = recoveryPlan ? doctors.find((doctor) => doctor.id === recoveryPlan.doctorId)?.name : undefined;
    const doctorName = planDoctor ?? recordedBy?.name;
    // The medical service keeps the expected return on the recovery plan, not on the injury.
    const expectedReturnAt = injury.expectedReturnAt ?? (recoveryPlan?.status === "active" ? recoveryPlan.targetReturnDate : null);
    const expectation = whatToExpect({ ...injury, expectedReturnAt }, now, t, locale);
    /** Without a recovery plan the main column is short, so the facts sit there in columns; otherwise they go beside it. */
    const aboutInMain = !recoveryPlan;
    const serviceRecord = injury.joint !== undefined;
    const notRecorded = t("health.notRecorded");

    const about = (
        <Card className="min-w-0">
            <CardHeader title={t("fighterInjury.aboutTitle")} icon={<NotebookPen />} />
            <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-pretty text-fg">{injury.description}</p>
                <DescriptionList
                    columns={aboutInMain ? 3 : 1}
                    className={aboutInMain ? undefined : "gap-y-3"}
                    items={[
                        { label: t("fighterHistory.thType"), value: injuryTypeName(injury, locale) },
                        { label: t("fighterInjury.fieldArea"), value: bodyRegionLabel(injury.bodyRegion, locale) },
                        { label: t("fighterInjury.fieldStatus"), value: injuryStatusLabel(injury.status, locale) },
                        // The medical service keeps no mechanism, diagnosis date or expected return; its records skip those rows.
                        ...(serviceRecord ? [] : [{ label: t("fighterInjury.fieldHowItHappened"), value: injury.mechanism ? injuryMechanismLabel(injury.mechanism, locale) : notRecorded }]),
                        { label: t("fighterInjury.fieldOccurred"), value: <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt, locale)}</time> },
                        ...(serviceRecord
                            ? []
                            : [{ label: t("fighterInjury.fieldDiagnosed"), value: injury.diagnosedAt ? <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt, locale)}</time> : notRecorded }]),
                        ...(injury.resolvedAt
                            ? [{ label: t("fighterInjury.fieldResolved"), value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt, locale)}</time> }]
                            : serviceRecord
                              ? []
                              : [
                                    {
                                        label: t("fighterInjury.fieldExpectedReturn"),
                                        value: injury.expectedReturnAt ? <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt, locale)}</time> : t("injuryCard.toBeAssessed"),
                                    },
                                ]),
                        { label: t("fighterInjury.fieldRecordedBy"), value: recordedBy?.name ?? t("fighterInjury.doctorFallback") },
                        {
                            label: t("fighterInjury.fieldSeverity"),
                            wide: true,
                            value: (
                                <span className="flex flex-col gap-0.5">
                                    {injurySeverityLabel(injury.severity, locale)}
                                    <span className="text-[13px] font-normal text-fg-muted">{t(`injurySeverityDesc.${injury.severity}`)}</span>
                                </span>
                            ),
                        },
                    ]}
                />
                {doctorName && (
                    <InlineNote icon={HeartHandshake}>
                        {t("fighterInjury.questionsAboutRecovery", { doctor: doctorName })}
                    </InlineNote>
                )}
            </CardContent>
        </Card>
    );

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.health, label: t("fighterInjury.backLabel") }}
                eyebrow={t("fighterInjury.eyebrow")}
                title={injuryTitle(injury, locale)}
                description={[injury.mechanism ? injuryMechanismLabel(injury.mechanism, locale) : undefined, formatDate(injury.occurredAt, locale)].filter(Boolean).join(" · ")}
                meta={
                    <>
                        <InjurySeverityBadge severity={injury.severity} locale={locale} />
                        <InjuryStatusBadge status={injury.status} locale={locale} />
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <Callout
                        tone={expectation.tone}
                        icon={expectation.icon}
                        title={expectation.title}
                        action={
                            <ButtonLink href={routes.fighter.health} variant="secondary" size="sm">
                                {t("fighterInjury.viewMedicalClearance")}
                            </ButtonLink>
                        }
                    >
                        {expectation.body}
                    </Callout>

                    {aboutInMain && about}

                    {recoveryPlan && (
                        <Card className="min-w-0">
                            <CardHeader
                                title={t("fighterInjury.recoveryPlan")}
                                description={`${recoveryPlan.title}${planDoctor ? ` · ${planDoctor}` : ""}`}
                                icon={<RefreshCw />}
                            />
                            <CardContent>
                                <RecoveryProgress plan={recoveryPlan} now={now} locale={locale} />
                            </CardContent>
                        </Card>
                    )}

                    {recoveryPlan && medicalFeatureAvailable("recoveryPhasesAndCheckIns") && (
                        <Card className="min-w-0">
                            <CardHeader title={t("fighterInjury.checkIns")} description={t("fighterInjury.checkInsDesc")} icon={<LineChartIcon />} />
                            <CardContent className="flex flex-col gap-6">
                                <CheckInTrends locale={locale === "en" ? undefined : locale} checkIns={recoveryPlan.checkIns} now={now} />
                                {recoveryPlan.checkIns.length >= 2 ? (
                                    <div className="border-t border-border pt-5">
                                        <CheckInCharts checkIns={recoveryPlan.checkIns} audience="fighter" locale={locale} />
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-fg-muted">{t("fighterInjury.trendChartsHint")}</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader title={t("fighterInjury.treatments")} description={plural(t, "fighterInjury.treatmentCount", treatments.length)} icon={<Activity />} />
                        {treatments.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<Activity />}
                                title={t("fighterInjury.noTreatmentsTitle")}
                                description={t("fighterInjury.noTreatmentsDesc")}
                                className="border-t border-border"
                            />
                        ) : (
                            <TreatmentList treatments={treatments} className="border-t border-border" locale={locale} />
                        )}
                    </Card>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    {!aboutInMain && about}

                    <Card className="min-w-0">
                        <CardHeader title={t("fighterInjury.bodyMap")} icon={<MapPinned />} />
                        <CardContent>
                            <BodyMapAuto
                                locale={locale}
                                figure={fighter ? toFigureSource(fighter) : null}
                                focus={injury.bodyRegion}
                                highlights={[
                                    {
                                        region: injury.bodyRegion,
                                        tone: INJURY_STATUS_META[injury.status].tone,
                                        label: `${injuryTypeName(injury, locale)} · ${injuryStatusLabel(injury.status, locale).toLowerCase()}`,
                                    },
                                ]}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

function whatToExpect(injury: Injury, now: string, t: Translator, locale: Locale): { tone: Tone; icon: LucideIcon; title: string; body: string } {
    if (injury.status === "resolved") {
        return {
            tone: "success",
            icon: CircleCheck,
            title: injury.resolvedAt ? t("fighterInjury.expectResolvedTitle", { date: formatDate(injury.resolvedAt, locale) }) : t("fighterInjury.expectResolvedTitleNoDate"),
            body: t("fighterInjury.expectResolvedBody"),
        };
    }
    if (!injury.expectedReturnAt) {
        return {
            tone: "info",
            icon: Hourglass,
            title: t("fighterInjury.expectToBeConfirmedTitle"),
            body: t("fighterInjury.expectToBeConfirmedBody"),
        };
    }
    const days = daysBetween(now, injury.expectedReturnAt);
    if (days < 0) {
        return {
            tone: "info",
            icon: Hourglass,
            title: t("fighterInjury.expectTakingLongerTitle"),
            body: t("fighterInjury.expectTakingLongerBody", { date: formatDate(injury.expectedReturnAt, locale) }),
        };
    }
    return {
        tone: "info",
        icon: Flag,
        title: days === 0 ? t("fighterInjury.expectTodayTitle") : t("fighterInjury.expectDaysTitle", { when: describeDaysUntil(days, locale) }),
        body: t("fighterInjury.expectDaysBody", { date: formatDate(injury.expectedReturnAt, locale) }),
    };
}
