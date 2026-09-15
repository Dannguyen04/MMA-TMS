import { Stethoscope, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { ChartFigure } from "@/components/charts/chart-figure";
import { seriesColor } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatNumber, formatShortDate, formatTime, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { ExaminationOutcomeBadge } from "./clinical-badges";

const TREND_POINTS = 10;

export interface ExaminationHistoryProps {
    /** Newest first. */
    examinations: MedicalExamination[];
    doctorNames: Map<string, string>;
    weightLimitKg: number;
    newExaminationHref: string;
}

/** A fighter's examinations: weight at each visit against the class limit, then every examination in a table. */
export function ExaminationHistory({ examinations, doctorNames, weightLimitKg, newExaminationHref }: ExaminationHistoryProps) {
    if (examinations.length === 0) {
        return (
            <EmptyState
                compact
                icon={<Stethoscope />}
                title="No examinations recorded yet"
                description="Start with a baseline physical — it sets the reference values later examinations are compared with."
                action={
                    <ButtonLink href={newExaminationHref} variant="secondary" size="sm">
                        Record an examination
                    </ButtonLink>
                }
            />
        );
    }

    const trend = examinations.slice(0, TREND_POINTS).reverse();

    return (
        <div className="flex flex-col gap-5">
            {trend.length >= 2 && (
                <div className="px-5">
                    <ChartFigure
                        title="Weight at examination (kg)"
                        description={`Last ${pluralize(trend.length, "examination")}, against the ${formatNumber(weightLimitKg, 1)} kg class limit`}
                        table={{
                            columns: ["Examination", "Weight (kg)", "Resting HR (bpm)"],
                            rows: trend.map((exam) => [`${formatDate(exam.date)} · ${EXAMINATION_TYPE_LABELS[exam.type]}`, exam.vitals.weightKg, exam.vitals.restingHeartRate]),
                        }}
                    >
                        <LineChart
                            ariaLabel="Weight recorded at each examination, in kilograms"
                            labels={trend.map((exam) => formatShortDate(exam.date))}
                            series={[{ id: "weight", label: "Weight", color: seriesColor(1), values: trend.map((exam) => exam.vitals.weightKg) }]}
                            target={{ value: weightLimitKg, label: "Class limit" }}
                            decimals={1}
                            height={200}
                            highlightLast
                        />
                    </ChartFigure>
                </div>
            )}

            <Table caption="Examinations">
                <THead>
                    <tr>
                        <TH>Date</TH>
                        <TH>Examination</TH>
                        <TH>Outcome</TH>
                        <TH>Findings</TH>
                        <TH>Follow-up</TH>
                        <TH>Examined by</TH>
                    </tr>
                </THead>
                <TBody>
                    {examinations.map((exam) => {
                        const abnormal = exam.assessments.filter((a) => a.result === "abnormal").length;
                        const inconclusive = exam.assessments.filter((a) => a.result === "inconclusive").length;
                        return (
                            <TR key={exam.id}>
                                <TD className="whitespace-nowrap">
                                    <Link href={routes.doctor.examination(exam.id)} className="rounded-sm font-medium text-fg hover:underline">
                                        <time dateTime={exam.date}>{formatDate(exam.date)}</time>
                                    </Link>
                                    <span className="block text-xs text-fg-muted">{formatTime(exam.date)}</span>
                                </TD>
                                <TD className="min-w-44">{EXAMINATION_TYPE_LABELS[exam.type]}</TD>
                                <TD>
                                    <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" />
                                </TD>
                                <TD className="whitespace-nowrap text-[13px]">
                                    {abnormal > 0 ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                                            <TriangleAlert aria-hidden className="size-3.5" />
                                            {pluralize(abnormal, "abnormal finding")}
                                        </span>
                                    ) : inconclusive > 0 ? (
                                        <span className="text-fg-muted">{formatNumber(inconclusive)} inconclusive</span>
                                    ) : (
                                        <span className="text-fg-muted">All normal</span>
                                    )}
                                </TD>
                                <TD className="whitespace-nowrap text-[13px]">
                                    {exam.followUpDate ? <time dateTime={exam.followUpDate}>{formatDate(exam.followUpDate)}</time> : <span className="text-fg-muted">—</span>}
                                </TD>
                                <TD className="whitespace-nowrap text-[13px]">{doctorNames.get(exam.doctorId) ?? "Sports doctor"}</TD>
                            </TR>
                        );
                    })}
                </TBody>
            </Table>
        </div>
    );
}
