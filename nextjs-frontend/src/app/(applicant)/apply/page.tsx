import { History } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationForm } from "@/components/admissions/application-form";
import { ApplicationProgress } from "@/components/admissions/application-progress";
import { ApplicationStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireApplicant } from "@/lib/auth/session";
import { APPLICATION_STATUS_LABELS, applicationAnswers, isOpenApplication, openApplication } from "@/lib/domain/admissions";
import { dayKey, formatDate } from "@/lib/format";
import { listOwnApplications } from "@/lib/services/admissions";

export const metadata: Metadata = { title: "Your application" };

/** The applicant's application in progress, or the form to send one; earlier attempts stay listed below. */
export default async function ApplyPage() {
    const applicant = await requireApplicant();
    const applications = await listOwnApplications(applicant);
    const current = openApplication(applications);
    const closed = applications.filter((application) => !isOpenApplication(application));
    const latestClosed = closed[0] ?? null;

    return (
        <>
            <PageHeader eyebrow="Lotus Combat Academy" title="Train with us" description="Apply to join the academy as a fighter. A coach assesses every applicant before the academy decides." />
            <div className="flex flex-col gap-6">
                {current ? (
                    <ApplicationProgress application={current} />
                ) : (
                    <Card>
                        <CardHeader
                            title={latestClosed ? "Apply again" : "Tell us about yourself"}
                            description={latestClosed ? "Your earlier answers are filled in. Update anything that has changed." : "Fields marked * are required."}
                        />
                        <CardContent className="flex flex-col gap-5">
                            {latestClosed && (
                                <Callout tone="neutral" icon={History} title={`Your last application: ${APPLICATION_STATUS_LABELS[latestClosed.status].toLowerCase()}`}>
                                    Sent {formatDate(latestClosed.submittedAt)}. You&apos;re welcome to apply again.
                                </Callout>
                            )}
                            <ApplicationForm today={dayKey(new Date())} previous={latestClosed && applicationAnswers(latestClosed.applicant)} />
                        </CardContent>
                    </Card>
                )}

                {closed.length > 0 && (
                    <Card className="overflow-hidden">
                        <CardHeader title="Earlier applications" />
                        <ul className="divide-y divide-border border-t border-border">
                            {closed.map((application) => (
                                <li key={application.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                    <span className="text-fg-muted">Sent {formatDate(application.submittedAt)}</span>
                                    <ApplicationStatusBadge status={application.status} size="sm" />
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </div>
        </>
    );
}
