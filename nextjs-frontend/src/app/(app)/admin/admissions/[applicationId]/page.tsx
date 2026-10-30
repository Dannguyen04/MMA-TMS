import { ClipboardCheck, Gavel, MailCheck, Stethoscope, UserRound, UserSearch, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { careTeamNextStep } from "@/components/admin/admin-attention";
import { DecisionForm, EvaluatorForm, ResendActivationForm } from "@/components/admissions/admission-admin-forms";
import { ApplicantDetailsList, AssessmentView } from "@/components/admissions/application-views";
import { ApplicationStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { applicantName, type Application } from "@/lib/domain/admissions";
import { CARE_ROLES, type CareRole, type CareTeamMember, type StaffOption } from "@/lib/domain/care-team";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getApplication } from "@/lib/services/admissions";
import { getCareTeam, listStaffAccounts } from "@/lib/services/care-team";
import { getUser } from "@/lib/services/people";

/** One read per request, shared by the metadata and the page. */
const loadApplication = cache((applicationId: string) => getApplication(applicationId));

export async function generateMetadata({ params }: PageProps<"/admin/admissions/[applicationId]">): Promise<Metadata> {
    await requireRole("admin");
    const { t } = await getTranslator();
    const application = await loadApplication((await params).applicationId);
    return { title: application ? t("screens.admin.meta.application", { name: applicantName(application.applicant) }) : t("screens.admin.meta.applicationNotFound") };
}

interface FighterCareTeam {
    members: Record<CareRole, CareTeamMember[]>;
    missing: CareRole[];
}

/** An activated applicant's care team, read through their new fighter profile; null when it couldn't be read. */
async function loadFighterCareTeam(userId: string): Promise<FighterCareTeam | null> {
    const account = await getUser(userId);
    if (!account?.profileId) return null;
    const { coach, doctor } = await getCareTeam(account.profileId);
    if (coach === null || doctor === null) return null;
    const members = { coach, doctor };
    return { members, missing: CARE_ROLES.filter((role) => members[role].length === 0) };
}

export default async function AdminAdmissionPage({ params }: PageProps<"/admin/admissions/[applicationId]">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    const [application, coaches] = await Promise.all([loadApplication((await params).applicationId), listStaffAccounts("coach")]);
    if (!application) notFound();
    const name = applicantName(application.applicant);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? t("role.coach");
    // Activation isn't the end of admission: the new fighter can't train until they have a sports doctor.
    const careTeam = application.status === "activated" ? await loadFighterCareTeam(application.applicantId) : null;
    const nextStep = careTeam ? careTeamNextStep(careTeam.missing, t) : null;

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.admissions, label: t("screens.admin.common.admissions") }}
                eyebrow={t("screens.admin.application.eyebrow")}
                title={name}
                description={application.applicant.email}
                meta={
                    <>
                        <ApplicationStatusBadge status={application.status} locale={locale} />
                        <span className="text-[13px] text-fg-muted">{t("screens.admin.application.applied", { date: formatDate(application.submittedAt, locale) })}</span>
                    </>
                }
            />
            {careTeam && nextStep && (
                <Callout
                    tone={careTeam.missing.includes("doctor") ? "warning" : "info"}
                    icon={careTeam.missing.includes("doctor") ? Stethoscope : UsersRound}
                    title={nextStep.title}
                    className="mb-6"
                    action={
                        <ButtonLink href={routes.admin.userCareTeam(application.applicantId)}>
                            <UsersRound aria-hidden />
                            {nextStep.action}
                        </ButtonLink>
                    }
                >
                    {careTeam.missing.includes("doctor")
                        ? t("screens.admin.application.activatedNoDoctor", { name })
                        : t("screens.admin.application.activatedNoCoach", { name })}
                </Callout>
            )}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <Card>
                        <CardHeader title={t("screens.admin.application.applicant")} icon={<UserRound />} />
                        <CardContent>
                            <ApplicantDetailsList details={application.applicant} accountEmail={application.accountEmail} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={t("screens.admin.application.assessment")} icon={<ClipboardCheck />} />
                        <CardContent>
                            {application.assessment ? (
                                <AssessmentView assessment={application.assessment} coachName={coachName(application.assessment.coachId)} />
                            ) : (
                                <p className="text-sm text-fg-muted">
                                    {application.evaluator
                                        ? t("screens.admin.application.notRecorded", { coach: coachName(application.evaluator.coachId) })
                                        : t("screens.admin.application.assignCoach")}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <DecisionCard application={application} t={t} locale={locale} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <EvaluatorCard application={application} coaches={coaches} coachName={coachName} t={t} locale={locale} />
                    {application.activation && (
                        <ActivationCard application={application} activation={application.activation} careTeam={careTeam} t={t} locale={locale} />
                    )}
                </div>
            </div>
        </>
    );
}

interface LocalisedProps {
    t: Translator;
    locale: Locale;
}

function DecisionCard({ application, t, locale }: { application: Application } & LocalisedProps) {
    const { decision } = application;
    return (
        <Card>
            <CardHeader title={t("screens.admin.application.decision")} icon={<Gavel />} />
            <CardContent>
                {decision ? (
                    <DescriptionList
                        items={[
                            { label: t("screens.admin.application.decision"), value: t(`screens.admin.decision.${decision.decision}` as MessageKey) },
                            { label: t("screens.admin.application.decided"), value: formatDateTime(decision.decidedAt, locale) },
                            { label: t("screens.admin.common.reason"), value: <span className="font-normal whitespace-pre-line">{decision.reason}</span>, wide: true },
                        ]}
                    />
                ) : application.status === "passed" ? (
                    <DecisionForm applicationId={application.id} />
                ) : (
                    <p className="text-sm text-fg-muted">
                        {application.status === "failed" ? t("screens.admin.application.nothingToDecide") : t("screens.admin.application.decideLater")}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function EvaluatorCard({
    application,
    coaches,
    coachName,
    t,
    locale,
}: { application: Application; coaches: StaffOption[]; coachName: (coachId: string) => string } & LocalisedProps) {
    const { evaluator } = application;
    const canAssign = application.status === "submitted" && !application.assessment;
    return (
        <Card>
            <CardHeader title={t("screens.admin.application.assessingCoach")} icon={<UserSearch />} />
            <CardContent className="flex flex-col gap-4">
                {evaluator ? (
                    <p className="text-sm text-fg">
                        <span className="font-medium">{coachName(evaluator.coachId)}</span>
                        <span className="text-fg-muted">{t("screens.admin.application.since", { date: formatDate(evaluator.since, locale) })}</span>
                    </p>
                ) : (
                    <p className="text-sm text-fg-muted">{t("screens.admin.application.noCoach")}</p>
                )}
                {/* Keyed by the coach so the form starts empty again once one is assigned. */}
                {canAssign && <EvaluatorForm key={evaluator?.coachId ?? "none"} applicationId={application.id} coaches={coaches} currentCoachId={evaluator?.coachId ?? null} />}
            </CardContent>
        </Card>
    );
}

/**
 * The activation emails and, once activated, who looks after the new fighter. While the care team is incomplete the
 * page's callout carries the one action, so the card only links to the account.
 */
function ActivationCard({
    application,
    activation,
    careTeam,
    t,
    locale,
}: {
    application: Application;
    activation: NonNullable<Application["activation"]>;
    /** The new fighter's care team; null before activation or when it couldn't be read. */
    careTeam: FighterCareTeam | null;
} & LocalisedProps) {
    const names = (role: CareRole) => careTeam?.members[role].map((member) => member.name).join(", ");
    const notAssigned = <span className="font-normal text-fg-subtle">{t("screens.admin.common.notAssignedYet")}</span>;
    return (
        <Card>
            <CardHeader title={t("screens.admin.application.activation")} icon={<MailCheck />} />
            <CardContent className="flex flex-col gap-4">
                <DescriptionList
                    columns={1}
                    items={[
                        { label: t("screens.admin.common.status"), value: t(`screens.admin.activationStatus.${activation.status}` as MessageKey) },
                        { label: t("screens.admin.application.emailAttempts"), value: activation.emailAttempts },
                        ...(activation.lastAttemptAt ? [{ label: t("screens.admin.application.lastAttempt"), value: formatDateTime(activation.lastAttemptAt, locale) }] : []),
                        {
                            label: t("screens.admin.application.lastAccepted"),
                            value: activation.lastAcceptedAt ? (
                                formatDateTime(activation.lastAcceptedAt, locale)
                            ) : (
                                <span className="font-normal text-fg-subtle">{t("screens.admin.application.notYet")}</span>
                            ),
                        },
                        ...(activation.completedAt ? [{ label: t("screens.admin.application.activated"), value: formatDateTime(activation.completedAt, locale) }] : []),
                        ...(careTeam
                            ? [
                                  { label: t("role.coach"), value: names("coach") || notAssigned },
                                  { label: t("role.doctor"), value: names("doctor") || notAssigned },
                              ]
                            : []),
                    ]}
                />
                {application.status === "approved" && <ResendActivationForm applicationId={application.id} />}
                {application.status === "activated" && (careTeam === null || careTeam.missing.length === 0) && (
                    <ButtonLink href={routes.admin.userCareTeam(application.applicantId)} variant="secondary" size="sm" className="self-start">
                        <UsersRound aria-hidden />
                        {careTeam ? t("screens.admin.application.viewCareTeam") : t("screens.admin.application.checkCareTeam")}
                    </ButtonLink>
                )}
            </CardContent>
        </Card>
    );
}
