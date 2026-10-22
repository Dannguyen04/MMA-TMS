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
import { routes } from "@/lib/routes";
import { getAssignedApplication } from "@/lib/services/admissions";

/** One read per request, shared by the metadata and the page. */
const loadApplication = cache((applicationId: string, coach: User) => getAssignedApplication(applicationId, coach));

export async function generateMetadata({ params }: PageProps<"/coach/admissions/[applicationId]">): Promise<Metadata> {
    const coach = await requireRole("coach");
    const application = await loadApplication((await params).applicationId, coach);
    return { title: application ? `${applicantName(application.applicant)} — Applicant` : "Applicant not found" };
}

export default async function CoachAdmissionPage({ params }: PageProps<"/coach/admissions/[applicationId]">) {
    const coach = await requireRole("coach");
    const application = await loadApplication((await params).applicationId, coach);
    if (!application) notFound();
    const name = applicantName(application.applicant);

    return (
        <>
            <PageHeader
                back={{ href: routes.coach.admissions, label: "Applicants" }}
                eyebrow="Applicant"
                title={name}
                description={application.applicant.email}
                meta={
                    <>
                        <ApplicationStatusBadge status={application.status} />
                        <span className="text-[13px] text-fg-muted">Applied {formatDate(application.submittedAt)}</span>
                    </>
                }
            />
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Card>
                    <CardHeader title="Applicant" icon={<UserRound />} />
                    <CardContent>
                        <ApplicantDetailsList details={application.applicant} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader
                        title="Entrance assessment"
                        description={
                            application.assessment ? undefined : (
                                <span className="inline-flex flex-wrap items-center gap-1">
                                    Record what you checked and what you saw. It can&apos;t be changed once saved.
                                    <TermHint term="entranceAssessment" />
                                </span>
                            )
                        }
                        icon={<ClipboardCheck />}
                    />
                    <CardContent>
                        {application.assessment ? (
                            <AssessmentView assessment={application.assessment} coachName={coach.name} />
                        ) : (
                            <AssessmentForm applicationId={application.id} applicantName={name} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
