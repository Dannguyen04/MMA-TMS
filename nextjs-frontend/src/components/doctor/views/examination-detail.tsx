import { CalendarClock, ClipboardList, NotebookPen, ShieldCheck, Stethoscope, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { ClearanceBadge, FighterStatusBadges } from "@/components/domain/status-badges";
import { VitalsGrid } from "@/components/domain/vitals-grid";
import {
    AssessmentResultBadge,
    CLEARANCE_LEVEL_FOR_OUTCOME,
    ClearanceRecordStatusBadge,
    EXAMINATION_OUTCOME_DESCRIPTIONS,
    EXAMINATION_OUTCOME_META,
    ExaminationOutcomeBadge,
} from "@/components/medical/clinical-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { PrintButton } from "@/components/medical/print-button";
import { Scat6Summary } from "@/components/medical/scat6-summary";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { CLEARANCE_LEVEL_LABELS, examinationTitle } from "@/lib/domain/labels";
import { clearanceState, currentClearance, type ClearanceState } from "@/lib/domain/rules";
import { daysBetween, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getExamination, listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { BodyPanel } from "@/components/doctor/body-panel";
import { Panel } from "@/components/doctor/ui";
import { getFighter, listDoctors } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

const PRINT_STYLES = `
@media print {
    body * { visibility: hidden; }
    #examination-report, #examination-report * { visibility: visible; }
    #examination-report { position: absolute; top: 0; left: 0; width: 100%; }
    #examination-report header > a { display: none; }
}
`;

/** The examination and its fighter, loaded once per request for the metadata and the page. Null when missing or not assigned. */
const loadExamination = cache(async (examId: string) => {
    const user = await requireRole("doctor");
    const exam = await getExamination(examId);
    if (!exam || !canAccessFighter(user, exam.fighterId)) return null;
    const fighter = await getFighter(exam.fighterId);
    return fighter ? { exam, fighter } : null;
});

/** The fighter an examination belongs to, when the doctor may open it. */
export async function examinationOwner(examId: string): Promise<string | null> {
    return (await loadExamination(examId))?.fighter.id ?? null;
}

export async function examinationMetadata(examId: string): Promise<Metadata> {
    const loaded = await loadExamination(examId);
    return { title: loaded ? `${examinationTitle(loaded.exam)} — ${loaded.fighter.name}` : "Không tìm thấy phiếu khám" };
}

/** One examination, shown inside its fighter's profile. */
export async function ExaminationDetail({ examId, query, fighterId: scopedId }: { examId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const now = new Date().toISOString();

    const loaded = await loadExamination(examId);
    if (!loaded || loaded.fighter.id !== scopedId) notFound();
    const { exam, fighter } = loaded;

    const [doctors, clearances, fighterExams, settings, fighterInjuries] = await Promise.all([
        listDoctors(),
        listClearances({ fighterIds: [exam.fighterId] }),
        listExaminations({ fighterIds: [exam.fighterId] }),
        getSettings(),
        listInjuries({ fighterIds: [exam.fighterId] }).catch(() => []),
    ]);

    const doctorName = doctors.find((doctor) => doctor.id === exam.doctorId)?.name ?? "Bác sĩ thể thao";
    const current = currentClearance(clearances, fighter.id);
    const currentState = clearanceState(current, now);
    const linked = clearances.filter((clearance) => clearance.examinationId === exam.id);
    const isLatest = fighterExams[0]?.id === exam.id;
    const expectedLevel = CLEARANCE_LEVEL_FOR_OUTCOME[exam.outcome];
    const suggestUpdate = isLatest && linked.length === 0 && currentState !== expectedLevel;
    const grantHref = hrefWith(routes.doctor.fighterGrantClearance(fighter.id), {}, { exam: exam.id });

    const counts = {
        abnormal: exam.assessments.filter((a) => a.result === "abnormal").length,
        inconclusive: exam.assessments.filter((a) => a.result === "inconclusive").length,
        normal: exam.assessments.filter((a) => a.result === "normal").length,
    };
    const outcomeMeta = EXAMINATION_OUTCOME_META[exam.outcome];
    const followUpDays = exam.followUpDate ? daysBetween(now, exam.followUpDate) : null;

    return (
        <div id="examination-report">
            <style>{PRINT_STYLES}</style>
            <FlashToast
                notice={
                    param(query.notice) === "examination-recorded"
                        ? { title: "Đã ghi phiếu khám", description: `${fighter.name} có thể xem tóm tắt và khuyến nghị ở trang Sức khỏe.` }
                        : null
                }
                cleanHref={hrefWith(routes.doctor.fighterExamination(fighter.id, exam.id), query, { notice: null })}
            />

            <PageHeader
                back={{ href: routes.doctor.fighterExaminations(fighter.id), label: "Phiếu khám" }}
                eyebrow="Phiếu khám"
                title={examinationTitle(exam)}
                description={
                    <>
                        <Link href={routes.doctor.fighter(fighter.id)} className="font-medium text-fg hover:underline">
                            {fighter.name}
                        </Link>{" "}
                        · <time dateTime={exam.date}>{formatDateTime(exam.date)}</time> · {doctorName}
                    </>
                }
                meta={
                    <>
                        <ExaminationOutcomeBadge outcome={exam.outcome} />
                        {counts.abnormal > 0 && (
                            <Badge tone="warning" icon={TriangleAlert}>
                                {pluralize(counts.abnormal, "dấu hiệu bất thường")}
                            </Badge>
                        )}
                    </>
                }
                actions={
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <PrintButton />
                        {!suggestUpdate && (
                            <ButtonLink href={grantHref} variant="secondary">
                                <ShieldCheck aria-hidden />
                                Cập nhật giấy phép
                            </ButtonLink>
                        )}
                    </div>
                }
            />

            <div className="flex flex-col gap-6">
                {suggestUpdate && (
                    <Callout
                        tone="info"
                        icon={ShieldCheck}
                        title="Cập nhật giấy phép theo phiếu khám này"
                        action={<ButtonLink href={grantHref}>Cập nhật giấy phép</ButtonLink>}
                        className="print:hidden"
                    >
                        Kết luận “{outcomeMeta.label}” gợi ý <strong className="font-medium text-fg">{CLEARANCE_LEVEL_LABELS[expectedLevel]}</strong>, nhưng giấy phép của{" "}
                        {fighter.name} hiện là {describeState(currentState)}. HLV lên giáo án theo giấy phép, nên hãy cập nhật cho khớp với kết quả khám.
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        {exam.vitals && (
                            <Card>
                                <CardHeader title="Sinh hiệu" icon={<Stethoscope />} description={`Đối chiếu ngưỡng vận động viên và giới hạn hạng cân ${fighter.targetWeightKg} kg`} />
                                <CardContent>
                                    <VitalsGrid vitals={exam.vitals} weightLimitKg={fighter.targetWeightKg} />
                                </CardContent>
                            </Card>
                        )}

                        {exam.assessments.length > 0 && (
                            <Card>
                                <CardHeader
                                    title="Đánh giá"
                                    icon={<ClipboardList />}
                                    description={[
                                        counts.normal > 0 ? `${counts.normal} bình thường` : null,
                                        counts.abnormal > 0 ? `${counts.abnormal} bất thường` : null,
                                        counts.inconclusive > 0 ? `${counts.inconclusive} inconclusive` : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                />
                                <div className="pb-2">
                                    <Table caption="Đánh giá">
                                        <THead>
                                            <tr>
                                                <TH>Vùng</TH>
                                                <TH>Kết quả</TH>
                                                <TH>Kết quả khám</TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {exam.assessments.map((assessment, index) => (
                                                <TR key={`${assessment.area}-${index}`} className={cn(assessment.result === "abnormal" && "bg-warning-soft/30")}>
                                                    <TD className="min-w-44 font-medium">{assessment.area}</TD>
                                                    <TD className="whitespace-nowrap">
                                                        <AssessmentResultBadge result={assessment.result} size="sm" />
                                                    </TD>
                                                    <TD className="min-w-64 text-[13px] text-pretty">
                                                        {assessment.note || <span className="text-fg-muted">Không có ghi chú</span>}
                                                    </TD>
                                                </TR>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            </Card>
                        )}

                        <Card>
                            <CardHeader title="Tóm tắt & khuyến nghị" icon={<NotebookPen />} />
                            <CardContent className="flex flex-col gap-5">
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">Tóm tắt kết quả khám</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.summary}</p>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">Khuyến nghị</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.recommendations || <span className="text-fg-muted">Chưa ghi nhận.</span>}</p>
                                </div>
                                {exam.decisionRestrictions?.notes && (
                                    <div>
                                        <h3 className="text-[13px] font-semibold text-fg-muted">Ghi chú hạn chế</h3>
                                        <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.decisionRestrictions.notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {exam.scat6 && <Scat6Summary record={exam.scat6} />}
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Kết luận" />
                            <CardContent className="flex flex-col gap-4">
                                <Callout tone={outcomeMeta.tone} icon={outcomeMeta.icon} title={outcomeMeta.label}>
                                    {EXAMINATION_OUTCOME_DESCRIPTIONS[exam.outcome]}
                                </Callout>
                                <div className="flex items-start gap-2.5 text-sm">
                                    <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                    {exam.followUpDate && followUpDays !== null ? (
                                        <p>
                                            <span className="block text-[13px] text-fg-muted">Khám theo dõi</span>
                                            <time dateTime={exam.followUpDate} className="font-medium text-fg">
                                                {formatDate(exam.followUpDate)}
                                            </time>
                                            <span className="text-fg-muted"> · {followUpDays < 0 ? `${describeDaysUntil(followUpDays)}` : capitalize(describeDaysUntil(followUpDays))}</span>
                                        </p>
                                    ) : (
                                        <p className="text-fg-muted">Chưa hẹn khám theo dõi</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Giấy phép" icon={<ShieldCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {linked.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[13px] text-fg-muted">Cấp dựa trên phiếu khám này:</p>
                                        {linked.map((clearance) => (
                                            <div key={clearance.id} className="rounded-lg border border-border px-3 py-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <ClearanceBadge state={clearance.level} size="sm" />
                                                    <ClearanceRecordStatusBadge status={clearance.status} size="sm" />
                                                </div>
                                                <p className="mt-1.5 text-[13px] text-fg-muted">
                                                    Cấp ngày {formatDate(clearance.issuedAt)}
                                                    {clearance.validUntil ? ` · hiệu lực đến ${formatDate(clearance.validUntil)}` : ""}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-fg-muted">Chưa cấp giấy phép nào từ phiếu khám này.</p>
                                )}
                                <div className="border-t border-border pt-4">
                                    <p className="mb-1.5 text-[13px] text-fg-muted">Giấy phép hiện tại</p>
                                    <div className="flex flex-col items-start gap-1">
                                        <ClearanceBadge state={currentState} size="sm" />
                                        <ClearanceValidity clearance={current} state={currentState} now={now} warningDays={settings.clearanceExpiryWarningDays} />
                                    </div>
                                    <Link
                                        href={`${routes.doctor.fighter(fighter.id)}?tab=clearance`}
                                        className="mt-3 inline-flex text-[13px] font-medium text-primary-soft-fg hover:underline print:hidden"
                                    >
                                        Lịch sử giấy phép
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        <Panel title="Bản đồ cơ thể" aside={fighterInjuries.length === 0 ? "Chưa ghi chấn thương" : `${fighterInjuries.length} chấn thương`} tone="plate" id="ban-do-co-the">
                            <BodyPanel injuries={fighterInjuries} excluded={[]} height={340} />
                        </Panel>

                        <Card>
                            <CardHeader title="Bệnh nhân" icon={<UserRound />} />
                            <CardContent className="flex flex-col gap-3">
                                <FighterIdentity fighter={fighter} href={routes.doctor.fighter(fighter.id)} />
                                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={currentState} size="sm" className="self-start" />
                                <p className="text-[13px] text-fg-muted">
                                    {isLatest
                                        ? "Đây là phiếu khám gần nhất của võ sĩ."
                                        : `Đã có phiếu khám mới hơn — ${fighterExams.findIndex((candidate) => candidate.id === exam.id)} phiếu khám được ghi sau đó.`}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function describeState(state: ClearanceState): string {
    switch (state) {
        case "none":
            return "chưa có trong hồ sơ";
        case "expired":
            return "expired";
        default:
            return `“${CLEARANCE_LEVEL_LABELS[state]}”`;
    }
}
