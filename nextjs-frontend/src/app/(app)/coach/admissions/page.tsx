import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationList } from "@/components/admissions/application-views";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listAssignedApplications } from "@/lib/services/admissions";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("coachQueue.applicants") };
}

/** Applicants an administrator asked this coach to assess. */
export default async function CoachAdmissionsPage() {
    const coach = await requireRole("coach");
    const [applications, { t, locale }] = await Promise.all([listAssignedApplications(coach), getTranslator()]);
    const applicants = (count: number) => plural(t, "screens.misc.coach.applicants", count, { n: formatNumber(count) });
    const waiting = applications.filter((application) => application.status === "submitted");
    const assessed = applications.filter((application) => application.status !== "submitted");

    return (
        <>
            <PageHeader title={t("coachQueue.applicants")} description={t("screens.misc.coach.description")} />
            <div className="flex flex-col gap-6">
                <Card className="overflow-hidden">
                    <CardHeader title={t("screens.misc.coach.toAssess")} description={applicants(waiting.length)} icon={<ClipboardList />} />
                    {waiting.length === 0 ? (
                        <CardContent>
                            <EmptyState compact title={t("coachQueue.applicants.emptyTitle")} description={t("coachQueue.applicants.emptyText")} />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ApplicationList applications={waiting} hrefFor={routes.coach.admission} label={t("screens.misc.coach.toAssessList")} locale={locale} />
                        </div>
                    )}
                </Card>
                {assessed.length > 0 && (
                    <Card className="overflow-hidden">
                        <CardHeader title={t("screens.misc.coach.assessed")} description={applicants(assessed.length)} />
                        <div className="border-t border-border">
                            <ApplicationList applications={assessed} hrefFor={routes.coach.admission} label={t("screens.misc.coach.assessedList")} locale={locale} />
                        </div>
                    </Card>
                )}
            </div>
        </>
    );
}
