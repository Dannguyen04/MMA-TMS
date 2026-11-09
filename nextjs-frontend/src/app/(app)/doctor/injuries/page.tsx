import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { INJURY_STATUS, SEVERITY, fmtDate, injuryName, injuryPlace, rel } from "@/components/doctor/labels";
import { CELL_SUB, Empty, FighterFilter, PageHead, Panel, Pill, ROW, ROW_LINK, SUB_LINK } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
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
    const now = new Date().getTime();
    const newHref = `${routes.doctor.newInjury}${fighterId ? `?fighter=${fighterId}` : ""}`;

    const table = (rows: Injury[]) => (
        <Table>
            <THead>
                <tr>
                    <TH>Chấn thương</TH>
                    <TH>Võ sĩ</TH>
                    <TH>Vị trí</TH>
                    <TH className="max-md:hidden">Mức độ</TH>
                    <TH>Tình trạng</TH>
                    <TH className="max-md:hidden">Điều trị</TH>
                    <TH className="max-md:hidden">Hẹn đánh giá lại</TH>
                </tr>
            </THead>
            <TBody>
                    {rows.map((i) => {
                        const ts = treatmentsOf.get(i.id) ?? [];
                        const next = ts.map((t) => t.nextReviewAt).filter((d): d is string => !!d && Date.parse(d) > now).sort()[0];
                        return (
                            <TR key={i.id} className={ROW}>
                                <TD>
                                    <Link className={ROW_LINK} href={routes.doctor.injury(i.id)}>
                                        {injuryName(i)}
                                    </Link>
                                    <small className={CELL_SUB}>Xảy ra {fmtDate(i.occurredAt)}</small>
                                </TD>
                                <TD>
                                    <Link className={SUB_LINK} href={routes.doctor.fighter(i.fighterId)}>{nameOf.get(i.fighterId) ?? "Võ sĩ"}</Link>
                                </TD>
                                <TD>{injuryPlace(i)}</TD>
                                <TD className="max-md:hidden">
                                    <Pill tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Pill>
                                </TD>
                                <TD>
                                    <Pill tone={INJURY_STATUS[i.status].tone}>{INJURY_STATUS[i.status].label}</Pill>
                                    {i.resolvedAt && <small className={CELL_SUB}>Khỏi {fmtDate(i.resolvedAt)}</small>}
                                </TD>
                                <TD className="max-md:hidden">{ts.length} lần</TD>
                                <TD className="max-md:hidden">
                                    {next ? (
                                        <>
                                            {fmtDate(next)}
                                            <small className={CELL_SUB}>{rel(next)}</small>
                                        </>
                                    ) : (
                                        <span className="text-fg-muted">Không</span>
                                    )}
                                </TD>
                            </TR>
                        );
                    })}
            </TBody>
        </Table>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHead
                title={t("doctor.injuries.title")}
                sub={`${open.length} đang mở · ${closed.length} đã khỏi`}
                actions={
                    <ButtonLink href={newHref}>
                        <Plus aria-hidden />
                        Ghi nhận chấn thương
                    </ButtonLink>
                }
            />
            <FighterFilter base={routes.doctor.injuries} fighters={fighters} current={fighterId} />
            <Panel title={`Đang mở · ${open.length}`} id="dang-mo" className="overflow-hidden" contentClassName="px-0 pb-0">
                {open.length ? table(open) : <Empty compact title="Không có chấn thương đang mở">Mọi chấn thương của nhóm này đã khỏi.</Empty>}
            </Panel>
            <Panel title={`Đã khỏi · ${closed.length}`} id="da-khoi" className="overflow-hidden" contentClassName="px-0 pb-0">
                {closed.length ? table(closed) : <Empty compact title="Chưa có chấn thương đã khỏi" />}
            </Panel>
        </div>
    );
}
