import { CalendarClock, ClipboardList, NotebookPen, ShieldCheck, Stethoscope, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { capitalize } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { ClearanceBadge, FighterStatusBadges } from "@/components/domain/status-badges";
import { VitalsGrid } from "@/components/domain/vitals-grid";
import {
    AssessmentResultBadge,
    CLEARANCE_LEVEL_FOR_OUTCOME,
    ClearanceRecordStatusBadge,
    EXAMINATION_OUTCOME_DESCRIPTION_KEYS,
    EXAMINATION_OUTCOME_META,
    ExaminationOutcomeBadge,
} from "@/components/medical/clinical-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { PrintButton } from "@/components/medical/print-button";
import { Scat6Summary } from "@/components/medical/scat6-summary";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { assessmentAreaLabel, examinationTitle } from "@/lib/domain/labels";
import { clearanceState, currentClearance, type ClearanceState } from "@/lib/domain/rules";
import type { ClearanceLevel, ExaminationOutcome } from "@/lib/domain/types";
import { daysBetween, formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getExamination, listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { BodyPanel } from "@/components/doctor/body-panel";
import { Panel } from "@/components/doctor/ui";
import { getFighter, listDoctors } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

import { daysUntil } from "./days-until";

const PRINT_STYLES = `
@media print {
    body * { visibility: hidden; }
    #examination-report, #examination-report * { visibility: visible; }
    #examination-report { position: absolute; top: 0; left: 0; width: 100%; }
    #examination-report header > a { display: none; }
}
`;

/** The examination and its fighter, loaded once per request for the metadata and the page. Null when missing or not assigned. */
const loadExamination = cache(async (examId: string) => {
    const user = await requireRole("doctor");
    const exam = await getExamination(examId);
    if (!exam || !canAccessFighter(user, exam.fighterId)) return null;
    const fighter = await getFighter(exam.fighterId);
    return fighter ? { exam, fighter } : null;
});

/** The fighter an examination belongs to, when the doctor may open it. */
export async function examinationOwner(examId: string): Promise<string | null> {
    return (await loadExamination(examId))?.fighter.id ?? null;
}

/**
 * The shared domain labels and badges keep this screen's Vietnamese wording only when given no locale (their `vi`
 * dictionary words some states differently), so they get a locale only in English.
 */
const enOnly = (locale: Locale) => (locale === "en" ? locale : undefined);

const CLEARANCE_LEVEL_TEXT: Record<ClearanceLevel, MessageKey> = {
    full: "doctorViews.exam.level.full",
    restricted: "doctorViews.exam.level.restricted",
    not_cleared: "doctorViews.exam.level.not_cleared",
};
const OUTCOME_TEXT: Record<ExaminationOutcome, MessageKey> = {
    fit: "doctorViews.exam.outcome.fit",
    fit_with_restrictions: "doctorViews.exam.outcome.fit_with_restrictions",
    unfit: "doctorViews.exam.outcome.unfit",
};

export async function examinationMetadata(examId: string): Promise<Metadata> {
    const loaded = await loadExamination(examId);
    const { t, locale } = await getTranslator();
    return { title: loaded ? `${examinationTitle(loaded.exam, enOnly(locale))} — ${loaded.fighter.name}` : t("doctorViews.exam.notFound") };
}

/** One examination, shown inside its fighter's profile. */
export async function ExaminationDetail({ examId, query, fighterId: scopedId }: { examId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const now = new Date().toISOString();
    const { t, locale } = await getTranslator();

    const loaded = await loadExamination(examId);
    if (!loaded || loaded.fighter.id !== scopedId) notFound();
    const { exam, fighter } = loaded;

    const [doctors, clearances, fighterExams, settings, fighterInjuries] = await Promise.all([
        listDoctors(),
        listClearances({ fighterIds: [exam.fighterId] }),
        listExaminations({ fighterIds: [exam.fighterId] }),
        getSettings(),
        listInjuries({ fighterIds: [exam.fighterId] }).catch(() => []),
    ]);

    const doctorName = doctors.find((doctor) => doctor.id === exam.doctorId)?.name ?? t("doctorViews.exam.doctorFallback");
    const current = currentClearance(clearances, fighter.id);
    const currentState = clearanceState(current, now);
    const linked = clearances.filter((clearance) => clearance.examinationId === exam.id);
    const isLatest = fighterExams[0]?.id === exam.id;
    const expectedLevel = CLEARANCE_LEVEL_FOR_OUTCOME[exam.outcome];
    const suggestUpdate = isLatest && linked.length === 0 && currentState !== expectedLevel;
    const grantHref = hrefWith(routes.doctor.fighterGrantClearance(fighter.id), {}, { exam: exam.id });

    const counts = {
        abnormal: exam.assessments.filter((a) => a.result === "abnormal").length,
        inconclusive: exam.assessments.filter((a) => a.result === "inconclusive").length,
        normal: exam.assessments.filter((a) => a.result === "normal").length,
    };
    const outcomeMeta = EXAMINATION_OUTCOME_META[exam.outcome];
    const followUpDays = exam.followUpDate ? daysBetween(now, exam.followUpDate) : null;

    return (
        <div id="examination-report">
            <style>{PRINT_STYLES}</style>
            <FlashToast
                notice={
                    param(query.notice) === "examination-recorded"
                        ? { title: t("doctorViews.exam.recordedTitle"), description: t("doctorViews.exam.recordedBody", { name: fighter.name }) }
                        : null
                }
                cleanHref={hrefWith(routes.doctor.fighterExamination(fighter.id, exam.id), query, { notice: null })}
            />

            <PageHeader
                back={{ href: routes.doctor.fighterExaminations(fighter.id), label: t("doctorViews.exam.eyebrow") }}
                eyebrow={t("doctorViews.exam.eyebrow")}
                title={examinationTitle(exam, enOnly(locale))}
                description={
                    <>
                        <Link href={routes.doctor.fighter(fighter.id)} className="font-medium text-fg hover:underline">
                            {fighter.name}
                        </Link>{" "}
                        · <time dateTime={exam.date}>{formatDateTime(exam.date, locale)}</time> · {doctorName}
                    </>
                }
                meta={
                    <>
                        <ExaminationOutcomeBadge outcome={exam.outcome} locale={enOnly(locale)} />
                        {counts.abnormal > 0 && (
                            <Badge tone="warning" icon={TriangleAlert}>
                                {plural(t, "doctorViews.exam.abnormalSigns", counts.abnormal)}
                            </Badge>
                        )}
                    </>
                }
                actions={
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <PrintButton />
                        {!suggestUpdate && (
                            <ButtonLink href={grantHref} variant="secondary">
                                <ShieldCheck aria-hidden />
                                {t("doctorViews.exam.updateClearance")}
                            </ButtonLink>
                        )}
                    </div>
                }
            />

            <div className="flex flex-col gap-6">
                {suggestUpdate && (
                    <Callout
                        tone="info"
                        icon={ShieldCheck}
                        title={t("doctorViews.exam.suggestTitle")}
                        action={<ButtonLink href={grantHref}>{t("doctorViews.exam.updateClearance")}</ButtonLink>}
                        className="print:hidden"
                    >
                        {t("doctorViews.exam.suggestLead", { outcome: t(OUTCOME_TEXT[exam.outcome]) })} <strong className="font-medium text-fg">{t(CLEARANCE_LEVEL_TEXT[expectedLevel])}</strong>
                        {t("doctorViews.exam.suggestTail", { name: fighter.name, state: describeState(t, currentState) })}
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        {exam.vitals && (
                            <Card>
                                <CardHeader title={t("doctorViews.exam.vitals")} icon={<Stethoscope />} description={t("doctorViews.exam.vitalsSub", { kg: fighter.targetWeightKg })} />
                                <CardContent>
                                    <VitalsGrid vitals={exam.vitals} weightLimitKg={fighter.targetWeightKg} locale={locale} />
                                </CardContent>
                            </Card>
                        )}

                        {exam.assessments.length > 0 && (
                            <Card>
                                <CardHeader
                                    title={t("doctorViews.exam.assessments")}
                                    icon={<ClipboardList />}
                                    description={[
                                        counts.normal > 0 ? t("doctorViews.exam.countNormal", { n: counts.normal }) : null,
                                        counts.abnormal > 0 ? t("doctorViews.exam.countAbnormal", { n: counts.abnormal }) : null,
                                        counts.inconclusive > 0 ? t("doctorViews.exam.countInconclusive", { n: counts.inconclusive }) : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                />
                                <div className="pb-2">
                                    <Table caption={t("doctorViews.exam.assessments")}>
                                        <THead>
                                            <tr>
                                                <TH>{t("doctorViews.exam.colArea")}</TH>
                                                <TH>{t("doctorViews.exam.colResult")}</TH>
                                                <TH>{t("doctorViews.exam.colFinding")}</TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {exam.assessments.map((assessment, index) => (
                                                <TR key={`${assessment.area}-${index}`} className={cn(assessment.result === "abnormal" && "bg-warning-soft/30")}>
                                                    <TD className="min-w-44 font-medium">{locale === "vi" ? assessmentAreaLabel(assessment.area) : assessment.area}</TD>
                                                    <TD className="whitespace-nowrap">
                                                        <AssessmentResultBadge result={assessment.result} size="sm" />
                                                    </TD>
                                                    <TD className="min-w-64 text-[13px] text-pretty">
                                                        {assessment.note || <span className="text-fg-muted">{t("doctorViews.exam.noNote")}</span>}
                                                    </TD>
                                                </TR>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            </Card>
                        )}

                        <Card>
                            <CardHeader title={t("doctorViews.exam.summaryCard")} icon={<NotebookPen />} />
                            <CardContent className="flex flex-col gap-5">
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">{t("doctorViews.exam.summary")}</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.summary}</p>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">{t("doctorViews.exam.recommendations")}</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.recommendations || <span className="text-fg-muted">{t("doctorViews.exam.notRecorded")}</span>}</p>
                                </div>
                                {exam.decisionRestrictions?.notes && (
                                    <div>
                                        <h3 className="text-[13px] font-semibold text-fg-muted">{t("doctorViews.exam.restrictionNotes")}</h3>
                                        <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.decisionRestrictions.notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {exam.scat6 && <Scat6Summary record={exam.scat6} />}
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title={t("doctorViews.exam.conclusion")} />
                            <CardContent className="flex flex-col gap-4">
                                <Callout tone={outcomeMeta.tone} icon={outcomeMeta.icon} title={t(OUTCOME_TEXT[exam.outcome])}>
                                    {t(EXAMINATION_OUTCOME_DESCRIPTION_KEYS[exam.outcome])}
                                </Callout>
                                <div className="flex items-start gap-2.5 text-sm">
                                    <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                    {exam.followUpDate && followUpDays !== null ? (
                                        <p>
                                            <span className="block text-[13px] text-fg-muted">{t("doctorViews.exam.followUp")}</span>
                                            <time dateTime={exam.followUpDate} className="font-medium text-fg">
                                                {formatDate(exam.followUpDate, locale)}
                                            </time>
                                            <span className="text-fg-muted"> · {followUpDays < 0 ? daysUntil(t, followUpDays) : capitalize(daysUntil(t, followUpDays))}</span>
                                        </p>
                                    ) : (
                                        <p className="text-fg-muted">{t("doctorViews.exam.noFollowUp")}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title={t("doctorViews.exam.clearance")} icon={<ShieldCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {linked.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[13px] text-fg-muted">{t("doctorViews.exam.grantedFrom")}</p>
                                        {linked.map((clearance) => (
                                            <div key={clearance.id} className="rounded-lg border border-border px-3 py-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <ClearanceBadge state={clearance.level} size="sm" locale={enOnly(locale)} />
                                                    <ClearanceRecordStatusBadge status={clearance.status} size="sm" locale={enOnly(locale)} />
                                                </div>
                                                <p className="mt-1.5 text-[13px] text-fg-muted">
                                                    {t("doctorViews.exam.issuedOn", { date: formatDate(clearance.issuedAt, locale) })}
                                                    {clearance.validUntil ? t("doctorViews.exam.validUntil", { date: formatDate(clearance.validUntil, locale) }) : ""}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-fg-muted">{t("doctorViews.exam.noneGranted")}</p>
                                )}
                                <div className="border-t border-border pt-4">
                                    <p className="mb-1.5 text-[13px] text-fg-muted">{t("doctorViews.exam.currentClearance")}</p>
                                    <div className="flex flex-col items-start gap-1">
                                        <ClearanceBadge state={currentState} size="sm" locale={enOnly(locale)} />
                                        <ClearanceValidity clearance={current} state={currentState} now={now} warningDays={settings.clearanceExpiryWarningDays} locale={locale} />
                                    </div>
                                    <Link
                                        href={`${routes.doctor.fighter(fighter.id)}?tab=clearance`}
                                        className="mt-3 inline-flex text-[13px] font-medium text-primary-soft-fg hover:underline print:hidden"
                                    >
                                        {t("doctorViews.exam.clearanceHistory")}
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        <Panel title={t("doctorViews.exam.bodyMap")} aside={fighterInjuries.length === 0 ? t("doctorViews.exam.noInjuries") : plural(t, "doctorViews.exam.injuryCount", fighterInjuries.length)} tone="plate" id="ban-do-co-the">
                            <BodyPanel injuries={fighterInjuries} excluded={[]} height={340} />
                        </Panel>

                        <Card>
                            <CardHeader title={t("doctorViews.exam.patient")} icon={<UserRound />} />
                            <CardContent className="flex flex-col gap-3">
                                <FighterIdentity fighter={fighter} href={routes.doctor.fighter(fighter.id)} locale={enOnly(locale)} />
                                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={currentState} size="sm" className="self-start" locale={enOnly(locale)} />
                                <p className="text-[13px] text-fg-muted">
                                    {isLatest
                                        ? t("doctorViews.exam.isLatest")
                                        : plural(t, "doctorViews.exam.newerExist", fighterExams.findIndex((candidate) => candidate.id === exam.id))}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function describeState(t: Translator, state: ClearanceState): string {
    switch (state) {
        case "none":
            return t("doctorViews.exam.stateNone");
        case "expired":
            return t("doctorViews.exam.stateExpired");
        default:
            return t("doctorViews.exam.stateQuoted", { level: t(CLEARANCE_LEVEL_TEXT[state]) });
    }
}
