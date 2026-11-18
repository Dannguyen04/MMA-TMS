import { Plus } from "lucide-react";
import Link from "next/link";

import { INJURY_STATUS, SEVERITY, fmtDate, injuryName, injuryPlace, rel } from "@/components/doctor/labels";
import { Empty, FighterFilter, Panel, Pill } from "@/components/doctor/ui";

import { ListHead } from "./list-head";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { Injury } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getInjuryDetail, listInjuries } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { param } from "@/lib/utils";

/**
 * Chấn thương: đang mở lấy từ hồ sơ (`activeInjuries`), đã khỏi dựng lại từ lịch sử (`/medical/history?recordType=INJURY`),
 * điều trị từ lịch sử TREATMENT. Backend chưa có `GET /doctors/:id/injuries` hay `GET /injuries/:id/treatments`.
 */
export async function InjuriesView({ query, fighterId: scopedId }: { query: Record<string, string | string[] | undefined>; fighterId?: string }) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const requested = scopedId ?? param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const [fighters, list] = await Promise.all([listFighters(user), listInjuries({ fighterIds: fighterId ? [fighterId] : accessibleFighterIds(user) })]);
    const details = await Promise.all(list.map((i) => getInjuryDetail(i.id)));
    const treatmentsOf = new Map(details.flatMap((d) => (d ? [[d.injury.id, d.treatments] as const] : [])));
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const open = list.filter((i) => i.status !== "resolved");
    const closed = list.filter((i) => i.status === "resolved");
    const now = Date.now();
    const newHref = scopedId ? routes.doctor.fighterNewInjury(scopedId) : `${routes.doctor.newInjury}${fighterId ? `?fighter=${fighterId}` : ""}`;

    const table = (rows: Injury[]) => (
        <div className="yt-tablewrap">
            <table className="yt-table">
                <thead>
                    <tr>
                        <th>{t("doctorViews.injuries.colInjury")}</th>
                        {!scopedId && <th>{t("doctorViews.common.fighter")}</th>}
                        <th>{t("doctorViews.injuries.colPlace")}</th>
                        <th className="yt-hide-sm">{t("doctorViews.injuries.colSeverity")}</th>
                        <th>{t("doctorViews.injuries.colStatus")}</th>
                        <th className="yt-hide-sm">{t("doctorViews.injuries.colTreatment")}</th>
                        <th className="yt-hide-sm">{t("doctorViews.injuries.colReview")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i, n) => {
                        const ts = treatmentsOf.get(i.id) ?? [];
                        const next = ts.map((tr) => tr.nextReviewAt).filter((d): d is string => !!d && Date.parse(d) > now).sort()[0];
                        return (
                            <tr key={i.id} style={{ ["--i" as string]: n }}>
                                <td>
                                    <Link className="yt-rowlink" href={routes.doctor.fighterInjury(i.fighterId, i.id)}>
                                        {injuryName(t, i)}
                                    </Link>
                                    <small>{t("doctorViews.injuries.occurred", { date: fmtDate(i.occurredAt, locale) })}</small>
                                </td>
                                {!scopedId && (
                                    <td>
                                        <Link className="yt-sublink" href={routes.doctor.fighter(i.fighterId)}>{nameOf.get(i.fighterId) ?? t("doctorViews.common.fighter")}</Link>
                                    </td>
                                )}
                                <td>{injuryPlace(t, i)}</td>
                                <td className="yt-hide-sm">
                                    <Pill tone={SEVERITY[i.severity].tone}>{t(SEVERITY[i.severity].label)}</Pill>
                                </td>
                                <td>
                                    <Pill tone={INJURY_STATUS[i.status].tone}>{t(INJURY_STATUS[i.status].label)}</Pill>
                                    {i.resolvedAt && <small>{t("doctorViews.injuries.resolvedOn", { date: fmtDate(i.resolvedAt, locale) })}</small>}
                                </td>
                                <td className="yt-hide-sm">{plural(t, "doctorViews.injuries.times", ts.length)}</td>
                                <td className="yt-hide-sm">
                                    {next ? (
                                        <>
                                            {fmtDate(next, locale)}
                                            <small>{rel(t, next)}</small>
                                        </>
                                    ) : (
                                        <span className="yt-muted">{t("doctorViews.exams.none")}</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <>
            <ListHead
                scoped={!!scopedId}
                title={t("doctorViews.injuries.title")}
                sub={t("doctorViews.injuries.sub", { open: open.length, closed: closed.length })}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <Plus aria-hidden />
                        {t("doctorViews.injuries.new")}
                    </Link>
                }
            />
            {!scopedId && <FighterFilter base={routes.doctor.injuries} fighters={fighters} current={fighterId} t={t} />}
            <Panel title={t("doctorViews.injuries.openPanel", { n: open.length })} id="dang-mo">
                {open.length ? table(open) : <Empty title={t("doctorViews.injuries.openEmptyTitle")}>{t("doctorViews.injuries.openEmptyBody")}</Empty>}
            </Panel>
            <Panel title={t("doctorViews.injuries.closedPanel", { n: closed.length })} id="da-khoi">
                {closed.length ? table(closed) : <Empty title={t("doctorViews.injuries.closedEmpty")} />}
            </Panel>
        </>
    );
}
