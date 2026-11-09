import { ArrowRight, Ban, Bandage, CircleCheck, ClipboardPlus, Clock, Flag, MessageSquareText, ShieldAlert, ShieldCheck, ShieldX, Siren, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardLink } from "@/components/dashboard/card-link";
import { BODY_REGION, alertRatio, dayDiff, fmeta, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { Gate, Panel, reasonsText } from "@/components/doctor/ui";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TONE_SOFT, TONE_TEXT, type Tone as UiTone } from "@/components/ui/tone";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { loadDoctorBoard, type BoardRow, type Triage } from "@/lib/services/doctor-board";
import { listRecoveryPlans } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.dashboard.title") };
}

const LANES: Triage[] = ["red", "amber", "green"];
const ICON = { review: MessageSquareText, expiry: ShieldAlert, followup: Clock, suspension: Ban } as const;
/** Triage lanes in the app's tones: tone, icon and the lane word together, never colour alone. */
const LANE: Record<Triage, { tone: UiTone; icon: LucideIcon }> = {
    red: { tone: "danger", icon: ShieldX },
    amber: { tone: "warning", icon: TriangleAlert },
    green: { tone: "success", icon: CircleCheck },
};
/** Week events: a soft tone chip with an icon per kind, named in the legend. */
const EVENT = {
    followup: { tone: "info", icon: Clock, label: "screens.doctor.event.followup" },
    expiry: { tone: "warning", icon: ShieldAlert, label: "screens.doctor.event.expiry" },
    milestone: { tone: "success", icon: Flag, label: "screens.doctor.event.milestone" },
    suspension: { tone: "danger", icon: Ban, label: "screens.doctor.event.suspensionEnds" },
} as const satisfies Record<string, { tone: UiTone; icon: LucideIcon; label: MessageKey }>;

function Tag({ r, t }: { r: BoardRow; t: Translator }) {
    const reasons = reasonsText(r.training);
    const isCompact = r.tag === "green" && reasons.length === 0 && r.items.length === 0 && r.summary.activeInjuries.length === 0;
    const meta = fmeta(r.fighter);
    const lane = LANE[r.tag];
    const gates = (r.training || r.competition) && (
        <span className="flex flex-wrap gap-1.5">
            <Gate label={t("screens.doctor.gate.training")} e={r.training} />
            <Gate label={t("screens.doctor.gate.competition")} e={r.competition} />
        </span>
    );
    return (
        <li className="td-tag min-w-0" data-tag={r.tag} data-compact={isCompact ? "true" : undefined}>
            <Link
                href={routes.doctor.fighter(r.fighter.id)}
                className="group block rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <span className={cn("flex min-w-0 gap-x-3 gap-y-2", isCompact ? "flex-wrap items-center" : "items-start")}>
                    <span className="min-w-0 flex-1">
                        <strong className="block truncate text-base font-semibold text-fg">{r.fighter.name}</strong>
                        <small className="block truncate text-[13px] text-fg-muted" title={meta}>
                            {meta}
                        </small>
                    </span>
                    {isCompact ? (
                        gates
                    ) : (
                        <Badge tone={lane.tone} icon={lane.icon}>
                            {t(`screens.doctor.lane.${r.tag}.word`)}
                        </Badge>
                    )}
                    <ArrowRight className="size-4 shrink-0 self-center text-fg-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                </span>
                {!isCompact && gates && <span className="mt-3 block">{gates}</span>}
                {reasons.length > 0 && <span className="mt-2 block text-[13px] font-semibold text-danger-fg">{reasons.join(" · ")}</span>}
                {r.items.length > 0 && (
                    <ul className="mt-2 grid gap-1.5">
                        {r.items.map((x, k) => {
                            const I = ICON[x.kind];
                            return (
                                <li key={x.kind + k} data-k={x.kind} className="flex gap-2 text-[13px] text-fg">
                                    <I aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", x.kind === "suspension" ? "text-danger-fg" : x.kind === "review" ? "text-warning-fg" : "text-fg-muted")} />
                                    {x.kind === "review" ? t("screens.doctor.dashboard.reviewItem", { text: x.text }) : x.text}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {r.summary.activeInjuries.map((j) => (
                    <span key={j.id} className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted">
                        <Bandage aria-hidden className={cn("size-3.5 shrink-0", j.status === "recovering" ? "text-info-fg" : "text-danger-fg")} />
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
        <div className="workspace-editorial">
            <PageHeader
                eyebrow={todayText}
                title={t("doctor.dashboard.title")}
                description={plural(t, "screens.doctor.assignedCount", rows.length)}
                actions={
                    <>
                        <ButtonLink href={routes.doctor.grantClearance} variant="secondary">
                            <ShieldCheck aria-hidden />
                            {t("screens.doctor.issueClearance")}
                        </ButtonLink>
                        <ButtonLink href={routes.doctor.newExamination}>
                            <ClipboardPlus aria-hidden />
                            {t("screens.doctor.newExamination")}
                        </ButtonLink>
                    </>
                }
                meta={
                    <ol className="flex flex-wrap gap-2" aria-label={t("screens.doctor.dashboard.tally")}>
                        {LANES.map((l) => (
                            <li key={l}>
                                <Badge tone={LANE[l].tone} icon={LANE[l].icon}>
                                    <b className="font-semibold tabular-nums">{rows.filter((r) => r.tag === l).length}</b> {t(`screens.doctor.lane.${l}.word`)}
                                </Badge>
                            </li>
                        ))}
                    </ol>
                }
            />
            {(blocked.length > 0 || reviewCount > 0) && (
                <Callout
                    className="mb-6"
                    tone="danger"
                    icon={Siren}
                    title={
                        <span className="font-normal">
                            {blocked.length > 0 && reviewCount > 0 && (
                                <>
                                    <b className="font-semibold">{blockedText}</b> {t("screens.doctor.dashboard.urgent.and")} <b className="font-semibold">{reviewsText}</b>{" "}
                                    {t("screens.doctor.dashboard.urgent.waiting")} {t("screens.doctor.dashboard.urgent.handleRed")}
                                </>
                            )}
                            {blocked.length > 0 && reviewCount === 0 && (
                                <>
                                    <b className="font-semibold">{blockedText}</b>. {t("screens.doctor.dashboard.urgent.handleRed")}
                                </>
                            )}
                            {blocked.length === 0 && reviewCount > 0 && (
                                <>
                                    <b className="font-semibold">{reviewsText}</b> {t("screens.doctor.dashboard.urgent.waiting")}
                                </>
                            )}
                        </span>
                    }
                    action={
                        reviewCount > 0 ? (
                            <ButtonLink href={routes.doctor.reviewRequests} variant="secondary" size="sm">
                                {t("screens.doctor.dashboard.openRequests")} <ArrowRight aria-hidden />
                            </ButtonLink>
                        ) : (
                            <ButtonLink href="#ln-red" variant="secondary" size="sm">
                                {t("screens.doctor.dashboard.seeRed")} <ArrowRight aria-hidden />
                            </ButtonLink>
                        )
                    }
                />
            )}
            {rows.length === 0 ? (
                <Card className="p-5">
                    <p className="text-sm text-fg-muted">{t("screens.doctor.dashboard.noFighters")}</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {LANES.map((l) => {
                        const rs = rows.filter((r) => r.tag === l);
                        const Icon = LANE[l].icon;
                        return (
                            <section key={l} className="min-w-0" data-tag={l} aria-labelledby={`ln-${l}`}>
                                <header className="mb-3 flex items-start gap-2.5 border-b border-border pb-3">
                                    <Icon aria-hidden className={cn("mt-1 size-[18px] shrink-0", TONE_TEXT[LANE[l].tone])} strokeWidth={2.25} />
                                    <div className="min-w-0 flex-1">
                                        <h2 id={`ln-${l}`} className="scroll-mt-20 text-[21px] leading-tight font-bold tracking-[-0.01em] text-fg [font-family:var(--workspace-editorial-font)]">
                                            {t(`screens.doctor.lane.${l}.title`)}
                                        </h2>
                                        <p className="mt-0.5 text-[13px] text-fg-muted">{t(`screens.doctor.lane.${l}.sub`)}</p>
                                    </div>
                                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[13px] font-semibold text-fg tabular-nums">{rs.length}</span>
                                </header>
                                {rs.length ? (
                                    <ol className="grid gap-3">
                                        {rs.map((r) => (
                                            <Tag key={r.fighter.id} r={r} t={t} />
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="grid gap-1 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-fg-muted">
                                        <b className="font-semibold text-fg">{t("screens.doctor.dashboard.laneEmpty")}</b>
                                        {t(`screens.doctor.lane.${l}.empty`)}
                                    </p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
            <div className="mt-8 grid grid-cols-1 items-start gap-6">
                <Panel title={t("screens.doctor.dashboard.week")} id="week" aside={<CardLink href={routes.doctor.recovery}>{t("screens.doctor.dashboard.recoveryPlans")}</CardLink>}>
                    <ol className="td-week grid grid-cols-1 gap-2 md:grid-cols-7">
                        {days.map((d) => (
                            <li
                                key={d.d}
                                className={cn(
                                    "td-day flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2.5 md:min-h-32 md:flex-col md:flex-nowrap md:items-stretch md:px-2 md:pt-2.5 md:pb-3",
                                    d.d === 0 ? "bg-surface-muted" : "bg-surface",
                                    d.ev.length === 0 && "max-md:hidden",
                                )}
                                data-today={d.d === 0}
                                data-empty={d.ev.length === 0 ? "true" : undefined}
                            >
                                <header className={cn("flex min-w-24 items-baseline gap-2 text-xs md:min-w-0 md:justify-between", d.d === 0 ? "font-semibold text-fg" : "text-fg-muted")}>
                                    <span>{d.d === 0 ? t("screens.doctor.today") : wd.format(d.date)}</span>
                                    <span className="text-xl leading-none font-bold text-fg tabular-nums">{dd.format(d.date)}</span>
                                </header>
                                {d.d === 0 && d.ev.length === 0 && <span className="text-xs text-fg-muted">{t("screens.doctor.dashboard.nothingToday")}</span>}
                                {d.ev.map((e, i) => {
                                    const k = EVENT[e.k as keyof typeof EVENT] ?? EVENT.followup;
                                    const KIcon = k.icon;
                                    return (
                                        <span
                                            key={i}
                                            className={cn("td-ev block min-w-0 rounded-md px-2 py-1 text-xs leading-snug text-fg ring-1 ring-inset [&_b]:font-semibold", TONE_SOFT[k.tone])}
                                            data-k={e.k}
                                            title={`${e.who} · ${e.text}`}
                                        >
                                            <KIcon aria-hidden className={cn("mr-1 inline size-3.5 align-[-2px]", TONE_TEXT[k.tone])} strokeWidth={2.25} />
                                            <b>{e.who}</b> <span className="line-clamp-2 break-words">{e.text}</span>
                                        </span>
                                    );
                                })}
                            </li>
                        ))}
                    </ol>
                    {days.every((d) => d.ev.length === 0) && <p className="py-3 text-sm text-fg-muted md:hidden">{t("screens.doctor.dashboard.weekEmpty")}</p>}
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-fg-muted">
                        {(["followup", "expiry", "milestone", "suspension"] as const).map((k) => {
                            const E = EVENT[k];
                            const EIcon = E.icon;
                            return (
                                <li key={k} className="inline-flex items-center gap-1.5">
                                    <EIcon aria-hidden className={cn("size-3.5", TONE_TEXT[E.tone])} strokeWidth={2.25} />
                                    {t(E.label)}
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
                {showAi && (
                    <Panel title={t("screens.doctor.dashboard.aiTitle")} id="ai" aside={<CardLink href={routes.doctor.aiAlerts}>{t("screens.doctor.all")}</CardLink>}>
                        {!board.alertsAvailable ? (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.dashboard.aiUnavailable")}</p>
                        ) : recent.length ? (
                            <ul className="divide-y divide-border">
                                {recent.map((a) => {
                                    const ratio = alertRatio(a.metric);
                                    const who = rows.find((r) => r.fighter.id === a.fighterId)?.fighter.name ?? t("screens.doctor.dashboard.aiUnassigned");
                                    return (
                                        <li key={a.id} className="relative flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                            <span aria-hidden className="w-11 shrink-0 rounded-md bg-danger-soft py-1 text-center text-[13px] font-semibold text-danger-fg tabular-nums">
                                                {Math.round(ratio * 100)}
                                            </span>
                                            <span className="min-w-0">
                                                <Link href={routes.doctor.aiAlert(a.id)} className="font-medium text-fg after:absolute after:inset-0 after:content-[''] hover:underline">
                                                    {who} · {BODY_REGION[a.bodyRegion]}
                                                </Link>
                                                <small className="block text-[13px] text-fg-muted">{t("screens.doctor.dashboard.aiRatio", { pct: Math.round(ratio * 100), date: fmtDate(a.detectedAt) })}</small>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.dashboard.aiNone")}</p>
                        )}
                    </Panel>
                )}
            </div>
        </div>
    );
}
