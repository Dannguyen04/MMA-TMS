import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationList } from "@/components/admissions/application-views";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listAssignedApplications } from "@/lib/services/admissions";

export const metadata: Metadata = { title: "Applicants" };

/** Applicants an administrator asked this coach to assess. */
export default async function CoachAdmissionsPage() {
    const coach = await requireRole("coach");
    const applications = await listAssignedApplications(coach);
    const waiting = applications.filter((application) => application.status === "submitted");
    const assessed = applications.filter((application) => application.status !== "submitted");

    return (
        <>
            <PageHeader title="Applicants" description="People applying to train at the academy. Run each entrance assessment and record what you saw; an administrator makes the final decision." />
            <div className="flex flex-col gap-6">
                <Card className="overflow-hidden">
                    <CardHeader title="To assess" description={pluralize(waiting.length, "applicant")} icon={<ClipboardList />} />
                    {waiting.length === 0 ? (
                        <CardContent>
                            <EmptyState compact title="No one to assess" description="Applicants appear here when an administrator asks you to assess them." />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ApplicationList applications={waiting} hrefFor={routes.coach.admission} label="Applicants to assess" />
                        </div>
                    )}
                </Card>
                {assessed.length > 0 && (
                    <Card className="overflow-hidden">
                        <CardHeader title="Assessed" description={pluralize(assessed.length, "applicant")} />
                        <div className="border-t border-border">
                            <ApplicationList applications={assessed} hrefFor={routes.coach.admission} label="Applicants you assessed" />
                        </div>
                    </Card>
                )}
            </div>
        </>
    );
}
