import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationList } from "@/components/admissions/application-views";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import type { Application } from "@/lib/domain/admissions";
import { pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listApplications } from "@/lib/services/admissions";
import { listStaffAccounts } from "@/lib/services/care-team";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Admissions" };

/** What needs the administrator, in the order applications move through it. */
const SEGMENTS = {
    all: { label: "All", matches: () => true },
    coach: { label: "Needs a coach", matches: (a: Application) => a.status === "submitted" && !a.evaluator },
    assessment: { label: "Being assessed", matches: (a: Application) => a.status === "submitted" && a.evaluator !== null },
    decision: { label: "Awaiting decision", matches: (a: Application) => a.status === "passed" },
    activation: { label: "Awaiting activation", matches: (a: Application) => a.status === "approved" },
    closed: { label: "Closed", matches: (a: Application) => a.status === "activated" || a.status === "failed" || a.status === "rejected" },
} satisfies Record<string, { label: string; matches: (application: Application) => boolean }>;

type Segment = keyof typeof SEGMENTS;

export default async function AdminAdmissionsPage({ searchParams }: PageProps<"/admin/admissions">) {
    await requireRole("admin");
    const segment: Segment = parseEnum(param((await searchParams).view), Object.keys(SEGMENTS) as Segment[]) ?? "all";
    const [applications, coaches] = await Promise.all([listApplications(), listStaffAccounts("coach")]);
    const shown = applications.filter(SEGMENTS[segment].matches);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? "Coach";

    return (
        <>
            <PageHeader title="Admissions" description="People applying to train as fighters. Assign a coach to assess each one, then approve or reject those who pass." />
            <div className="flex flex-col gap-4">
                <SegmentedLinks
                    label="Filter applications"
                    items={(Object.keys(SEGMENTS) as Segment[]).map((key) => ({
                        href: hrefWith(routes.admin.admissions, {}, { view: key === "all" ? undefined : key }),
                        label: SEGMENTS[key].label,
                        count: applications.filter(SEGMENTS[key].matches).length,
                        active: key === segment,
                    }))}
                />
                <Card className="overflow-hidden">
                    <CardHeader title={pluralize(shown.length, "application")} icon={<ClipboardList />} />
                    {shown.length === 0 ? (
                        <CardContent>
                            <EmptyState
                                compact
                                title={segment === "all" ? "No applications yet" : "Nothing here"}
                                description={segment === "all" ? "Applications appear here when people register and apply to train." : "No application is at this stage right now."}
                            />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ApplicationList applications={shown} hrefFor={routes.admin.admission} coachName={coachName} label="Applications" />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
