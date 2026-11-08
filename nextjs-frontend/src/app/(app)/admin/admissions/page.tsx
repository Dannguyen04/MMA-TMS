import { CircleAlert, ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { ApplicationList } from "@/components/admissions/application-views";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { Application } from "@/lib/domain/admissions";
import { plural, type Translator } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/translate";
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
    all: { label: "adminBody.jobs.all", matches: () => true },
    coach: { label: "adminBody.admissions.needsAssessor", matches: (a: Application) => a.status === "submitted" && !a.evaluator },
    assessment: { label: "adminBody.admissions.assessing", matches: (a: Application) => a.status === "submitted" && a.evaluator !== null },
    decision: { label: "adminBody.admissions.decision", matches: (a: Application) => a.status === "passed" },
    activation: { label: "adminBody.admissions.activation", matches: (a: Application) => a.status === "approved" },
    care: { label: "adminBody.admissions.care", matches: (a: Application, needsCare: NeedsCareTeam) => a.status === "activated" && needsCare(a) },
    closed: {
        label: "adminBody.admissions.closed",
        matches: (a: Application, needsCare: NeedsCareTeam) => (a.status === "activated" && !needsCare(a)) || a.status === "failed" || a.status === "rejected",
    },
} satisfies Record<string, { label: MessageKey; matches: (application: Application, needsCare: NeedsCareTeam) => boolean }>;

type Segment = keyof typeof SEGMENTS;

/** What an empty segment says. None has an action of its own: applicants arrive by applying. */
const EMPTY: Record<Segment, { title: MessageKey; description: MessageKey }> = {
    all: { title: "adminBody.admissions.emptyAll", description: "adminBody.admissions.emptyAllText" },
    coach: { title: "adminBody.queue.assessor.emptyTitle", description: "adminBody.queue.assessor.emptyText" },
    assessment: { title: "adminBody.admissions.emptyAssess", description: "adminBody.admissions.emptyAssessText" },
    decision: { title: "adminBody.queue.decision.emptyTitle", description: "adminBody.queue.decision.emptyText" },
    activation: { title: "adminBody.admissions.emptyActivate", description: "adminBody.admissions.emptyActivateText" },
    care: { title: "adminBody.admissions.emptyCare", description: "adminBody.admissions.emptyCareText" },
    closed: { title: "adminBody.admissions.emptyClosed", description: "adminBody.admissions.emptyClosedText" },
};

function emptyCopy(t: Translator, segment: Segment) {
    return { title: t(EMPTY[segment].title), description: t(EMPTY[segment].description) };
}

export default async function AdminAdmissionsPage({ searchParams }: PageProps<"/admin/admissions">) {
    const { t } = await getTranslator();
    const admin = await requireRole("admin");
    const segment: Segment = parseEnum(param((await searchParams).view), Object.keys(SEGMENTS) as Segment[]) ?? "all";
    const [applications, coaches, careTeamGaps] = await Promise.all([listApplications(), listStaffAccounts("coach"), listCareTeamGaps(admin)]);
    const waitingForCare = new Set((careTeamGaps ?? []).map((gap) => gap.userId));
    const needsCare: NeedsCareTeam = (application) => waitingForCare.has(application.applicantId);
    const inSegment = (key: Segment) => applications.filter((application) => SEGMENTS[key].matches(application, needsCare));
    const shown = inSegment(segment);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? t("adminBody.fallback.coach");
    const empty = emptyCopy(t, applications.length > 0 && segment !== "all" ? segment : "all");

    return (
        <>
            <PageHeader
                title={t("screens.misc.adminPages.admissions.title")}
                description={t("adminBody.admissions.description")}
            />
            <div className="flex flex-col gap-4">
                <SegmentedLinks
                    label={t("adminBody.admissions.filter")}
                    items={(Object.keys(SEGMENTS) as Segment[]).map((key) => ({
                        href: hrefWith(routes.admin.admissions, {}, { view: key === "all" ? undefined : key }),
                        label: t(SEGMENTS[key].label),
                        count: inSegment(key).length,
                        active: key === segment,
                    }))}
                />
                {careTeamGaps === null && (segment === "care" || segment === "closed") && (
                    <Callout tone="warning" icon={CircleAlert} title={t("adminBody.admissions.careUnchecked")}>
                        {t("adminBody.admissions.careUncheckedText")}
                    </Callout>
                )}
                <Card className="overflow-hidden">
                    <CardHeader title={plural(t, "adminBody.admissions.count", shown.length)} icon={<ClipboardList />} />
                    {shown.length === 0 ? (
                        <CardContent>
                            <EmptyState compact title={empty.title} description={empty.description} />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ApplicationList applications={shown} hrefFor={routes.admin.admission} coachName={coachName} label={t("adminBody.admissions.list")} />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
