import { ClipboardCheck, Gavel, MailCheck, UserRound, UserSearch, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { DecisionForm, EvaluatorForm, ResendActivationForm } from "@/components/admissions/admission-admin-forms";
import { ApplicantDetailsList, AssessmentView } from "@/components/admissions/application-views";
import { ApplicationStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { ACTIVATION_STATUS_LABELS, DECISION_LABELS, applicantName, type Application } from "@/lib/domain/admissions";
import type { StaffOption } from "@/lib/domain/care-team";
import { formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getApplication } from "@/lib/services/admissions";
import { listStaffAccounts } from "@/lib/services/care-team";

/** One read per request, shared by the metadata and the page. */
const loadApplication = cache((applicationId: string) => getApplication(applicationId));

export async function generateMetadata({ params }: PageProps<"/admin/admissions/[applicationId]">): Promise<Metadata> {
    await requireRole("admin");
    const application = await loadApplication((await params).applicationId);
    return { title: application ? `${applicantName(application.applicant)} — Application` : "Application not found" };
}

export default async function AdminAdmissionPage({ params }: PageProps<"/admin/admissions/[applicationId]">) {
    await requireRole("admin");
    const [application, coaches] = await Promise.all([loadApplication((await params).applicationId), listStaffAccounts("coach")]);
    if (!application) notFound();
    const name = applicantName(application.applicant);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? "Coach";

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.admissions, label: "Admissions" }}
                eyebrow="Application"
                title={name}
                description={application.applicant.email}
                meta={
                    <>
                        <ApplicationStatusBadge status={application.status} />
                        <span className="text-[13px] text-fg-muted">Applied {formatDate(application.submittedAt)}</span>
                    </>
                }
            />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <Card>
                        <CardHeader title="Applicant" icon={<UserRound />} />
                        <CardContent>
                            <ApplicantDetailsList details={application.applicant} accountEmail={application.accountEmail} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title="Entrance assessment" icon={<ClipboardCheck />} />
                        <CardContent>
                            {application.assessment ? (
                                <AssessmentView assessment={application.assessment} coachName={coachName(application.assessment.coachId)} />
                            ) : (
                                <p className="text-sm text-fg-muted">
                                    {application.evaluator ? `${coachName(application.evaluator.coachId)} hasn't recorded the assessment yet.` : "Assign a coach to assess the applicant."}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <DecisionCard application={application} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <EvaluatorCard application={application} coaches={coaches} coachName={coachName} />
                    {application.activation && <ActivationCard application={application} activation={application.activation} />}
                </div>
            </div>
        </>
    );
}

function DecisionCard({ application }: { application: Application }) {
    const { decision } = application;
    return (
        <Card>
            <CardHeader title="Decision" icon={<Gavel />} />
            <CardContent>
                {decision ? (
                    <DescriptionList
                        items={[
                            { label: "Decision", value: DECISION_LABELS[decision.decision] },
                            { label: "Decided", value: formatDateTime(decision.decidedAt) },
                            { label: "Reason", value: <span className="font-normal whitespace-pre-line">{decision.reason}</span>, wide: true },
                        ]}
                    />
                ) : application.status === "passed" ? (
                    <DecisionForm applicationId={application.id} />
                ) : (
                    <p className="text-sm text-fg-muted">
                        {application.status === "failed" ? "The applicant didn't pass the assessment, so there's nothing to decide." : "You can decide once the applicant passes the assessment."}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function EvaluatorCard({ application, coaches, coachName }: { application: Application; coaches: StaffOption[]; coachName: (coachId: string) => string }) {
    const { evaluator } = application;
    const canAssign = application.status === "submitted" && !application.assessment;
    return (
        <Card>
            <CardHeader title="Assessing coach" icon={<UserSearch />} />
            <CardContent className="flex flex-col gap-4">
                {evaluator ? (
                    <p className="text-sm text-fg">
                        <span className="font-medium">{coachName(evaluator.coachId)}</span>
                        <span className="text-fg-muted"> · since {formatDate(evaluator.since)}</span>
                    </p>
                ) : (
                    <p className="text-sm text-fg-muted">No coach assigned yet.</p>
                )}
                {/* Keyed by the coach so the form starts empty again once one is assigned. */}
                {canAssign && <EvaluatorForm key={evaluator?.coachId ?? "none"} applicationId={application.id} coaches={coaches} currentCoachId={evaluator?.coachId ?? null} />}
            </CardContent>
        </Card>
    );
}

function ActivationCard({ application, activation }: { application: Application; activation: NonNullable<Application["activation"]> }) {
    return (
        <Card>
            <CardHeader title="Activation" icon={<MailCheck />} />
            <CardContent className="flex flex-col gap-4">
                <DescriptionList
                    columns={1}
                    items={[
                        { label: "Status", value: ACTIVATION_STATUS_LABELS[activation.status] },
                        { label: "Activation email attempts", value: activation.emailAttempts },
                        ...(activation.lastAttemptAt ? [{ label: "Last attempt", value: formatDateTime(activation.lastAttemptAt) }] : []),
                        {
                            label: "Last taken by the email service",
                            value: activation.lastAcceptedAt ? formatDateTime(activation.lastAcceptedAt) : <span className="font-normal text-fg-subtle">Not yet</span>,
                        },
                        ...(activation.completedAt ? [{ label: "Activated", value: formatDateTime(activation.completedAt) }] : []),
                    ]}
                />
                {application.status === "approved" && <ResendActivationForm applicationId={application.id} />}
                {application.status === "activated" && (
                    <ButtonLink href={routes.admin.user(application.applicantId)} variant="secondary" size="sm" className="self-start">
                        <UsersRound aria-hidden />
                        Assign a coach and a sports doctor
                    </ButtonLink>
                )}
            </CardContent>
        </Card>
    );
}
