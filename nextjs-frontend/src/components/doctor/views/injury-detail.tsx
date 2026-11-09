import { ArrowRight, CircleCheck, ClipboardList, FileText, MapPin, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AddTreatmentDialog } from "@/components/clinical/add-treatment-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { InjuryStatusActions } from "@/components/clinical/injury-status-actions";
import { ObservationSummary } from "@/components/clinical/observation-summary";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { AINotice } from "@/components/domain/ai-notice";
import { RegionModel } from "@/components/doctor/region-model";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { describeDaysUntil, labelOf, NOT_RECORDED } from "@/components/domain/domain-format";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { ClearanceBadge, FighterStatusBadges, InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { RestrictionSummary } from "@/components/medical/restriction-summary";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_STATUS_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceStatus, getInjuryDetail } from "@/lib/services/medical";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { getVideo } from "@/lib/services/videos";
import { param } from "@/lib/utils";

/** The injury with its fighter, treatments, plan and linked observation, loaded once per request for the metadata and the page. */
const loadInjuryDetail = cache(getInjuryDetail);

/** The fighter an injury belongs to, when the doctor may open it. */
export async function injuryOwner(injuryId: string): Promise<string | null> {
    const [detail, user] = await Promise.all([loadInjuryDetail(injuryId), getCurrentUser()]);
    return detail && user && canAccessFighter(user, detail.injury.fighterId) ? detail.injury.fighterId : null;
}

export async function injuryMetadata(injuryId: string): Promise<Metadata> {
    const user = await getCurrentUser();
    const detail = await loadInjuryDetail(injuryId);
    // The title must not reveal a record the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.injury.fighterId);
    return { title: visible ? `${injuryTitle(detail.injury)} · ${detail.fighter.name}` : "Chấn thương" };
}

/** One injury, shown inside its fighter's profile. */
export async function InjuryDetail({ injuryId, query, fighterId: scopedId }: { injuryId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadInjuryDetail(injuryId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.injury.fighterId) || detail.injury.fighterId !== scopedId) notFound();
    const { injury, fighter, treatments, recoveryPlan, linkedAlert, recordedBy } = detail;

    const { clearance, state: clearanceNow } = await getClearanceStatus(fighter.id, now);
    const linkedVideo = linkedAlert ? await getVideo(linkedAlert.videoId) : null;
    const justCreated = param(query.created) === "1";
    const openPlan = recoveryPlan && recoveryPlan.status !== "completed" ? recoveryPlan : null;
    const firstName = fighter.name.split(" ")[0];
    const serviceForms = usesMedicalServiceForms();

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.fighterInjuries(fighter.id), label: "Chấn thương" }}
                eyebrow="Hồ sơ chấn thương"
                title={injuryTitle(injury)}
                meta={
                    <>
                        <InjurySeverityBadge severity={injury.severity} />
                        <InjuryStatusBadge status={injury.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <Link
                            href={routes.doctor.fighter(fighter.id)}
                            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-fg hover:underline"
                        >
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            {fighter.name}
                        </Link>
                        <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={clearanceNow} size="sm" />
                    </>
                }
                actions={
                    <InjuryStatusActions
                        injuryId={injury.id}
                        fighterId={fighter.id}
                        status={injury.status}
                        canReopen={!usesMedicalServiceForms()}
                        fighterName={fighter.name}
                        openPlanTitle={openPlan?.title ?? null}
                        todayLabel={formatDate(now)}
                    />
                }
            />

            <div className="flex flex-col gap-6">
                {justCreated && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        role="status"
                        title="Đã ghi chấn thương"
                        action={
                            <>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    Xem lại giấy phép của {fighter.name}
                                </ButtonLink>
                                <ButtonLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} variant="ghost" size="sm" replace scroll={false}>
                                    Đóng
                                </ButtonLink>
                            </>
                        }
                    >
                        {serviceForms
                            ? `Giấy phép không tự thay đổi. Hãy khám ${fighter.name} và xem lại để giới hạn tập luyện khớp với chấn thương.`
                            : `HLV của ${fighter.name} đã được nhắc kiểm tra giấy phép. Hãy xem lại ngay để giới hạn tập luyện khớp với chấn thương này.`}
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title="Chi tiết chấn thương" icon={<FileText />} />
                            <CardContent className="flex flex-col gap-5">
                                <DescriptionList items={detailItems(injury, now, recordedBy?.name ?? null)} columns={3} className="grid-cols-2" />
                                <div className="border-t border-border pt-4">
                                    <h3 className="text-[13px] font-semibold text-fg">Mô tả lâm sàng</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-fg">{injury.description}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title="Điều trị"
                                description={
                                    treatments.length === 0
                                        ? "Những gì đang thực hiện cho chấn thương này"
                                        : medicalFeatureAvailable("treatmentStatus")
                                          ? `${treatments.filter((t) => t.status === "ongoing").length} đang thực hiện · tổng ${treatments.length}`
                                          : `Đã ghi ${treatments.length} điều trị`
                                }
                                icon={<ClipboardList />}
                                action={
                                    <AddTreatmentDialog
                                        injuryId={injury.id}
                                        fighterId={fighter.id}
                                        mode={usesMedicalServiceForms() ? "service" : "demo"}
                                        providerName={user.name}
                                        today={dayKey(now)}
                                    />
                                }
                            />
                            {treatments.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<ClipboardList />}
                                    title="Chưa có điều trị"
                                    description="Thêm nghỉ ngơi, vật lý trị liệu, chẩn đoán hình ảnh hoặc chuyển tuyến để võ sĩ theo dõi kế hoạch."
                                    className="border-t border-border"
                                />
                            ) : (
                                <TreatmentList treatments={treatments} editable className="border-t border-border" />
                            )}
                        </Card>

                        <Card>
                            <CardHeader
                                title="Kế hoạch phục hồi"
                                icon={<RefreshCw />}
                                description={recoveryPlan ? recoveryPlan.title : "Trở lại tập sau chấn thương này"}
                                action={
                                    recoveryPlan ? (
                                        <div className="flex items-center gap-2">
                                            <RecoveryPlanStatusBadge status={recoveryPlan.status} size="sm" />
                                        </div>
                                    ) : undefined
                                }
                            />
                            <CardContent>
                                {recoveryPlan ? (
                                    <div className="flex flex-col gap-5">
                                        <RecoveryProgress plan={recoveryPlan} now={now} />
                                        <Link
                                            href={routes.doctor.fighterRecoveryPlan(recoveryPlan.fighterId, recoveryPlan.id)}
                                            className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary-soft-fg hover:underline"
                                        >
                                            {serviceForms ? "Mở kế hoạch phục hồi — các mốc" : "Mở kế hoạch phục hồi — mốc và lần kiểm tra"}
                                            <ArrowRight aria-hidden className="size-4" />
                                        </Link>
                                    </div>
                                ) : injury.status === "resolved" ? (
                                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                        Chấn thương này không có kế hoạch phục hồi.
                                    </p>
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<RefreshCw />}
                                        title="Chưa có kế hoạch phục hồi"
                                        description={
                                            serviceForms
                                                ? `Lập kế hoạch trở lại của ${firstName} theo các mốc, mỗi mốc có tiêu chí đạt.`
                                                : `Lập kế hoạch trở lại của ${firstName} theo giai đoạn và mốc, theo dõi đau, vận động, sức mạnh mỗi lần kiểm tra.`
                                        }
                                        action={
                                            <ButtonLink href={clinicalLinks.newRecoveryPlanFor(injury.id, fighter.id)} size="sm">
                                                Lập kế hoạch phục hồi
                                            </ButtonLink>
                                        }
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <aside aria-label="Vị trí, giấy phép và quan sát AI" className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Vị trí" icon={<MapPin />} />
                            <CardContent>
                                <RegionModel targets={[{ joint: injury.joint, region: injury.bodyRegion }]} label={`${INJURY_SEVERITY_LABELS[injury.severity]} · ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}`} status={injury.status === "active" ? "ACTIVE" : injury.status === "recovering" ? "RECOVERING" : "RESOLVED"} height={380} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Giấy phép" icon={<ShieldCheck />} description="Cập nhật riêng với hồ sơ chấn thương" />
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex flex-col items-start gap-1.5">
                                    <ClearanceBadge state={clearanceNow} />
                                    <ClearanceValidity clearance={clearance} state={clearanceNow} now={now} warningDays={settings.clearanceExpiryWarningDays} variant="inline" />
                                </div>
                                {clearance && clearance.restrictions.length > 0 && clearanceNow === "restricted" && (
                                    <RestrictionSummary restrictions={clearance.restrictions} />
                                )}
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} variant="secondary" size="sm" className="w-fit">
                                    Cập nhật giấy phép
                                </ButtonLink>
                            </CardContent>
                        </Card>

                        {linkedAlert ? (
                            <section aria-labelledby="linked-observation-heading" className="flex flex-col gap-3">
                                <h2 id="linked-observation-heading" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                                    <Radar aria-hidden className="size-4 text-fg-muted" />
                                    Quan sát AI liên kết
                                </h2>
                                <AINotice audience="doctor" compact />
                                <ObservationSummary
                                    alert={linkedAlert}
                                    source={linkedVideo ? { trainingType: linkedVideo.trainingType, uploadedAt: linkedVideo.uploadedAt } : null}
                                    href={routes.doctor.aiAlert(linkedAlert.id)}
                                />
                            </section>
                        ) : (
                            <Card>
                                <CardHeader title="Quan sát AI" icon={<Radar />} />
                                <CardContent>
                                    <p className="text-sm text-fg-muted">Chưa có quan sát AI nào liên kết với chấn thương này.</p>
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

function detailItems(injury: Injury, now: string, recordedByName: string | null): DescriptionItem[] {
    // The medical service keeps no diagnosis date, mechanism or expected return, so its records skip those rows.
    const serviceRecord = injury.joint !== undefined;
    const items: DescriptionItem[] = [{ label: "Xảy ra", value: <time dateTime={injury.occurredAt}>{formatDateTime(injury.occurredAt)}</time> }];
    if (!serviceRecord) {
        items.push(
            { label: "Chẩn đoán", value: injury.diagnosedAt ? <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt)}</time> : NOT_RECORDED },
            { label: "Cơ chế", value: labelOf(INJURY_MECHANISM_LABELS, injury.mechanism) ?? NOT_RECORDED },
        );
    }

    if (injury.resolvedAt) {
        items.push({ label: "Đã khỏi", value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time> });
        items.push({ label: "Thời gian khỏi", value: `${Math.max(0, daysBetween(injury.occurredAt, injury.resolvedAt))} ngày` });
    } else if (serviceRecord) {
        // No expected return in the service's record; the recovery plan carries it.
    } else if (injury.expectedReturnAt) {
        const days = daysBetween(now, injury.expectedReturnAt);
        items.push({
            label: "Dự kiến trở lại",
            value: (
                <span className="flex flex-col gap-0.5">
                    <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time>
                    <span className={days < 0 ? "text-[13px] font-medium text-warning-fg" : "text-[13px] font-normal text-fg-muted"}>
                        {days < 0 ? `Đã quá mục tiêu ${describeDaysUntil(days)}` : days === 0 ? "Hôm nay" : `Còn ${days} ngày`}
                    </span>
                </span>
            ),
        });
    } else {
        items.push({ label: "Dự kiến trở lại", value: <span className="font-normal text-fg-muted">Cần đánh giá</span> });
    }

    if (!injury.resolvedAt) items.push({ label: "Số ngày từ khi chấn thương", value: `${Math.max(0, daysBetween(injury.occurredAt, now))} ngày` });
    if (recordedByName) items.push({ label: "Người ghi", value: recordedByName });
    return items;
}
