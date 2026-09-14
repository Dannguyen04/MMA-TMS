import { ClipboardPlus, SearchX, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ExaminationOutcomeBadge } from "@/components/medical/clinical-badges";
import { ExaminationList } from "@/components/medical/examination-list";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_OUTCOME_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ExaminationOutcome, ExaminationType, MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listExaminations } from "@/lib/services/medical";
import { listDoctors, listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Examinations" };

const PAGE_SIZE = 12;
const TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];
const OUTCOMES = Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[];
const OUTCOME_RANK: Record<ExaminationOutcome, number> = { unfit: 0, fit_with_restrictions: 1, fit: 2 };
const SORTS = ["date", "fighter", "type", "outcome", "followUp"] as const;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const dateParam = (value: string | undefined) => (value && DATE_KEY.test(value) ? value : undefined);

export default async function ExaminationsPage({ searchParams }: PageProps<"/doctor/examinations">) {
    const user = await requireRole("doctor");
    const params = await searchParams;

    const fighterParam = param(params.fighter);
    const fighterFilter = fighterParam && canAccessFighter(user, fighterParam) ? fighterParam : undefined;
    const type = parseEnum(param(params.type), TYPES);
    const outcome = parseEnum(param(params.outcome), OUTCOMES);
    const from = dateParam(param(params.from));
    const to = dateParam(param(params.to));
    const sort = parseEnum(param(params.sort), SORTS) ?? "date";
    const dir = parseSortDirection(param(params.dir), sort === "date" ? "desc" : "asc");
    const hasFilters = Boolean(fighterFilter || type || outcome || from || to);

    const [fighters, doctors, examinations] = await Promise.all([
        listFighters(user),
        listDoctors(),
        listExaminations({ fighterIds: fighterFilter ? [fighterFilter] : accessibleFighterIds(user), type, outcome, from, to }),
    ]);
    const fighterById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

    const accessors: Record<(typeof SORTS)[number], (exam: MedicalExamination) => string | number | null> = {
        date: (exam) => exam.date,
        fighter: (exam) => fighterById.get(exam.fighterId)?.name ?? null,
        type: (exam) => EXAMINATION_TYPE_LABELS[exam.type],
        outcome: (exam) => OUTCOME_RANK[exam.outcome],
        followUp: (exam) => exam.followUpDate,
    };
    const page = paginate(sortItems(examinations, accessors[sort], dir), param(params.page), PAGE_SIZE);
    const pathname = routes.doctor.examinations;
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader
                title="Examinations"
                description="Every examination recorded for your assigned fighters, with outcome and follow-up."
                actions={
                    <ButtonLink href={fighterFilter ? `${routes.doctor.newExamination}?fighter=${fighterFilter}` : routes.doctor.newExamination}>
                        <ClipboardPlus aria-hidden />
                        New examination
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-4">
                <FilterBar
                    filters={[
                        {
                            type: "select",
                            name: "fighter",
                            label: "Fighter",
                            allLabel: "All fighters",
                            options: fighters.map((fighter) => ({ value: fighter.id, label: fighter.name })),
                        },
                        {
                            type: "select",
                            name: "type",
                            label: "Examination type",
                            allLabel: "All types",
                            options: TYPES.map((value) => ({ value, label: EXAMINATION_TYPE_LABELS[value] })),
                        },
                        {
                            type: "select",
                            name: "outcome",
                            label: "Outcome",
                            allLabel: "All outcomes",
                            options: OUTCOMES.map((value) => ({ value, label: EXAMINATION_OUTCOME_LABELS[value] })),
                        },
                        { type: "date", name: "from", label: "From" },
                        { type: "date", name: "to", label: "To" },
                    ]}
                />

                {page.total === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={<SearchX />}
                            title="No examinations match these filters"
                            description="Widen the date range or clear the filters to see every examination."
                            action={
                                <ButtonLink href={pathname} variant="secondary">
                                    Clear filters
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<Stethoscope />}
                            title="No examinations recorded yet"
                            description="Start with a baseline physical for each fighter — later examinations are compared against it."
                            action={
                                <ButtonLink href={routes.doctor.newExamination}>
                                    <ClipboardPlus aria-hidden />
                                    New examination
                                </ButtonLink>
                            }
                        />
                    )
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption="Examinations">
                                <THead>
                                    <tr>
                                        <SortableTH label="Date" sortKey="date" {...sortProps} />
                                        <SortableTH label="Fighter" sortKey="fighter" {...sortProps} />
                                        <SortableTH label="Examination" sortKey="type" {...sortProps} />
                                        <SortableTH label="Outcome" sortKey="outcome" {...sortProps} />
                                        <SortableTH label="Follow-up" sortKey="followUp" {...sortProps} />
                                        <TH>Examined by</TH>
                                    </tr>
                                </THead>
                                <TBody>
                                    {page.items.map((exam) => {
                                        const fighter = fighterById.get(exam.fighterId);
                                        return (
                                            <TR key={exam.id}>
                                                <TD className="whitespace-nowrap">
                                                    <Link href={routes.doctor.examination(exam.id)} className="rounded-sm font-medium text-fg hover:underline">
                                                        <time dateTime={exam.date}>{formatDate(exam.date)}</time>
                                                        <span className="sr-only">, {EXAMINATION_TYPE_LABELS[exam.type]}</span>
                                                    </Link>
                                                    <span className="block text-xs text-fg-muted">{formatTime(exam.date)}</span>
                                                </TD>
                                                <TD className="min-w-44">
                                                    {fighter ? (
                                                        <Link href={routes.doctor.fighter(fighter.id)} className="flex items-center gap-2 rounded-sm text-fg hover:underline">
                                                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                                                            <span className="truncate">{fighter.name}</span>
                                                        </Link>
                                                    ) : (
                                                        <span className="text-fg-muted">Unknown fighter</span>
                                                    )}
                                                </TD>
                                                <TD className="min-w-48">{EXAMINATION_TYPE_LABELS[exam.type]}</TD>
                                                <TD>
                                                    <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" />
                                                </TD>
                                                <TD className="whitespace-nowrap text-[13px]">
                                                    {exam.followUpDate ? (
                                                        <time dateTime={exam.followUpDate}>{formatDate(exam.followUpDate)}</time>
                                                    ) : (
                                                        <span className="text-fg-muted">None</span>
                                                    )}
                                                </TD>
                                                <TD className="whitespace-nowrap text-[13px] text-fg-muted">{doctorNames.get(exam.doctorId) ?? "Sports doctor"}</TD>
                                            </TR>
                                        );
                                    })}
                                </TBody>
                            </Table>
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="examinations" />
                        </Card>

                        <Card className="overflow-hidden md:hidden">
                            <ExaminationList
                                items={page.items.map((exam) => ({ examination: exam, fighterName: fighterById.get(exam.fighterId)?.name ?? "Unknown fighter" }))}
                            />
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="examinations" />
                        </Card>
                    </>
                )}
            </div>
        </>
    );
}
