import { Archive, CircleX, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_STATE, CLEARANCE_TYPE, clearanceCardTone, dayDiff, fmtDate } from "@/components/doctor/labels";
import { AvoidList, Empty, FighterFilter, PageHead, Panel, Pill, Restrictions, UI_TONE } from "@/components/doctor/ui";
import { CardLink } from "@/components/dashboard/card-link";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TONE_FILL, TONE_TEXT } from "@/components/ui/tone";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import type { MedicalClearance } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceOverview, listClearances } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.clearance.title") };
}

const COL_TONE = { green: "success", amber: "warning", red: "neutral" } as const;

const isLive = (c: MedicalClearance) => c.status === "active" && c.isCurrentlyValid !== false;

/**
 * Giấy phép: đang hiệu lực lấy từ hồ sơ (`activeClearances`, kèm `isCurrentlyValid`), đã thu hồi/hết hạn dựng lại từ lịch sử
 * MEDICAL_CLEARANCE. Ngưỡng cảnh báo lấy từ cài đặt (API: mặc định 14 ngày vì chưa có `/settings`).
 */
export default async function DoctorClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const scope = fighterId ? [fighterId] : accessibleFighterIds(user);
    const now = new Date().toISOString();
    const [fighters, list, overview, settings] = await Promise.all([listFighters(user), listClearances({ fighterIds: scope }), getClearanceOverview(scope, now), getSettings()]);
    const warn = settings.clearanceExpiryWarningDays;
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const valid = list.filter((c) => isLive(c) && (!c.validUntil || dayDiff(c.validUntil, now) > warn));
    const soon = list.filter((c) => isLive(c) && c.validUntil && dayDiff(c.validUntil, now) <= warn);
    const off = list.filter((c) => !isLive(c));
    const missing = overview.filter((r) => r.state === "none" || r.state === "expired" || r.state === "not_cleared");
    const issueHref = `${routes.doctor.grantClearance}${fighterId ? `?fighter=${fighterId}` : ""}`;

    const col = (title: string, tag: "green" | "amber" | "red", rows: MedicalClearance[], note: string, Icon: typeof ShieldCheck) => (
        <Card role="region" aria-labelledby={`col-${tag}-h`} className="min-w-0 overflow-hidden" data-tag={tag}>
            <CardHeader
                title={<span id={`col-${tag}-h`}>{title}</span>}
                description={note}
                icon={<Icon className={TONE_TEXT[COL_TONE[tag]]} />}
                action={<span className="rounded-md bg-surface-muted px-2 py-0.5 text-[13px] font-semibold text-fg tabular-nums">{rows.length}</span>}
            />
            {rows.length ? (
                <ol className="divide-y divide-border border-t border-border">
                    {rows.map((c) => {
                        const live = isLive(c);
                        const total = c.validUntil ? Date.parse(c.validUntil) - Date.parse(c.issuedAt) : 0;
                        const p = total > 0 ? Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(c.issuedAt)) / total)) : 0;
                        const regions = c.restrictions.flatMap((r) => r.blockedRegions);
                        const tone = live ? clearanceCardTone(c.level) : "neutral";
                        return (
                            <li key={c.id} className="grid min-w-0 gap-2 px-5 py-4 text-[13px] break-words" data-tone={tone}>
                                <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                    <Link href={routes.doctor.fighter(c.fighterId)} className="text-[15px] font-semibold text-fg hover:underline">
                                        {nameOf.get(c.fighterId) ?? t("screens.doctor.fighterFallback")}
                                    </Link>
                                    <Pill tone={tone}>{CLEARANCE_LEVEL[c.level]}</Pill>
                                </header>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                                    <p className={cn("font-semibold", tag === "amber" ? "text-warning-fg" : "text-fg")}>
                                        {c.status === "revoked"
                                            ? t("screens.doctor.clearance.revoked")
                                            : c.status === "superseded"
                                              ? t("screens.doctor.clearance.superseded")
                                              : !live
                                                ? t("screens.doctor.clearance.expired")
                                                : c.validUntil
                                                  ? plural(t, "screens.doctor.clearance.daysLeft", dayDiff(c.validUntil, now))
                                                  : t("screens.doctor.noEndDate")}
                                    </p>
                                    {c.clearanceType && <p>{CLEARANCE_TYPE[c.clearanceType]}</p>}
                                </div>
                                <dl className="grid grid-cols-2 gap-2">
                                    <div>
                                        <dt className="text-xs text-fg-muted">{t("screens.doctor.clearance.from")}</dt>
                                        <dd className="font-semibold text-fg tabular-nums">{fmtDate(c.issuedAt)}</dd>
                                    </div>
                                    <div className="text-end">
                                        <dt className="text-xs text-fg-muted">{t("screens.doctor.clearance.until")}</dt>
                                        <dd className="font-semibold text-fg tabular-nums">{c.validUntil ? fmtDate(c.validUntil) : t("screens.doctor.clearance.noLimit")}</dd>
                                    </div>
                                </dl>
                                {live && total > 0 && (
                                    <div className="h-1 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
                                        <div className={cn("h-full rounded-full", TONE_FILL[UI_TONE[tone]])} style={{ width: `${p * 100}%` }} />
                                    </div>
                                )}
                                {c.revokedReason && (
                                    <Callout tone="danger" icon={CircleX} title={t("screens.doctor.clearance.revokedOn", { date: fmtDate(c.revokedAt) })} className="px-3 py-2.5">
                                        {c.revokedReason}
                                    </Callout>
                                )}
                                {c.reason && <p className="text-fg-muted">{c.reason}</p>}
                                <Restrictions r={c.allowLists ? { ...c.allowLists, notes: null } : null} />
                                {!c.allowLists && regions.length > 0 && <AvoidList items={regions.map((r) => ({ key: r, label: t("screens.doctor.avoid", { region: BODY_REGION[r].toLowerCase() }) }))} />}
                                {live && c.level !== "not_cleared" && (
                                    <div>
                                        <RevokeClearanceButton clearanceId={c.id} fighterId={c.fighterId} fighterName={nameOf.get(c.fighterId) ?? t("screens.doctor.fighterFallbackLower")} emphasis="quiet" className="-ml-3 [@media(pointer:coarse)]:min-h-11" />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <div className="border-t border-border">
                    <Empty compact title={t("screens.doctor.clearance.none")} />
                </div>
            )}
        </Card>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHead
                title={t("doctor.clearance.title")}
                sub={t("screens.doctor.clearance.sub", { n: warn })}
                actions={
                    <ButtonLink href={issueHref}>
                        <ShieldCheck aria-hidden />
                        {t("screens.doctor.issueClearance")}
                    </ButtonLink>
                }
            />
            <FighterFilter base={routes.doctor.clearance} fighters={fighters} current={fighterId} />
            {missing.length > 0 && (
                <Panel title={t("screens.doctor.clearance.missing", { n: missing.length })} id="thieu">
                    <ul className="divide-y divide-border">
                        {missing.map((r) => (
                            <li key={r.fighter.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                    <Link href={routes.doctor.fighter(r.fighter.id)} className="font-semibold text-fg hover:underline">
                                        {r.fighter.name}
                                    </Link>
                                    <Pill tone={CLEARANCE_STATE[r.state].tone}>{CLEARANCE_STATE[r.state].label}</Pill>
                                </span>
                                <CardLink href={`${routes.doctor.grantClearance}?fighter=${r.fighter.id}`}>{t("screens.doctor.issueClearance")}</CardLink>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <div className="grid grid-cols-1 items-start gap-6 min-[1101px]:grid-cols-3">
                {col(t("screens.doctor.clearance.col.valid"), "green", valid, t("screens.doctor.clearance.col.validNote"), ShieldCheck)}
                {col(t("screens.doctor.clearance.col.soon"), "amber", soon, t("screens.doctor.clearance.col.soonNote", { n: warn }), Clock)}
                {col(t("screens.doctor.clearance.col.off"), "red", off, t("screens.doctor.clearance.col.offNote"), Archive)}
            </div>
        </div>
    );
}
