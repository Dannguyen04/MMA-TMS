import { ArrowRight, CircleCheck, CircleX, FilePlus2, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BodyPanel } from "@/components/doctor/body-panel";
import { DECISION_OF, examLabel } from "@/components/doctor/exam-meta";
import { FighterHead } from "@/components/doctor/fighter-head";
import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_TYPE, DECISION, INJURY_STATUS, REQUESTER_ROLE, clearanceBadge, dayDiff, fmtDate, fmtDateTime, injuryName, injuryPlace, jointOf } from "@/components/doctor/labels";
import { Panel, Pill, Restrictions, Vitals } from "@/components/doctor/ui";
import { FlashToast } from "@/components/medical/flash-toast";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import type { ToastInput } from "@/components/ui/toast";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { MedicalClearance } from "@/lib/domain/types";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { loadDoctorRow } from "@/lib/services/doctor-board";
import { getClearanceHistory, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getFighter } from "@/lib/services/people";
import { param } from "@/lib/utils";

type Kind = "injury" | "review" | "expiry" | "followup" | "milestone" | "exam";
const MAG: Record<Kind, number> = { injury: 8, review: 8, expiry: 7, followup: 6, milestone: 5, exam: 5 };
const KL: Record<Kind, string> = { injury: "Chấn thương", review: "Yêu cầu xem xét", expiry: "Giấy phép hết hạn", followup: "Tái khám", milestone: "Mốc phục hồi", exam: "Phiếu khám" };
const SPAN = [-14, 21] as const;
const xp = (d: number) => ((d - SPAN[0]) / (SPAN[1] - SPAN[0])) * 100;
const relDay = (d: number) => (d === 0 ? "Hôm nay" : d > 0 ? `+${d} ngày` : `${d} ngày`);
const RECENT_RESOLVED_DAYS = 180;

const NOTICES: Record<string, ToastInput> = {
    "examination-not-eligible": { title: "Đã lưu phiếu khám", description: "Võ sĩ không đủ điều kiện nên không cấp giấy phép.", tone: "success" },
    "clearance-issued": { title: "Đã cấp giấy phép", tone: "success" },
    "clearance-full": { title: "Đã cấp giấy phép tập đầy đủ", tone: "success" },
    "clearance-restricted": { title: "Đã cấp giấy phép tập có hạn chế", tone: "success" },
    "clearance-not_cleared": { title: "Đã ghi nhận: chưa được tập", tone: "success" },
};

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]">): Promise<Metadata> {
    const { fighterId } = await params;
    const user = await requireRole("doctor");
    const fighter = canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    return { title: fighter ? `${fighter.name} · Hồ sơ y tế` : "Không tìm thấy võ sĩ" };
}

function clearanceExcluded(c: MedicalClearance | null): string[] {
    if (!c) return [];
    return [...(c.allowLists?.excludedJoints ?? []), ...c.restrictions.flatMap((r) => r.blockedRegions.map((region) => jointOf({ bodyRegion: region })))];
}

export default async function DoctorFighterProfilePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]">) {
    const user = await requireRole("doctor");
    const { fighterId } = await params;
    const query = await searchParams;
    const stored = await requireFighterAccess(user, fighterId);
    const now = new Date().toISOString();

    const [row, examinations, injuries, clearances, plans, reviewRequests, observations] = await Promise.all([
        loadDoctorRow(stored),
        listExaminations({ fighterIds: [stored.id] }),
        listInjuries({ fighterIds: [stored.id] }),
        getClearanceHistory(stored.id),
        listRecoveryPlans({ fighterIds: [stored.id] }),
        listReviewRequests(stored.id),
        medicalFeatureAvailable("aiObservations") ? nullIfServiceFails(listAlerts({ fighterIds: [stored.id] })) : Promise.resolve([]),
    ]);
    if (!row) notFound();
    const { fighter, summary, training, competition, dossier, tag } = row;

    // Căn cứ tập luyện: phiếu khám đang quyết định phạm vi tập (API) hoặc phiếu gần nhất (demo).
    const currentTrainingId = dossier?.currentExaminations.TRAINING?.id;
    const basis = (currentTrainingId ? examinations.find((e) => e.id === currentTrainingId) : (summary.latestExamination ?? undefined)) ?? null;
    const withVitals = basis?.vitals ? basis : (examinations.find((e) => e.vitals) ?? null);
    const shownInjuries = injuries.filter((i) => i.status !== "resolved" || (i.resolvedAt && dayDiff(i.resolvedAt, now) >= -RECENT_RESOLVED_DAYS));
    const excluded = [...new Set([...(basis?.decisionRestrictions?.excludedJoints ?? []), ...clearanceExcluded(summary.clearance)])];
    const abnormalHead = !!basis?.assessments.some((a) => a.result !== "normal" && /neuro|thần kinh|thị lực|vision|head|đầu/i.test(a.area));
    const activePlan = summary.activeRecoveryPlan;
    const openReviews = reviewRequests.filter((r) => r.status === "OPEN");

    // Đường trở lại thi đấu, suy ra từ hồ sơ.
    const milestones = activePlan?.plan.milestones ?? [];
    const steps = [
        { key: "baseline", label: "Khám ban đầu", state: summary.needsBaseline ? "blocked" : "done", note: summary.needsBaseline ? "Chưa có" : "Đã có" },
        { key: "injury", label: "Chấn thương", state: summary.activeInjuries.length ? "current" : "skip", note: summary.activeInjuries.length ? `${summary.activeInjuries.length} đang mở` : "Không có" },
        {
            key: "recovery",
            label: "Phục hồi",
            state: activePlan ? "current" : "skip",
            note: activePlan ? (milestones.length ? `${milestones.filter((m) => m.isCompleted).length}/${milestones.length} mốc` : `${activePlan.progressPct}%`) : "Không có kế hoạch",
        },
        { key: "training", label: "Tập luyện", state: training ? (training.eligible ? "done" : "blocked") : "skip", note: training ? (training.eligible ? "Đủ điều kiện" : "Chưa đủ") : "Chưa rõ" },
        ...(competition ? [{ key: "competition", label: "Thi đấu", state: competition.eligible ? "done" : "blocked", note: competition.eligible ? "Đủ điều kiện" : "Chưa đủ" }] : []),
    ];

    // Quỹ đạo 5 tuần.
    const ev: { kind: Kind; day: number; text: string }[] = [];
    summary.activeInjuries.forEach((i) => ev.push({ kind: "injury", day: dayDiff(i.occurredAt, now), text: `${injuryName(i)} · ${injuryPlace(i)}` }));
    openReviews.forEach((r) => ev.push({ kind: "review", day: dayDiff(r.requestedAt, now), text: r.reason }));
    clearances.filter((c) => c.status === "active" && c.validUntil).forEach((c) => ev.push({ kind: "expiry", day: dayDiff(c.validUntil!, now), text: `${c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]} hết hạn` }));
    if (summary.nextFollowUp) ev.push({ kind: "followup", day: summary.nextFollowUp.daysUntil, text: "Tái khám theo phiếu khám" });
    plans.filter((p) => p.status === "active").forEach((p) => (p.milestones ?? []).forEach((m) => !m.isCompleted && m.targetDate && ev.push({ kind: "milestone", day: dayDiff(m.targetDate, now), text: m.title })));
    examinations.forEach((e) => ev.push({ kind: "exam", day: dayDiff(e.date, now), text: examLabel(e) }));
    const events = ev.filter((e) => e.day >= SPAN[0] && e.day <= SPAN[1]).sort((a, b) => a.day - b.day);

    const pathname = routes.doctor.fighter(fighter.id);
    const notice = NOTICES[param(query.notice) ?? ""] ?? null;
    const decision = basis ? (basis.scope ? (dossier?.currentExaminations.TRAINING?.decision ?? DECISION_OF[basis.outcome]) : DECISION_OF[basis.outcome]) : null;

    return (
        <div className="yt-page">
            <FlashToast notice={notice} cleanHref={hrefWith(pathname, query, { notice: null })} />
            <FighterHead
                fighter={fighter}
                training={training}
                competition={competition}
                tag={tag}
                actions={
                    <>
                        <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                            <FilePlus2 aria-hidden />
                            Tạo phiếu khám
                        </Link>
                        <Link href={`${routes.doctor.grantClearance}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                            <ShieldCheck aria-hidden />
                            Cấp giấy phép
                        </Link>
                    </>
                }
            />

            <Panel title="Đường trở lại thi đấu" id="ladder" aside="Suy ra từ hồ sơ y tế">
                <ol className="hs-ladder" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                    {steps.map((s, i) => (
                        <li key={s.key} className="hs-step" data-state={s.state} style={{ ["--i" as string]: i }}>
                            <i aria-hidden />
                            <b>{s.label}</b>
                            <small>{s.note}</small>
                        </li>
                    ))}
                </ol>
            </Panel>

            <div className="hs-grid">
                <Panel title="Bản đồ cơ thể" id="body3d" tone="plate" aside={<span className="yt-drag-hint">Kéo để xoay</span>}>
                    <BodyPanel injuries={shownInjuries} excluded={excluded} height={500} abnormalHead={abnormalHead} />
                </Panel>
                <div className="hs-col">
                    <Panel
                        title={`Chấn thương · ${summary.activeInjuries.length}`}
                        id="chan-thuong"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.injuries}?fighter=${fighter.id}`}>
                                Tất cả <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {shownInjuries.length ? (
                            <ul className="hs-inj">
                                {shownInjuries.map((i) => (
                                    <li key={i.id}>
                                        <Link href={routes.doctor.injury(i.id)}>{injuryName(i)}</Link>
                                        <small>
                                            {injuryPlace(i)} · {fmtDate(i.occurredAt)}
                                        </small>
                                        <Pill tone={INJURY_STATUS[i.status].tone}>{INJURY_STATUS[i.status].label}</Pill>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="yt-muted">Chưa ghi nhận chấn thương nào.</p>
                        )}
                        <p style={{ marginTop: 12 }}>
                            <Link className="yt-go" href={`${routes.doctor.newInjury}?fighter=${fighter.id}`}>
                                Ghi nhận chấn thương <ArrowRight aria-hidden />
                            </Link>
                        </p>
                    </Panel>
                    <Panel
                        title="Căn cứ tập luyện"
                        id="can-cu"
                        aside={
                            basis ? (
                                <Link className="yt-go" href={routes.doctor.examination(basis.id)}>
                                    Phiếu khám <ArrowRight aria-hidden />
                                </Link>
                            ) : undefined
                        }
                    >
                        {basis && decision ? (
                            <>
                                <p className="hs-decision" data-d={decision}>
                                    {decision === "NOT_ELIGIBLE" ? <CircleX aria-hidden /> : decision === "ELIGIBLE" ? <CircleCheck aria-hidden /> : <TriangleAlert aria-hidden />}
                                    {DECISION[decision].label}
                                </p>
                                <p className="hs-basis-meta">
                                    {examLabel(basis)}
                                    {basis.validUntil ? ` · hiệu lực đến ${fmtDate(basis.validUntil)}` : ""}
                                </p>
                                <p>{basis.summary}</p>
                                <Restrictions r={basis.decisionRestrictions} />
                                {!basis.decisionRestrictions && summary.clearance?.restrictions.length ? (
                                    <ul className="yt-chips" style={{ marginTop: 10 }}>
                                        {summary.clearance.restrictions.flatMap((r) => r.blockedRegions).map((b) => (
                                            <li key={b} data-tone="block">
                                                Tránh {BODY_REGION[b].toLowerCase()}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </>
                        ) : (
                            <div className="yt-empty" style={{ padding: 24 }}>
                                <Stethoscope aria-hidden />
                                <p className="yt-empty-t">Chưa có phiếu khám tập luyện</p>
                                <p className="yt-empty-d">Võ sĩ cần phiếu khám ban đầu trước khi được tập.</p>
                                <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                                    Tạo phiếu khám ban đầu
                                </Link>
                            </div>
                        )}
                    </Panel>
                    <Panel title="Chỉ số sinh tồn" id="sinh-hieu" aside={withVitals ? fmtDate(withVitals.date) : undefined}>
                        <Vitals v={withVitals?.vitals} />
                    </Panel>
                </div>
                <div className="hs-col hs-col3">
                    <Panel title="Quỹ đạo 5 tuần" id="quy-dao" aside="−14 → +21 ngày">
                        <div className="tj" aria-hidden>
                            <span className="tj-axis" />
                            <span className="tj-past" />
                            <span className="tj-now" />
                            {[-14, -7, 7, 14, 21].map((t) => (
                                <span key={t} className="tj-tick" style={{ left: `${xp(t)}%` }}>
                                    {t > 0 ? `+${t}` : t}
                                </span>
                            ))}
                            {events.map((e, i) => {
                                const flip = i % 2 === 0;
                                return (
                                    <span
                                        key={i}
                                        className="tj-dot"
                                        data-k={e.kind}
                                        data-up={flip && e.kind === "exam"}
                                        style={{ left: `${xp(e.day)}%`, ["--m" as string]: MAG[e.kind], ["--d" as string]: i * 70 }}
                                        title={`${KL[e.kind]}: ${e.text}`}
                                    />
                                );
                            })}
                        </div>
                        {events.length ? (
                            <ol className="tj-list">
                                {events.map((e, i) => (
                                    <li key={i} data-k={e.kind} data-future={e.day >= 0}>
                                        <time>{relDay(e.day)}</time>
                                        <span>
                                            {KL[e.kind]}
                                            <small>{e.text}</small>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="yt-muted">Không có sự kiện nào trong 5 tuần này.</p>
                        )}
                    </Panel>
                    <Panel
                        title="Giấy phép"
                        id="giay-phep"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.clearance}?fighter=${fighter.id}`}>
                                Tất cả <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {clearances.length ? (
                            <ul className="hs-clr">
                                {clearances.slice(0, 4).map((c) => {
                                    const s = clearanceBadge(c);
                                    const canRevoke = c.status === "active" && c.isCurrentlyValid !== false && c.level !== "not_cleared";
                                    return (
                                        <li key={c.id} data-off={s.label !== "Hiệu lực"}>
                                            <b>{c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]}</b>
                                            <small>
                                                {fmtDate(c.issuedAt)} – {c.validUntil ? fmtDate(c.validUntil) : "không thời hạn"}
                                            </small>
                                            <Pill tone={s.tone}>{s.label}</Pill>
                                            {canRevoke && (
                                                <span style={{ gridColumn: "1 / -1" }}>
                                                    <RevokeClearanceButton clearanceId={c.id} fighterId={fighter.id} fighterName={fighter.name} />
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="yt-muted">Chưa cấp giấy phép nào.</p>
                        )}
                    </Panel>
                    <Panel
                        title={`Yêu cầu xem xét · ${openReviews.length}`}
                        id="yeu-cau"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.reviewRequests}?fighter=${fighter.id}`}>
                                Tất cả <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {openReviews.length ? (
                            <ul className="hs-clr">
                                {openReviews.map((r) => (
                                    <li key={r.id}>
                                        <b>{r.reason}</b>
                                        <small>
                                            {REQUESTER_ROLE[r.requesterRole]} · {fmtDateTime(r.requestedAt)}
                                        </small>
                                        <Pill tone="amber">Đang mở</Pill>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="yt-muted">Không có yêu cầu xem xét đang mở.</p>
                        )}
                    </Panel>
                    {medicalFeatureAvailable("aiObservations") && (
                        <Panel
                            title="Quan sát AI"
                            id="quan-sat"
                            aside={
                                <Link className="yt-go" href={routes.doctor.aiAlerts}>
                                    Tất cả <ArrowRight aria-hidden />
                                </Link>
                            }
                        >
                            {observations === null ? (
                                <p className="yt-muted">MMA Vision chưa trả lời. Phần còn lại của hồ sơ vẫn đầy đủ.</p>
                            ) : observations.length ? (
                                <ul className="hs-clr">
                                    {observations.slice(0, 3).map((a) => (
                                        <li key={a.id}>
                                            <Link href={routes.doctor.aiAlert(a.id)}>
                                                <b>{BODY_REGION[a.bodyRegion]}</b>
                                            </Link>
                                            <small>
                                                Biên độ {a.metric.observed}
                                                {a.metric.unit} so với nền {a.metric.baseline}
                                                {a.metric.unit} · {fmtDate(a.detectedAt)}
                                            </small>
                                            <Pill tone={a.status === "new" ? "blue" : "neutral"}>{a.status === "new" ? "Mới" : "Đã xem"}</Pill>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="yt-muted">Chưa có quan sát nào cho võ sĩ này.</p>
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
