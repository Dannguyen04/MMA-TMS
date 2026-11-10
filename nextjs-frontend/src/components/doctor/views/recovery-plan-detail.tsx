import { CircleCheck, ClipboardList, FileText, LineChart as LineChartIcon, ListChecks, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CheckInDialog } from "@/components/clinical/check-in-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle, painLabel } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { LegacyMilestones, MilestoneTracker, PlanCloseActions } from "@/components/clinical/milestone-tracker";
import { RecoveryTracker } from "@/components/clinical/recovery-tracker";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { CardLink } from "@/components/dashboard/card-link";
import { CheckInCharts } from "@/components/domain/check-in-charts";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { InjuryStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { dayKey, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceStatus, getRecoveryPlanDetail } from "@/lib/services/medical";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { getDoctor } from "@/lib/services/people";
import { param } from "@/lib/utils";
import { NOT_RECORDED } from "@/components/domain/domain-format";

/** The plan with its fighter, injury, treatments and doctor, loaded once per request for the metadata and the page. */
const loadRecoveryPlanDetail = cache(getRecoveryPlanDetail);

/** The fighter a recovery plan belongs to, when the doctor may open it. */
export async function recoveryPlanOwner(planId: string): Promise<string | null> {
    const [detail, user] = await Promise.all([loadRecoveryPlanDetail(planId), getCurrentUser()]);
    return detail && user && canAccessFighter(user, detail.plan.fighterId) ? detail.plan.fighterId : null;
}

export async function recoveryPlanMetadata(planId: string): Promise<Metadata> {
    const user = await getCurrentUser();
    const detail = await loadRecoveryPlanDetail(planId);
    // The title must not reveal a plan the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.plan.fighterId);
    return { title: visible ? `${detail.plan.title} · ${detail.fighter.name}` : "Kế hoạch phục hồi" };
}

/** One recovery plan, shown inside its fighter's profile. */
export async function RecoveryPlanDetail({ planId, query, fighterId: scopedId }: { planId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadRecoveryPlanDetail(planId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.plan.fighterId) || detail.plan.fighterId !== scopedId) notFound();
    const { plan, fighter, injury, treatments, doctor } = detail;

    const { clearance, state: clearanceNow } = await getClearanceStatus(fighter.id, now);
    const clearanceDoctor = clearance ? await getDoctor(clearance.doctorId) : null;
    const justCreated = param(query.created) === "1";
    const checkInsNewestFirst = [...plan.checkIns].reverse();
    const lastCheckIn = plan.checkIns.at(-1) ?? null;
    const isCompleted = plan.status === "completed";
    // API mode: the service's plans are flat milestone lists, closed by completing or cancelling them.
    const serviceForms = usesMedicalServiceForms();
    const milestones = plan.milestones ?? [];

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.fighterRecovery(fighter.id), label: "Phục hồi" }}
                eyebrow="Kế hoạch phục hồi"
                title={plan.title}
                meta={
                    <>
                        <RecoveryPlanStatusBadge status={plan.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <Link
                            href={routes.doctor.fighter(fighter.id)}
                            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-fg hover:underline"
                        >
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            {fighter.name}
                        </Link>
                        {injury && (
                            <>
                                <span aria-hidden className="text-fg-subtle max-sm:hidden">
                                    ·
                                </span>
                                <Link
                                    href={routes.doctor.fighterInjury(injury.fighterId, injury.id)}
                                    className="rounded-md text-sm text-fg-muted hover:text-fg hover:underline"
                                >
                                    {injuryTitle(injury)}
                                </Link>
                                <InjuryStatusBadge status={injury.status} size="sm" />
                            </>
                        )}
                    </>
                }
                actions={
                    serviceForms ? (
                        plan.status === "active" && <PlanCloseActions fighterId={fighter.id} planId={plan.id} />
                    ) : !isCompleted && (
                        <CheckInDialog
                            planId={plan.id}
                            fighterName={fighter.name}
                            minDate={dayKey(plan.startDate)}
                            today={dayKey(now)}
                            lastCheckIn={lastCheckIn}
                        />
                    )
                }
            />

            <div className="flex flex-col gap-6">
                {justCreated && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        role="status"
                        title="Đã tạo kế hoạch phục hồi"
                        action={
                            <ButtonLink href={routes.doctor.fighterRecoveryPlan(plan.fighterId, plan.id)} variant="ghost" size="sm" replace scroll={false}>
                                Đóng
                            </ButtonLink>
                        }
                    >
                        {serviceForms
                            ? `${fighter.name} có thể theo dõi kế hoạch ở trang Sức khỏe. Đánh dấu từng mốc khi đạt.`
                            : `${fighter.name} đã được thông báo, HLV được báo kế hoạch trở lại tập đã bắt đầu — không kèm chi tiết lâm sàng. Ghi lần kiểm tra đầu tiên để bắt đầu theo dõi.`}
                    </Callout>
                )}

                {isCompleted && injury && injury.status !== "resolved" && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        title={serviceForms ? "Đã hoàn tất kế hoạch" : "Mọi giai đoạn đã xong"}
                        action={
                            <>
                                <ButtonLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} size="sm" variant="secondary">
                                    Mở hồ sơ chấn thương
                                </ButtonLink>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    Xem lại giấy phép
                                </ButtonLink>
                            </>
                        }
                    >
                        Hồ sơ chấn thương và giấy phép không tự thay đổi. Hãy đánh dấu đã khỏi và cập nhật giấy phép khi đánh giá của bạn cho phép trở lại hoàn toàn.
                    </Callout>
                )}

                {serviceForms ? (
                    <Card>
                        <CardHeader
                            title="Các mốc"
                            icon={<ListChecks />}
                            description={plan.status === "active" ? "Đánh dấu mốc khi đạt. Võ sĩ thấy chúng ở trang Sức khỏe." : "Kế hoạch này đã đóng."}
                        />
                        <CardContent>
                            {plan.legacyMilestones ? (
                                <LegacyMilestones items={plan.legacyMilestones} />
                            ) : (
                                <MilestoneTracker fighterId={fighter.id} planId={plan.id} milestones={milestones} editable={plan.status === "active"} startDate={dayKey(plan.startDate)} />
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader
                            title="Giai đoạn & mốc"
                            icon={<ListChecks />}
                            description="Đánh dấu mốc khi đạt. Tiến độ cập nhật ngay."
                        />
                        <CardContent>
                            <RecoveryTracker plan={plan} now={now} />
                        </CardContent>
                    </Card>
                )}

                {medicalFeatureAvailable("recoveryPhasesAndCheckIns") && (
                    <Card className="overflow-hidden">
                        <CardHeader
                            title="Kiểm tra định kỳ"
                            icon={<LineChartIcon />}
                            description={
                                plan.checkIns.length === 0
                                    ? "Đau, vận động và sức mạnh theo thời gian"
                                    : `${plan.checkIns.length} lần kiểm tra · gần nhất ${formatDate(plan.checkIns.at(-1)?.date ?? now)}`
                            }
                        />
                        {plan.checkIns.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<LineChartIcon />}
                                title="Chưa có lần kiểm tra"
                                description="Ghi đau, vận động và sức mạnh mỗi lần kiểm tra để theo dõi đáp ứng."
                                className="border-t border-border"
                            />
                        ) : (
                            <>
                                <CardContent>
                                    {plan.checkIns.length >= 2 ? (
                                        <CheckInCharts checkIns={plan.checkIns} audience="clinical" />
                                    ) : (
                                        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                            Xu hướng hiện sau lần kiểm tra thứ hai.
                                        </p>
                                    )}
                                </CardContent>
                                <div className="border-t border-border">
                                    <h3 className="sr-only">Lịch sử kiểm tra</h3>
                                    <Table caption="Lịch sử kiểm tra, mới nhất trước">
                                        <THead>
                                            <tr>
                                                <TH>Ngày</TH>
                                                <TH className="text-right">Đau</TH>
                                                <TH className="text-right">Vận động</TH>
                                                <TH className="text-right">Sức mạnh</TH>
                                                <TH>Ghi chú</TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {checkInsNewestFirst.map((checkIn) => (
                                                <TR key={checkIn.date}>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={checkIn.date}>{formatDate(checkIn.date)}</time>
                                                    </TD>
                                                    <TD className="text-right whitespace-nowrap">
                                                        <span className="font-medium">{checkIn.painLevel}</span>
                                                        <span className="text-fg-muted">/10</span>
                                                        <span className="block text-xs text-fg-muted">{painLabel(checkIn.painLevel)}</span>
                                                    </TD>
                                                    <TD className="text-right">{checkIn.mobilityPct}%</TD>
                                                    <TD className="text-right">{checkIn.strengthPct}%</TD>
                                                    <TD className="min-w-64 text-[13px] text-pretty text-fg-muted">{checkIn.note || "—"}</TD>
                                                </TR>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </Card>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader
                            title="Điều trị"
                            icon={<ClipboardList />}
                            description="Cho chấn thương này"
                            action={
                                injury && (
                                    <CardLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} srContext="điều trị trong hồ sơ chấn thương">
                                        Quản lý
                                    </CardLink>
                                )
                            }
                        />
                        {treatments.length === 0 ? (
                            <p className="border-t border-border px-5 py-4 text-sm text-fg-muted">Chưa ghi nhận điều trị cho chấn thương này.</p>
                        ) : (
                            <TreatmentList treatments={treatments} className="border-t border-border" />
                        )}
                    </Card>

                    <aside aria-label="Giấy phép và chi tiết kế hoạch" className="flex min-w-0 flex-col gap-6">
                        <ClearanceCard
                            clearance={clearance}
                            state={clearanceNow}
                            doctorName={clearanceDoctor?.name}
                            now={now}
                            variant="summary"
                            warningDays={settings.clearanceExpiryWarningDays}
                        />
                        <Card>
                            <CardHeader title="Chi tiết kế hoạch" icon={<FileText />} />
                            <CardContent>
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: "Bác sĩ phụ trách", value: doctor?.name ?? "Bác sĩ thể thao" },
                                        { label: "Bắt đầu", value: <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time> },
                                        {
                                            label: "Mục tiêu trở lại",
                                            value: plan.targetReturnDate ? <time dateTime={plan.targetReturnDate}>{formatDate(plan.targetReturnDate)}</time> : NOT_RECORDED,
                                        },
                                        serviceForms
                                            ? { label: "Các mốc", value: `Đạt ${milestones.filter((m) => m.isCompleted).length}/${milestones.length}` }
                                            : {
                                                  label: "Giai đoạn",
                                                  value: `Xong ${plan.phases.filter((p) => p.status === "completed").length}/${plan.phases.length}`,
                                              },
                                        ...(plan.description ? [{ label: "Phương pháp", value: <span className="font-normal">{plan.description}</span> }] : []),
                                    ]}
                                />
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}
