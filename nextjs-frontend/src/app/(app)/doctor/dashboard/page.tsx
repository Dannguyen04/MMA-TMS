import { ArrowRight, ClipboardPlus, Clock, MessageSquareText, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BODY_REGION, alertRatio, dayDiff, fmeta, fmtDate, injuryName, injuryPlace, todayLabel } from "@/components/doctor/labels";
import { Gate, Panel, reasonsText } from "@/components/doctor/ui";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { loadDoctorBoard, type BoardRow, type Triage } from "@/lib/services/doctor-board";
import { listRecoveryPlans } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";

export const metadata: Metadata = { title: "Hôm nay" };

const LANES: { key: Triage; title: string; sub: string; empty: string }[] = [
    { key: "red", title: "Đỏ · Chặn", sub: "Chưa đủ điều kiện tập", empty: "Không ai bị chặn tập hôm nay." },
    { key: "amber", title: "Vàng · Theo dõi", sub: "Tập được, có hạn chế hoặc việc mở", empty: "Không có võ sĩ cần theo dõi." },
    { key: "green", title: "Xanh · Thông", sub: "Đủ điều kiện, không việc mở", empty: "Chưa có võ sĩ nào thông hoàn toàn. Khi một võ sĩ đủ điều kiện và không còn việc mở, thẻ sẽ chuyển sang đây." },
];
const ICON = { review: MessageSquareText, expiry: ShieldAlert, followup: Clock } as const;

function Tag({ r, i, lane }: { r: BoardRow; i: number; lane: number }) {
    const reasons = reasonsText(r.training);
    return (
        <li className="td-tag" data-tag={r.tag} style={{ ["--i" as string]: i, ["--lane" as string]: lane }}>
            <Link href={routes.doctor.fighter(r.fighter.id)}>
                <span className="td-field">
                    <span className="yt-hole" aria-hidden />
                    <span>
                        <strong>{r.fighter.name}</strong>
                        <small>{fmeta(r.fighter)}</small>
                    </span>
                </span>
                {(r.training || r.competition) && (
                    <span className="td-gates">
                        <Gate label="Tập luyện" e={r.training} />
                        <Gate label="Thi đấu" e={r.competition} />
                    </span>
                )}
                {reasons.length > 0 && <span className="td-why">{reasons.join(" · ")}</span>}
                {r.items.length > 0 && (
                    <ul className="td-items">
                        {r.items.map((x, k) => {
                            const I = ICON[x.kind];
                            return (
                                <li key={x.kind + k} data-k={x.kind}>
                                    <I aria-hidden />
                                    {x.kind === "review" ? `Yêu cầu xem xét: ${x.text}` : x.text}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {r.summary.activeInjuries.map((j) => (
                    <span key={j.id} className="td-inj">
                        <i data-s={j.status.toUpperCase()} aria-hidden />
                        {injuryName(j)} · {injuryPlace(j)}
                    </span>
                ))}
                <span className="td-open">
                    Mở hồ sơ <ArrowRight aria-hidden />
                </span>
            </Link>
        </li>
    );
}

/**
 * Hôm nay: ai cần bác sĩ trước. Suy ra từ hồ sơ từng võ sĩ (không có endpoint tổng hợp cho bác sĩ):
 * đỏ khi chưa đủ điều kiện tập, vàng khi có giới hạn, chấn thương hoặc việc mở, còn lại xanh.
 */
export default async function DoctorDashboardPage() {
    const user = await requireRole("doctor");
    const scope = accessibleFighterIds(user);
    const [board, plans] = await Promise.all([loadDoctorBoard(user), listRecoveryPlans({ fighterIds: scope, status: "active" })]);
    const { rows, now } = board;
    const blocked = rows.filter((r) => r.tag === "red");
    const reviewCount = board.counts.reviews;
    const nameOf = new Map(rows.map((r) => [r.fighter.id, r.fighter.name.split(" ").at(-1) ?? r.fighter.name]));

    const days = Array.from({ length: 7 }, (_, d) => ({ d, date: new Date(Date.parse(now) + d * 86_400_000), ev: [] as { k: string; who: string; text: string }[] }));
    const put = (iso: string | null | undefined, k: string, fighterId: string, text: string) => {
        if (!iso) return;
        const d = dayDiff(iso, now);
        if (d >= 0 && d < 7) days[d]!.ev.push({ k, who: nameOf.get(fighterId) ?? "", text });
    };
    for (const r of rows) for (const x of r.items) if (x.kind !== "review") put(x.date, x.kind, r.fighter.id, x.kind === "expiry" ? "Giấy phép hết hạn" : "Tái khám");
    for (const p of plans) {
        for (const m of p.milestones ?? []) if (!m.isCompleted) put(m.targetDate, "milestone", p.fighterId, m.title);
        for (const ph of p.phases) if (ph.status !== "completed") put(ph.endDate, "milestone", p.fighterId, ph.name);
    }
    const wd = new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" });
    const dd = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
    const recent = board.alerts.slice(0, 3);
    const showAi = medicalFeatureAvailable("aiObservations");

    return (
        <div className="yt-page">
            <header className="yt-head td-head" data-shot="head">
                <div className="yt-head-main">
                    <h1>Phân loại hôm nay</h1>
                    <p className="yt-head-sub">
                        {todayLabel(now)} · {rows.length} võ sĩ được giao
                    </p>
                </div>
                <ol className="td-tally" aria-label="Số võ sĩ theo màu thẻ">
                    {LANES.map((l, i) => (
                        <li key={l.key} data-tag={l.key} style={{ ["--i" as string]: i }}>
                            <b>{rows.filter((r) => r.tag === l.key).length}</b>
                            {l.title.split(" · ")[1]}
                        </li>
                    ))}
                </ol>
            </header>
            <div className="yt-head-actions">
                <Link href={routes.doctor.newExamination} className="yt-btn" data-v="primary">
                    <ClipboardPlus aria-hidden />
                    Tạo phiếu khám
                </Link>
                <Link href={routes.doctor.grantClearance} className="yt-btn">
                    <ShieldCheck aria-hidden />
                    Cấp giấy phép
                </Link>
            </div>
            {(blocked.length > 0 || reviewCount > 0) && (
                <div className="td-urgent" data-shot="urgent">
                    <Siren aria-hidden />
                    <p>
                        <b>{blocked.length} võ sĩ bị chặn tập</b> và <b>{reviewCount} yêu cầu xem xét</b> đang chờ. Xử lý thẻ đỏ trước buổi tập.
                    </p>
                    <Link href={routes.doctor.reviewRequests}>
                        Mở yêu cầu <ArrowRight aria-hidden />
                    </Link>
                </div>
            )}
            {rows.length === 0 ? (
                <Panel>
                    <p className="yt-muted">Bạn chưa được giao võ sĩ nào. Khi quản trị viên giao võ sĩ, thẻ phân loại sẽ hiện ở đây.</p>
                </Panel>
            ) : (
                <div className="td-lanes" data-shot="lanes">
                    {LANES.map((l, li) => {
                        const rs = rows.filter((r) => r.tag === l.key);
                        return (
                            <section key={l.key} className="td-lane" data-tag={l.key} aria-labelledby={`ln-${l.key}`}>
                                <header>
                                    <h2 id={`ln-${l.key}`}>{l.title}</h2>
                                    <p>{l.sub}</p>
                                </header>
                                {rs.length ? (
                                    <ol>
                                        {rs.map((r, i) => (
                                            <Tag key={r.fighter.id} r={r} i={i} lane={li} />
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="td-lane-empty">
                                        <b>Trống</b>
                                        {l.empty}
                                    </p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
            <div className="td-below">
                <Panel
                    title="7 ngày tới"
                    id="week"
                    aside={
                        <Link className="yt-go" href={routes.doctor.recovery}>
                            Kế hoạch phục hồi <ArrowRight aria-hidden />
                        </Link>
                    }
                >
                    <ol className="td-week">
                        {days.map((d) => (
                            <li key={d.d} className="td-day" data-today={d.d === 0}>
                                <header>
                                    <span>{d.d === 0 ? "Hôm nay" : wd.format(d.date)}</span>
                                    <b>{dd.format(d.date)}</b>
                                </header>
                                {d.ev.map((e, i) => (
                                    <span key={i} className="td-ev" data-k={e.k}>
                                        <b>{e.who}</b>
                                        {e.text}
                                    </span>
                                ))}
                            </li>
                        ))}
                    </ol>
                    <p className="td-weeklegend">
                        <span style={{ ["--k" as string]: "var(--blue)" }}>
                            <i />
                            Tái khám
                        </span>
                        <span style={{ ["--k" as string]: "var(--amb)" }}>
                            <i />
                            Giấy phép hết hạn
                        </span>
                        <span style={{ ["--k" as string]: "var(--grn)" }}>
                            <i />
                            Mốc phục hồi
                        </span>
                    </p>
                </Panel>
                {showAi && (
                    <Panel
                        title="Quan sát AI mới"
                        id="ai"
                        aside={
                            <Link className="yt-go" href={routes.doctor.aiAlerts}>
                                Tất cả <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {!board.alertsAvailable ? (
                            <p className="yt-muted">Chưa đọc được quan sát từ MMA Vision. Thử tải lại trang sau ít phút.</p>
                        ) : recent.length ? (
                            <ul className="td-alerts">
                                {recent.map((a) => {
                                    const ratio = alertRatio(a.metric);
                                    const who = rows.find((r) => r.fighter.id === a.fighterId)?.fighter.name ?? "Võ sĩ chưa gán";
                                    return (
                                        <li key={a.id}>
                                            <span className="td-rom" style={{ ["--r" as string]: ratio }} aria-hidden>
                                                <span>{Math.round(ratio * 100)}</span>
                                            </span>
                                            <span>
                                                <Link href={routes.doctor.aiAlert(a.id)}>
                                                    <b>
                                                        {who} · {BODY_REGION[a.bodyRegion]}
                                                    </b>
                                                </Link>
                                                <small>
                                                    Đạt {Math.round(ratio * 100)}% mức nền · {fmtDate(a.detectedAt)}
                                                </small>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="yt-muted">Không có cảnh báo mới từ MMA Vision.</p>
                        )}
                    </Panel>
                )}
            </div>
        </div>
    );
}
