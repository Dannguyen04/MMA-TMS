import { Archive, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_STATE, CLEARANCE_TYPE, clearanceCardTone, dayDiff, fmtDate } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Panel, Pill, Restrictions } from "@/components/doctor/ui";
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
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.clearance.title") };
}

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
        <section className="gp-col" data-tag={tag} data-shot={`col-${tag}`}>
            <h2>
                <Icon aria-hidden />
                <span>{title}<small>{note}</small></span>
                <span className="gp-count">{rows.length}</span>
            </h2>
            {rows.length ? (
                <ol>
                    {rows.map((c) => {
                        const live = isLive(c);
                        const total = c.validUntil ? Date.parse(c.validUntil) - Date.parse(c.issuedAt) : 0;
                        const p = total > 0 ? Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(c.issuedAt)) / total)) : 0;
                        const regions = c.restrictions.flatMap((r) => r.blockedRegions);
                        const tone = live ? clearanceCardTone(c.level) : "neutral";
                        return (
                            <li key={c.id} className="gp-card" data-tone={tone}>
                                <header>
                                    <Link href={routes.doctor.fighter(c.fighterId)} className="yt-rowlink">
                                        <b>{nameOf.get(c.fighterId) ?? t("screens.doctor.fighterFallback")}</b>
                                    </Link>
                                    <Pill tone={tone}>{CLEARANCE_LEVEL[c.level]}</Pill>
                                </header>
                                <div className="gp-body">
                                    <div className="gp-meta">
                                        <p className="gp-status">
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
                                    <dl className="gp-dates">
                                        <div>
                                            <dt>{t("screens.doctor.clearance.from")}</dt>
                                            <dd>{fmtDate(c.issuedAt)}</dd>
                                        </div>
                                        <div>
                                            <dt>{t("screens.doctor.clearance.until")}</dt>
                                            <dd>{c.validUntil ? fmtDate(c.validUntil) : t("screens.doctor.clearance.noLimit")}</dd>
                                        </div>
                                    </dl>
                                    {live && total > 0 && (
                                        <div className="gp-meter" style={{ ["--p" as string]: p }} aria-hidden>
                                            <i />
                                        </div>
                                    )}
                                    {c.revokedReason && (
                                        <p className="gp-revoked">
                                            <strong>{t("screens.doctor.clearance.revokedOn", { date: fmtDate(c.revokedAt) })}</strong>
                                            {c.revokedReason}
                                        </p>
                                    )}
                                    {c.reason && <p className="gp-reason">{c.reason}</p>}
                                    <Restrictions r={c.allowLists ? { ...c.allowLists, notes: null } : null} />
                                    {!c.allowLists && regions.length > 0 && (
                                        <ul className="yt-chips">
                                            {regions.map((r) => (
                                                <li key={r} data-tone="block">
                                                    {t("screens.doctor.avoid", { region: BODY_REGION[r].toLowerCase() })}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {live && c.level !== "not_cleared" && (
                                        <div>
                                            <RevokeClearanceButton clearanceId={c.id} fighterId={c.fighterId} fighterName={nameOf.get(c.fighterId) ?? t("screens.doctor.fighterFallbackLower")} emphasis="quiet" className="gp-revoke-action" />
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <Empty title={t("screens.doctor.clearance.none")} />
            )}
        </section>
    );

    return (
        <div className="yt-page gp-page">
            <PageHead
                title={t("doctor.clearance.title")}
                sub={t("screens.doctor.clearance.sub", { n: warn })}
                actions={
                    <Link href={issueHref} className="yt-btn" data-v="primary">
                        <ShieldCheck aria-hidden />
                        {t("screens.doctor.issueClearance")}
                    </Link>
                }
            />
            <FighterFilter base={routes.doctor.clearance} fighters={fighters} current={fighterId} />
            {missing.length > 0 && (
                <Panel title={t("screens.doctor.clearance.missing", { n: missing.length })} id="thieu">
                    <ul className="hs-clr">
                        {missing.map((r) => (
                            <li key={r.fighter.id}>
                                <Link href={routes.doctor.fighter(r.fighter.id)} className="yt-rowlink">
                                    <b>{r.fighter.name}</b>
                                </Link>
                                <small>
                                    <Link className="yt-go" href={`${routes.doctor.grantClearance}?fighter=${r.fighter.id}`}>
                                        {t("screens.doctor.issueClearance")}
                                    </Link>
                                </small>
                                <Pill tone={CLEARANCE_STATE[r.state].tone}>{CLEARANCE_STATE[r.state].label}</Pill>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <div className="gp-cols">
                {col(t("screens.doctor.clearance.col.valid"), "green", valid, t("screens.doctor.clearance.col.validNote"), ShieldCheck)}
                {col(t("screens.doctor.clearance.col.soon"), "amber", soon, t("screens.doctor.clearance.col.soonNote", { n: warn }), Clock)}
                {col(t("screens.doctor.clearance.col.off"), "red", off, t("screens.doctor.clearance.col.offNote"), Archive)}
            </div>
        </div>
    );
}
