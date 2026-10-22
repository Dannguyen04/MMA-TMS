import { History } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationForm } from "@/components/admissions/application-form";
import { ApplicationProgress } from "@/components/admissions/application-progress";
import { ApplicationStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireApplicant } from "@/lib/auth/session";
import { applicationAnswers, isOpenApplication, openApplication } from "@/lib/domain/admissions";
import { dayKey, formatDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { listOwnApplications } from "@/lib/services/admissions";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("applicant.metaTitle") };
}

/** The applicant's application in progress, or the form to send one; earlier attempts stay listed below. */
export default async function ApplyPage() {
    const [applicant, { t, locale }] = await Promise.all([requireApplicant(), getTranslator()]);
    const applications = await listOwnApplications(applicant);
    const current = openApplication(applications);
    const closed = applications.filter((application) => !isOpenApplication(application));
    const latestClosed = closed[0] ?? null;

    return (
        <>
            <PageHeader eyebrow="Lotus Combat Academy" title={t("applicant.applyTitle")} description={t("applicant.applyDescription")} />
            <div className="flex flex-col gap-6">
                {current ? (
                    <ApplicationProgress application={current} locale={locale} />
                ) : (
                    <Card>
                        <CardHeader
                            title={latestClosed ? t("applicant.applyAgainTitle") : t("applicant.tellUsTitle")}
                            description={latestClosed ? t("applicant.applyAgainDescription") : t("applicant.requiredFields")}
                        />
                        <CardContent className="flex flex-col gap-5">
                            {latestClosed && (
                                <Callout tone="neutral" icon={History} title={t("applicant.lastApplication", { status: t(`applicant.status.${latestClosed.status}`).toLowerCase() })}>
                                    {t("applicant.lastApplicationSent", { date: formatDate(latestClosed.submittedAt, locale) })}
                                </Callout>
                            )}
                            <ApplicationForm today={dayKey(new Date())} previous={latestClosed && applicationAnswers(latestClosed.applicant)} locale={locale} />
                        </CardContent>
                    </Card>
                )}

                {closed.length > 0 && (
                    <Card className="overflow-hidden">
                        <CardHeader title={t("applicant.earlierApplications")} />
                        <ul className="divide-y divide-border border-t border-border">
                            {closed.map((application) => (
                                <li key={application.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                    <span className="text-fg-muted">{t("applicant.earlierSent", { date: formatDate(application.submittedAt, locale) })}</span>
                                    <ApplicationStatusBadge status={application.status} size="sm" locale={locale} />
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </div>
        </>
    );
}
