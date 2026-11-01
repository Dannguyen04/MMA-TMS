import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_STATE, CLEARANCE_TYPE, dayDiff, fmtDate } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Panel, Pill, Restrictions } from "@/components/doctor/ui";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { MedicalClearance } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceOverview, listClearances } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Giấy phép" };

const isLive = (c: MedicalClearance) => c.status === "active" && c.isCurrentlyValid !== false;

/**
 * Giấy phép: đang hiệu lực lấy từ hồ sơ (`activeClearances`, kèm `isCurrentlyValid`), đã thu hồi/hết hạn dựng lại từ lịch sử
 * MEDICAL_CLEARANCE. Ngưỡng cảnh báo lấy từ cài đặt (API: mặc định 14 ngày vì chưa có `/settings`).
 */
export default async function DoctorClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance">) {
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
                        const p = total ? Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(c.issuedAt)) / total)) : 0.15;
                        const regions = c.restrictions.flatMap((r) => r.blockedRegions);
                        return (
                            <li key={c.id} className="gp-card" data-tag={live ? tag : "none"} style={{ ["--i" as string]: i }}>
                                <header>
                                    <b>{c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]}</b>
                                    <small>
                                        {c.status === "revoked" ? "Đã thu hồi" : c.status === "superseded" ? "Đã thay thế" : !live ? "Hết hạn" : c.validUntil ? `Còn ${dayDiff(c.validUntil, now)} ngày` : "Không thời hạn"}
                                    </small>
                                </header>
                                <div className="gp-body">
                                    <Link href={routes.doctor.fighter(c.fighterId)} className="yt-rowlink">
                                        <b>{nameOf.get(c.fighterId) ?? "Võ sĩ"}</b>
                                    </Link>
                                    <div className="gp-dates">
                                        <span>
                                            <small>Từ</small>
                                            {fmtDate(c.issuedAt)}
                                        </span>
                                        <span style={{ textAlign: "right" }}>
                                            <small>Đến</small>
                                            {c.validUntil ? fmtDate(c.validUntil) : "Không giới hạn"}
                                        </span>
                                    </div>
                                    {live && (
                                        <div className="gp-meter" style={{ ["--p" as string]: p }} aria-hidden>
                                            <i />
                                        </div>
                                    )}
                                    {c.revokedReason && (
                                        <p className="gp-revoked">
                                            Thu hồi {fmtDate(c.revokedAt)}: {c.revokedReason}
                                        </p>
                                    )}
                                    {c.reason && <p className="yt-note">{c.reason}</p>}
                                    <Restrictions r={c.allowLists ? { ...c.allowLists, notes: null } : null} />
                                    {!c.allowLists && regions.length > 0 && (
                                        <ul className="yt-chips">
                                            {regions.map((r) => (
                                                <li key={r} data-tone="block">
                                                    Tránh {BODY_REGION[r].toLowerCase()}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {live && c.level !== "not_cleared" && (
                                        <div>
                                            <RevokeClearanceButton clearanceId={c.id} fighterId={c.fighterId} fighterName={nameOf.get(c.fighterId) ?? "võ sĩ"} />
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <Empty title="Không có giấy phép" />
            )}
        </section>
    );

    return (
        <div className="yt-page">
            <PageHead
                title="Giấy phép"
                sub={`Cảnh báo khi còn ≤ ${warn} ngày theo cài đặt hệ thống`}
                actions={
                    <Link href={issueHref} className="yt-btn" data-v="primary">
                        <ShieldCheck aria-hidden />
                        Cấp giấy phép
                    </Link>
                }
            />
            <FighterFilter base={routes.doctor.clearance} fighters={fighters} current={fighterId} />
            {missing.length > 0 && (
                <Panel title={`Chưa có giấy phép hợp lệ · ${missing.length}`} id="thieu">
                    <ul className="hs-clr">
                        {missing.map((r) => (
                            <li key={r.fighter.id}>
                                <Link href={routes.doctor.fighter(r.fighter.id)} className="yt-rowlink">
                                    <b>{r.fighter.name}</b>
                                </Link>
                                <small>
                                    <Link className="yt-go" href={`${routes.doctor.grantClearance}?fighter=${r.fighter.id}`}>
                                        Cấp giấy phép
                                    </Link>
                                </small>
                                <Pill tone={CLEARANCE_STATE[r.state].tone}>{CLEARANCE_STATE[r.state].label}</Pill>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <div className="gp-cols">
                {col("Hiệu lực", "green", valid, "đang dùng")}
                {col("Sắp hết hạn", "amber", soon, `≤ ${warn} ngày`)}
                {col("Thu hồi / hết hạn", "red", off, "lưu trữ")}
            </div>
        </div>
    );
}
