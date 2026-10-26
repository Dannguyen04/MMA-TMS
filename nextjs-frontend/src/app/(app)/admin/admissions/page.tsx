import { CircleAlert, ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationList } from "@/components/admissions/application-views";
import { Callout } from "@/components/training/callout";
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
import { listCareTeamGaps } from "@/lib/services/care-team-gaps";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Admissions" };

/** Whether an activated applicant's fighter account still waits for a coach or a sports doctor. */
type NeedsCareTeam = (application: Application) => boolean;

/**
 * What needs the administrator, in the order applications move through it. Activation isn't the end: a new fighter
 * can't train until they have a sports doctor, so they stay out of "Closed" until their care team is in place.
 */
const SEGMENTS = {
    all: { label: "All", matches: () => true },
    coach: { label: "Needs an assessor", matches: (a: Application) => a.status === "submitted" && !a.evaluator },
    assessment: { label: "Being assessed", matches: (a: Application) => a.status === "submitted" && a.evaluator !== null },
    decision: { label: "Awaiting decision", matches: (a: Application) => a.status === "passed" },
    activation: { label: "Awaiting activation", matches: (a: Application) => a.status === "approved" },
    care: { label: "Needs care team", matches: (a: Application, needsCare: NeedsCareTeam) => a.status === "activated" && needsCare(a) },
    closed: {
        label: "Closed",
        matches: (a: Application, needsCare: NeedsCareTeam) => (a.status === "activated" && !needsCare(a)) || a.status === "failed" || a.status === "rejected",
    },
} satisfies Record<string, { label: string; matches: (application: Application, needsCare: NeedsCareTeam) => boolean }>;

type Segment = keyof typeof SEGMENTS;

/** What an empty segment says. None has an action of its own: applicants arrive by applying. */
const EMPTY: Record<Segment, { title: string; description: string }> = {
    all: { title: "No applications yet", description: "Applications appear here when people register and apply to train." },
    coach: { title: "Every applicant has an assessor", description: "New applications wait here until you choose a coach to assess them." },
    assessment: { title: "No assessments in progress", description: "Applicants wait here while their coach runs the entrance assessment." },
    decision: { title: "No decisions waiting", description: "Applicants who pass their entrance assessment wait here for you to approve or reject them." },
    activation: { title: "No one waiting to activate", description: "Approved applicants wait here until they set a password and activate their fighter account." },
    care: { title: "Every new fighter has a care team", description: "Activated fighters wait here until they have a coach and a sports doctor." },
    closed: { title: "Nothing closed yet", description: "Fighters with a full care team, and applicants who didn't pass or weren't admitted, end up here." },
};

export default async function AdminAdmissionsPage({ searchParams }: PageProps<"/admin/admissions">) {
    const admin = await requireRole("admin");
    const segment: Segment = parseEnum(param((await searchParams).view), Object.keys(SEGMENTS) as Segment[]) ?? "all";
    const [applications, coaches, careTeamGaps] = await Promise.all([listApplications(), listStaffAccounts("coach"), listCareTeamGaps(admin)]);
    const waitingForCare = new Set((careTeamGaps ?? []).map((gap) => gap.userId));
    const needsCare: NeedsCareTeam = (application) => waitingForCare.has(application.applicantId);
    const inSegment = (key: Segment) => applications.filter((application) => SEGMENTS[key].matches(application, needsCare));
    const shown = inSegment(segment);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? "Coach";
    const empty = applications.length > 0 && segment !== "all" ? EMPTY[segment] : EMPTY.all;

    return (
        <>
            <PageHeader
                title="Admissions"
                description="People applying to train as fighters. Assign a coach to assess each one, approve or reject those who pass, then give each new fighter a care team."
            />
            <div className="flex flex-col gap-4">
                <SegmentedLinks
                    label="Filter applications"
                    items={(Object.keys(SEGMENTS) as Segment[]).map((key) => ({
                        href: hrefWith(routes.admin.admissions, {}, { view: key === "all" ? undefined : key }),
                        label: SEGMENTS[key].label,
                        count: inSegment(key).length,
                        active: key === segment,
                    }))}
                />
                {careTeamGaps === null && (segment === "care" || segment === "closed") && (
                    <Callout tone="warning" icon={CircleAlert} title="Care teams couldn't be checked">
                        The fighter or medical service didn&apos;t answer, so activated fighters show as closed even if they still wait for a coach or a sports
                        doctor. Reload the page to try again.
                    </Callout>
                )}
                <Card className="overflow-hidden">
                    <CardHeader title={pluralize(shown.length, "application")} icon={<ClipboardList />} />
                    {shown.length === 0 ? (
                        <CardContent>
                            <EmptyState compact title={empty.title} description={empty.description} />
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
