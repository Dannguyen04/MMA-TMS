import { ArrowRight, Ban, ClipboardPlus, Clock, MessageSquareText, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BODY_REGION, alertRatio, dayDiff, fmeta, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { Gate, Panel, reasonsText } from "@/components/doctor/ui";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { loadDoctorBoard, type BoardRow, type Triage } from "@/lib/services/doctor-board";
import { listRecoveryPlans } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.dashboard.title") };
}

const LANES: Triage[] = ["red", "amber", "green"];
const ICON = { review: MessageSquareText, expiry: ShieldAlert, followup: Clock, suspension: Ban } as const;

function Tag({ r, i, lane, t }: { r: BoardRow; i: number; lane: number; t: Translator }) {
    const reasons = reasonsText(r.training);
    const isCompact = r.tag === "green" && reasons.length === 0 && r.items.length === 0 && r.summary.activeInjuries.length === 0;
    const meta = fmeta(r.fighter);
    const gates = (r.training || r.competition) && (
        <span className="td-gates">
            <Gate label={t("screens.doctor.gate.training")} e={r.training} />
            <Gate label={t("screens.doctor.gate.competition")} e={r.competition} />
        </span>
    );
    return (
        <li className="td-tag" data-tag={r.tag} data-compact={isCompact ? "true" : undefined} style={{ ["--i" as string]: i, ["--lane" as string]: lane }}>
            <Link href={routes.doctor.fighter(r.fighter.id)}>
                <span className="td-field">
                    <span>
                        <strong>{r.fighter.name}</strong>
                        <small title={meta}>{meta}</small>
                    </span>
                    {isCompact && gates}
                    <ArrowRight className="td-arrow" aria-hidden />
                </span>
                {!isCompact && gates}
                {reasons.length > 0 && <span className="td-why">{reasons.join(" · ")}</span>}
                {r.items.length > 0 && (
                    <ul className="td-items">
                        {r.items.map((x, k) => {
                            const I = ICON[x.kind];
                            return (
                                <li key={x.kind + k} data-k={x.kind}>
                                    <I aria-hidden />
                                    {x.kind === "review" ? t("screens.doctor.dashboard.reviewItem", { text: x.text }) : x.text}
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
            </Link>
        </li>
    );
}

/**
 * Hôm nay: ai cần bác sĩ trước. Suy ra từ hồ sơ từng võ sĩ (không có endpoint tổng hợp cho bác sĩ):
 * đỏ khi chưa đủ điều kiện tập, vàng khi có giới hạn, chấn thương hoặc việc mở, còn lại xanh.
 */
export default async function DoctorDashboardPage() {
    const { t, locale } = await getTranslator();
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
    for (const r of rows) {
        for (const x of r.items) {
            if (x.kind !== "review") {
                const label = t(
                    x.kind === "expiry"
                        ? "screens.doctor.event.expiry"
                        : x.kind === "followup"
                          ? "screens.doctor.event.followup"
                          : x.graded
                            ? "screens.doctor.event.gradedReturnEnds"
                            : "screens.doctor.event.suspensionEnds",
                );
                put(x.date, x.kind, r.fighter.id, label);
            }
        }
    }
    for (const p of plans) {
        for (const m of p.milestones ?? []) if (!m.isCompleted) put(m.targetDate, "milestone", p.fighterId, m.title);
        for (const ph of p.phases) if (ph.status !== "completed") put(ph.endDate, "milestone", p.fighterId, ph.name);
    }
    const wd = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" });
    const dd = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
    // Như todayLabel của labels.ts (thứ, dd/mm/yyyy, viết hoa chữ đầu) nhưng theo ngôn ngữ người xem.
    const today = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(now));
    const todayText = today.charAt(0).toUpperCase() + today.slice(1);
    const recent = board.alerts.slice(0, 3);
    const blockedText = plural(t, "screens.doctor.dashboard.urgent.blocked", blocked.length);
    const reviewsText = plural(t, "screens.doctor.dashboard.urgent.reviews", reviewCount);
    const showAi = medicalFeatureAvailable("aiObservations");

    return (
        <div className="yt-page workspace-editorial">
            <header className="yt-head td-head" data-shot="head">
                <div className="yt-head-main">
                    <h1>{t("doctor.dashboard.title")}</h1>
                    <p className="yt-head-sub">
                        {todayText} · {plural(t, "screens.doctor.assignedCount", rows.length)}
                    </p>
                </div>
                <ol className="td-tally" aria-label={t("screens.doctor.dashboard.tally")}>
                    {LANES.map((l, i) => (
                        <li key={l} data-tag={l} style={{ ["--i" as string]: i }}>
                            <b>{rows.filter((r) => r.tag === l).length}</b>
                            {t(`screens.doctor.lane.${l}.word`)}
                        </li>
                    ))}
                </ol>
            </header>
            <div className="yt-head-actions">
                <Link href={routes.doctor.newExamination} className="yt-btn" data-v="primary">
                    <ClipboardPlus aria-hidden />
                    {t("screens.doctor.newExamination")}
                </Link>
                <Link href={routes.doctor.grantClearance} className="yt-btn">
                    <ShieldCheck aria-hidden />
                    {t("screens.doctor.issueClearance")}
                </Link>
            </div>
            {(blocked.length > 0 || reviewCount > 0) && (
                <div className="td-urgent" data-shot="urgent">
                    <Siren aria-hidden />
                    <p>
                        {blocked.length > 0 && reviewCount > 0 && (
                            <>
                                <b>{blockedText}</b> {t("screens.doctor.dashboard.urgent.and")} <b>{reviewsText}</b> {t("screens.doctor.dashboard.urgent.waiting")}{" "}
                                {t("screens.doctor.dashboard.urgent.handleRed")}
                            </>
                        )}
                        {blocked.length > 0 && reviewCount === 0 && (
                            <>
                                <b>{blockedText}</b>. {t("screens.doctor.dashboard.urgent.handleRed")}
                            </>
                        )}
                        {blocked.length === 0 && reviewCount > 0 && (
                            <>
                                <b>{reviewsText}</b> {t("screens.doctor.dashboard.urgent.waiting")}
                            </>
                        )}
                    </p>
                    {reviewCount > 0 ? (
                        <Link href={routes.doctor.reviewRequests}>
                            {t("screens.doctor.dashboard.openRequests")} <ArrowRight aria-hidden />
                        </Link>
                    ) : (
                        <Link href="#ln-red">
                            {t("screens.doctor.dashboard.seeRed")} <ArrowRight aria-hidden />
                        </Link>
                    )}
                </div>
            )}
            {rows.length === 0 ? (
                <Panel>
                    <p className="yt-muted">{t("screens.doctor.dashboard.noFighters")}</p>
                </Panel>
            ) : (
                <div className="td-lanes" data-shot="lanes">
                    {LANES.map((l, li) => {
                        const rs = rows.filter((r) => r.tag === l);
                        return (
                            <section key={l} className="td-lane" data-tag={l} aria-labelledby={`ln-${l}`}>
                                <header>
                                    <h2 id={`ln-${l}`}>{t(`screens.doctor.lane.${l}.title`)}</h2>
                                    <p>{t(`screens.doctor.lane.${l}.sub`)}</p>
                                </header>
                                {rs.length ? (
                                    <ol>
                                        {rs.map((r, i) => (
                                            <Tag key={r.fighter.id} r={r} i={i} lane={li} t={t} />
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="td-lane-empty">
                                        <b>{t("screens.doctor.dashboard.laneEmpty")}</b>
                                        {t(`screens.doctor.lane.${l}.empty`)}
                                    </p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
            <div className="td-below">
                <Panel
                    title={t("screens.doctor.dashboard.week")}
                    id="week"
                    aside={
                        <Link className="yt-go" href={routes.doctor.recovery}>
                            {t("screens.doctor.dashboard.recoveryPlans")} <ArrowRight aria-hidden />
                        </Link>
                    }
                >
                    <ol className="td-week">
                        {days.map((d) => (
                            <li key={d.d} className="td-day" data-today={d.d === 0} data-empty={d.ev.length === 0 ? "true" : undefined}>
                                <header>
                                    <span>{d.d === 0 ? t("screens.doctor.today") : wd.format(d.date)}</span>
                                    <b>{dd.format(d.date)}</b>
                                </header>
                                {d.d === 0 && d.ev.length === 0 && <span className="td-day-empty">{t("screens.doctor.dashboard.nothingToday")}</span>}
                                {d.ev.map((e, i) => (
                                    <span key={i} className="td-ev" data-k={e.k} title={`${e.who} · ${e.text}`}>
                                        <b>{e.who}</b>
                                        <span className="td-ev-text">{e.text}</span>
                                    </span>
                                ))}
                            </li>
                        ))}
                    </ol>
                    {days.every((d) => d.ev.length === 0) && (
                        <p className="td-week-empty">{t("screens.doctor.dashboard.weekEmpty")}</p>
                    )}
                    <p className="td-weeklegend">
                        <span style={{ ["--k" as string]: "var(--blue)" }}>
                            <i />
                            {t("screens.doctor.event.followup")}
                        </span>
                        <span style={{ ["--k" as string]: "var(--amb)" }}>
                            <i />
                            {t("screens.doctor.event.expiry")}
                        </span>
                        <span style={{ ["--k" as string]: "var(--grn)" }}>
                            <i />
                            {t("screens.doctor.event.milestone")}
                        </span>
                        <span style={{ ["--k" as string]: "var(--red)" }}>
                            <i />
                            {t("screens.doctor.event.suspensionEnds")}
                        </span>
                    </p>
                </Panel>
                {showAi && (
                    <Panel
                        title={t("screens.doctor.dashboard.aiTitle")}
                        id="ai"
                        aside={
                            <Link className="yt-go" href={routes.doctor.aiAlerts}>
                                {t("screens.doctor.all")} <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {!board.alertsAvailable ? (
                            <p className="yt-muted">{t("screens.doctor.dashboard.aiUnavailable")}</p>
                        ) : recent.length ? (
                            <ul className="td-alerts">
                                {recent.map((a) => {
                                    const ratio = alertRatio(a.metric);
                                    const who = rows.find((r) => r.fighter.id === a.fighterId)?.fighter.name ?? t("screens.doctor.dashboard.aiUnassigned");
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
                                                <small>{t("screens.doctor.dashboard.aiRatio", { pct: Math.round(ratio * 100), date: fmtDate(a.detectedAt) })}</small>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.dashboard.aiNone")}</p>
                        )}
                    </Panel>
                )}
            </div>
        </div>
    );
}
