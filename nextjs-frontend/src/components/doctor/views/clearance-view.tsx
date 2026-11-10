import { Ban, CircleCheck, History, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_STATE, CLEARANCE_TYPE, dayDiff, fmtDate } from "@/components/doctor/labels";
import { Empty, FighterFilter, Panel, Pill, Restrictions } from "@/components/doctor/ui";

import { ListHead } from "./list-head";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { MedicalClearance } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceOverview, listClearances } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { param } from "@/lib/utils";

const isLive = (c: MedicalClearance) => c.status === "active" && c.isCurrentlyValid !== false;

/**
 * Giấy phép: đang hiệu lực lấy từ hồ sơ (`activeClearances`, kèm `isCurrentlyValid`), đã thu hồi/hết hạn dựng lại từ lịch sử
 * MEDICAL_CLEARANCE. Ngưỡng cảnh báo lấy từ cài đặt (API: mặc định 14 ngày vì chưa có `/settings`).
 */
export async function ClearanceView({ query, fighterId: scopedId }: { query: Record<string, string | string[] | undefined>; fighterId?: string }) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const requested = scopedId ?? param(query.fighter);
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
    const issueHref = scopedId ? routes.doctor.fighterGrantClearance(scopedId) : `${routes.doctor.grantClearance}${fighterId ? `?fighter=${fighterId}` : ""}`;

    /**
     * A clearance's status in words with a glyph, coloured by meaning only (DESIGN.md: words-first status, no colour
     * alone, no filled title cards).
     */
    const statusOf = (c: MedicalClearance): { tone: "ok" | "warn" | "bad" | "off"; Icon: LucideIcon; text: string } => {
        if (c.status === "revoked") return { tone: "bad", Icon: Ban, text: c.revokedAt ? t("doctorViews.clearance.revokedOn", { date: fmtDate(c.revokedAt, locale) }) : t("doctorViews.clearance.revoked") };
        if (c.status === "superseded") return { tone: "off", Icon: History, text: t("doctorViews.clearance.superseded") };
        if (!isLive(c)) return { tone: "off", Icon: History, text: t("doctorViews.clearance.expired") };
        if (!c.validUntil) return { tone: "ok", Icon: CircleCheck, text: t("doctorViews.clearance.activeNoEnd") };
        const days = dayDiff(c.validUntil, now);
        return days <= warn ? { tone: "warn", Icon: TriangleAlert, text: plural(t, "doctorViews.clearance.expiringDays", days) } : { tone: "ok", Icon: CircleCheck, text: plural(t, "doctorViews.clearance.activeDays", days) };
    };

    const col = (title: string, tag: string, rows: MedicalClearance[], note: string) => (
        <section className="gp-col" data-tag={tag} data-shot={`col-${tag}`}>
            <h2>
                {title}{" "}
                <small>
                    {rows.length} · {note}
                </small>
            </h2>
            {rows.length ? (
                <ol>
                    {rows.map((c, i) => {
                        const live = isLive(c);
                        const total = c.validUntil ? Date.parse(c.validUntil) - Date.parse(c.issuedAt) : 0;
                        const p = total ? Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(c.issuedAt)) / total)) : 0;
                        const regions = c.restrictions.flatMap((r) => r.blockedRegions);
                        const status = statusOf(c);
                        return (
                            <li key={c.id} className="gp-card" data-tone={status.tone} style={{ ["--i" as string]: i }}>
                                <header>
                                    <b>{t(c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level])}</b>
                                    <span className="gp-status">
                                        <status.Icon aria-hidden />
                                        {status.text}
                                    </span>
                                </header>
                                <div className="gp-body">
                                    {!scopedId && (
                                        <Link href={routes.doctor.fighter(c.fighterId)} className="yt-rowlink">
                                            <b>{nameOf.get(c.fighterId) ?? t("doctorViews.common.fighter")}</b>
                                        </Link>
                                    )}
                                    <div className="gp-dates">
                                        <span>
                                            <small>{t("doctorViews.clearance.from")}</small>
                                            {fmtDate(c.issuedAt, locale)}
                                        </span>
                                        <span style={{ textAlign: "right" }}>
                                            <small>{t("doctorViews.clearance.until")}</small>
                                            {c.validUntil ? fmtDate(c.validUntil, locale) : t("doctorViews.clearance.noLimit")}
                                        </span>
                                    </div>
                                    {/* Time used of the validity window; a clearance with no end date has none to show. */}
                                    {live && c.validUntil && (
                                        <div className="gp-meter" style={{ ["--p" as string]: p }} aria-hidden>
                                            <i />
                                        </div>
                                    )}
                                    {c.revokedReason && (
                                        <p className="gp-revoked">
                                            {t("doctorViews.clearance.revokedReason", { date: fmtDate(c.revokedAt, locale), reason: c.revokedReason })}
                                        </p>
                                    )}
                                    {c.reason && <p className="yt-note">{c.reason}</p>}
                                    <Restrictions r={c.allowLists ? { ...c.allowLists, notes: null } : null} t={t} />
                                    {!c.allowLists && regions.length > 0 && (
                                        <ul className="yt-chips">
                                            {regions.map((r) => (
                                                <li key={r} data-tone="block">
                                                    {t("doctorViews.clearance.avoidRegion", { region: t(BODY_REGION[r]).toLowerCase() })}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {live && c.level !== "not_cleared" && (
                                        <div>
                                            <RevokeClearanceButton clearanceId={c.id} fighterId={c.fighterId} fighterName={nameOf.get(c.fighterId) ?? t("doctorViews.common.fighterLower")} />
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <Empty title={t("doctorViews.clearance.empty")} />
            )}
        </section>
    );

    return (
        <>
            <ListHead
                scoped={!!scopedId}
                title={t("doctorViews.clearance.title")}
                sub={plural(t, "doctorViews.clearance.sub", warn)}
                actions={
                    <Link href={issueHref} className="yt-btn" data-v="primary">
                        <ShieldCheck aria-hidden />
                        {t("doctorViews.clearance.grant")}
                    </Link>
                }
            />
            {!scopedId && <FighterFilter base={routes.doctor.clearance} fighters={fighters} current={fighterId} t={t} />}
            {/* Inside the profile the header already says whether this fighter has a valid clearance. */}
            {!scopedId && missing.length > 0 && (
                <Panel title={t("doctorViews.clearance.missing", { n: missing.length })} id="thieu">
                    <ul className="hs-clr">
                        {missing.map((r) => (
                            <li key={r.fighter.id}>
                                <Link href={routes.doctor.fighter(r.fighter.id)} className="yt-rowlink">
                                    <b>{r.fighter.name}</b>
                                </Link>
                                <small>
                                    <Link className="yt-go" href={`${routes.doctor.grantClearance}?fighter=${r.fighter.id}`}>
                                        {t("doctorViews.clearance.grant")}
                                    </Link>
                                </small>
                                <Pill tone={CLEARANCE_STATE[r.state].tone}>{t(CLEARANCE_STATE[r.state].label)}</Pill>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <div className="gp-cols">
                {col(t("doctorViews.clearance.colValid"), "green", valid, t("doctorViews.clearance.colValidNote"))}
                {col(t("doctorViews.clearance.colSoon"), "amber", soon, plural(t, "doctorViews.clearance.colSoonNote", warn))}
                {col(t("doctorViews.clearance.colOff"), "red", off, t("doctorViews.clearance.colOffNote"))}
            </div>
        </>
    );
}
