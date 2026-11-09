import { ClipboardCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AssessmentForm } from "@/components/admissions/assessment-form";
import { ApplicantDetailsList, AssessmentView } from "@/components/admissions/application-views";
import { ApplicationStatusBadge } from "@/components/domain/status-badges";
import { TermHint } from "@/components/domain/term-hint";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { applicantName } from "@/lib/domain/admissions";
import type { User } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getAssignedApplication } from "@/lib/services/admissions";

/** One read per request, shared by the metadata and the page. */
const loadApplication = cache((applicationId: string, coach: User) => getAssignedApplication(applicationId, coach));

export async function generateMetadata({ params }: PageProps<"/coach/admissions/[applicationId]">): Promise<Metadata> {
    const coach = await requireRole("coach");
    const [application, { t }] = await Promise.all([loadApplication((await params).applicationId, coach), getTranslator()]);
    return { title: application ? t("screens.misc.coach.metaApplicant", { name: applicantName(application.applicant) }) : t("screens.misc.coach.metaNotFound") };
}

export default async function CoachAdmissionPage({ params }: PageProps<"/coach/admissions/[applicationId]">) {
    const coach = await requireRole("coach");
    const [application, { t, locale }] = await Promise.all([loadApplication((await params).applicationId, coach), getTranslator()]);
    if (!application) notFound();
    const name = applicantName(application.applicant);

    return (
        <>
            <PageHeader
                back={{ href: routes.coach.admissions, label: t("coachQueue.applicants") }}
                eyebrow={t("screens.misc.coach.applicant")}
                title={name}
                description={application.applicant.email}
                meta={
                    <>
                        {/* The badge's translated English words some statuses differently ("Submitted"), so English keeps today's labels. */}
                        <ApplicationStatusBadge status={application.status} locale={locale === "en" ? undefined : locale} />
                        <span className="text-[13px] text-fg-muted">{t("screens.admin.application.applied", { date: formatDate(application.submittedAt, locale) })}</span>
                    </>
                }
            />
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Card>
                    <CardHeader title={t("screens.misc.coach.applicant")} icon={<UserRound />} />
                    <CardContent>
                        <ApplicantDetailsList details={application.applicant} locale={locale} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader
                        title={t("screens.admin.application.assessment")}
                        description={
                            application.assessment ? undefined : (
                                <span className="inline-flex flex-wrap items-center gap-1">
                                    {t("screens.misc.coach.recordHint")}
                                    <TermHint term="entranceAssessment" />
                                </span>
                            )
                        }
                        icon={<ClipboardCheck />}
                    />
                    <CardContent>
                        {application.assessment ? (
                            <AssessmentView assessment={application.assessment} coachName={coach.name} locale={locale} />
                        ) : (
                            <AssessmentForm applicationId={application.id} applicantName={name} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
