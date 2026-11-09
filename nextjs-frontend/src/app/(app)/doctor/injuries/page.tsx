import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { INJURY_STATUS, SEVERITY, fmtDate, injuryName, injuryPlace, rel } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Panel, Pill } from "@/components/doctor/ui";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { Injury } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getInjuryDetail, listInjuries } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.injuries.title") };
}

/**
 * Chấn thương: đang mở lấy từ hồ sơ (`activeInjuries`), đã khỏi dựng lại từ lịch sử (`/medical/history?recordType=INJURY`),
 * điều trị từ lịch sử TREATMENT. Backend chưa có `GET /doctors/:id/injuries` hay `GET /injuries/:id/treatments`.
 */
export default async function DoctorInjuriesPage({ searchParams }: PageProps<"/doctor/injuries">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const [fighters, list] = await Promise.all([listFighters(user), listInjuries({ fighterIds: fighterId ? [fighterId] : accessibleFighterIds(user) })]);
    const details = await Promise.all(list.map((i) => getInjuryDetail(i.id)));
    const treatmentsOf = new Map(details.flatMap((d) => (d ? [[d.injury.id, d.treatments] as const] : [])));
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const open = list.filter((i) => i.status !== "resolved");
    const closed = list.filter((i) => i.status === "resolved");
    const now = Date.now();
    const newHref = `${routes.doctor.newInjury}${fighterId ? `?fighter=${fighterId}` : ""}`;

    const table = (rows: Injury[]) => (
        <div className="yt-tablewrap">
            <table className="yt-table">
                <thead>
                    <tr>
                        <th>Chấn thương</th>
                        <th>Võ sĩ</th>
                        <th>Vị trí</th>
                        <th className="yt-hide-sm">Mức độ</th>
                        <th>Tình trạng</th>
                        <th className="yt-hide-sm">Điều trị</th>
                        <th className="yt-hide-sm">Hẹn đánh giá lại</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i, n) => {
                        const ts = treatmentsOf.get(i.id) ?? [];
                        const next = ts.map((t) => t.nextReviewAt).filter((d): d is string => !!d && Date.parse(d) > now).sort()[0];
                        return (
                            <tr key={i.id} style={{ ["--i" as string]: n }}>
                                <td>
                                    <Link className="yt-rowlink" href={routes.doctor.injury(i.id)}>
                                        {injuryName(i)}
                                    </Link>
                                    <small>Xảy ra {fmtDate(i.occurredAt)}</small>
                                </td>
                                <td>
                                    <Link className="yt-sublink" href={routes.doctor.fighter(i.fighterId)}>{nameOf.get(i.fighterId) ?? "Võ sĩ"}</Link>
                                </td>
                                <td>{injuryPlace(i)}</td>
                                <td className="yt-hide-sm">
                                    <Pill tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Pill>
                                </td>
                                <td>
                                    <Pill tone={INJURY_STATUS[i.status].tone}>{INJURY_STATUS[i.status].label}</Pill>
                                    {i.resolvedAt && <small>Khỏi {fmtDate(i.resolvedAt)}</small>}
                                </td>
                                <td className="yt-hide-sm">{ts.length} lần</td>
                                <td className="yt-hide-sm">
                                    {next ? (
                                        <>
                                            {fmtDate(next)}
                                            <small>{rel(next)}</small>
                                        </>
                                    ) : (
                                        <span className="yt-muted">Không</span>
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
        <div className="yt-page">
            <PageHead
                title={t("doctor.injuries.title")}
                sub={`${open.length} đang mở · ${closed.length} đã khỏi`}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <Plus aria-hidden />
                        Ghi nhận chấn thương
                    </Link>
                }
            />
            <FighterFilter base={routes.doctor.injuries} fighters={fighters} current={fighterId} />
            <Panel title={`Đang mở · ${open.length}`} id="dang-mo">
                {open.length ? table(open) : <Empty title="Không có chấn thương đang mở">Mọi chấn thương của nhóm này đã khỏi.</Empty>}
            </Panel>
            <Panel title={`Đã khỏi · ${closed.length}`} id="da-khoi">
                {closed.length ? table(closed) : <Empty title="Chưa có chấn thương đã khỏi" />}
            </Panel>
        </div>
    );
}
