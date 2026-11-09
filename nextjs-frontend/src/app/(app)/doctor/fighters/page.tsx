import { CircleCheck, Search, ShieldX, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HEALTH_STATUS, JOINT, fmeta, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { CELL_SUB, Empty, Gate, PageHead, Pill, ROW, ROW_LINK, UI_TONE, reasonsText } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TONE_TEXT } from "@/components/ui/tone";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { TRIAGE_ORDER, loadDoctorBoard, type Triage } from "@/lib/services/doctor-board";
import { cn, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.fighters.title") };
}
const TAG_WORD: Record<Triage, string> = { red: "Chặn", amber: "Theo dõi", green: "Thông" };
const TAG_TONE = { red: "red", amber: "amber", green: "green" } as const satisfies Record<Triage, "red" | "amber" | "green">;
const TAG_ICON = { red: ShieldX, amber: TriangleAlert, green: CircleCheck } as const satisfies Record<Triage, unknown>;
const LOC: Record<string, Triage | null> = { all: null, blocked: "red", watch: "amber", ok: "green" };

export default async function DoctorFightersPage({ searchParams }: PageProps<"/doctor/fighters">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const q = param(query.q) ?? "";
    const loc = param(query.loc) ?? "all";
    const { rows } = await loadDoctorBoard(user);
    const needle = q.trim().toLocaleLowerCase("vi");
    const want = LOC[loc] ?? null;
    const list = rows
        .filter((r) => !needle || r.fighter.name.toLocaleLowerCase("vi").includes(needle))
        .filter((r) => !want || r.tag === want)
        .sort((a, b) => TRIAGE_ORDER[a.tag] - TRIAGE_ORDER[b.tag] || a.fighter.name.localeCompare(b.fighter.name, "vi"));
    const showCompetition = rows.some((r) => r.competition);

    return (
        <div className="flex flex-col gap-6">
            <PageHead title={t("doctor.fighters.title")} sub={`${rows.length} võ sĩ được giao · sắp theo màu thẻ, đỏ trước`} />
            <form className="flex min-w-0 flex-wrap items-center gap-3" role="search">
                <label className="relative block w-full max-w-sm">
                    <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                    <span className="sr-only">Tìm võ sĩ theo tên</span>
                    <Input name="q" defaultValue={q} placeholder="Tìm theo tên võ sĩ" className="pl-9" />
                </label>
                <input type="hidden" name="loc" value={loc} />
                <SegmentedLinks
                    label="Lọc theo thẻ"
                    className="max-w-full"
                    items={[
                        { k: "all", l: "Tất cả" },
                        { k: "blocked", l: "Đỏ · Chặn", icon: ShieldX },
                        { k: "watch", l: "Vàng · Theo dõi", icon: TriangleAlert },
                        { k: "ok", l: "Xanh · Thông", icon: CircleCheck },
                    ].map(({ k, l, icon }) => ({ href: `${routes.doctor.fighters}?${new URLSearchParams({ ...(q && { q }), loc: k })}`, label: l, icon, active: loc === k }))}
                />
            </form>
            {list.length === 0 ? (
                <Empty
                    title={rows.length ? "Không có võ sĩ phù hợp" : "Chưa có võ sĩ nào được giao"}
                    action={
                        rows.length ? (
                            <ButtonLink href={routes.doctor.fighters} variant="secondary">
                                Xóa bộ lọc
                            </ButtonLink>
                        ) : undefined
                    }
                >
                    {rows.length ? `${q ? `Không có tên nào chứa “${q}”.` : "Chưa có võ sĩ nào ở nhóm này."} Thử bỏ bớt điều kiện lọc.` : "Khi quản trị viên giao võ sĩ cho bạn, danh sách sẽ hiện ở đây."}
                </Empty>
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <THead>
                            <tr>
                                <TH>Võ sĩ</TH>
                                <TH>Điều kiện</TH>
                                <TH className="max-md:hidden">Lý do / hạn chế</TH>
                                <TH className="max-md:hidden">Chấn thương mở</TH>
                                <TH className="max-md:hidden">Tình trạng</TH>
                                <TH className="max-md:hidden">Khám gần nhất</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {list.map((r) => {
                                const last = r.summary.latestExamination;
                                const st = HEALTH_STATUS[r.fighter.healthStatus];
                                const reasons = reasonsText(r.training);
                                const excluded = r.dossier?.currentExaminations.TRAINING?.restrictions?.excludedJoints ?? [];
                                const TagIcon = TAG_ICON[r.tag];
                                return (
                                    <TR key={r.fighter.id} className={ROW}>
                                        <TD>
                                            <span className="flex min-w-0 items-center gap-3" data-tag={r.tag}>
                                                <TagIcon aria-hidden className={cn("size-[18px] shrink-0", TONE_TEXT[UI_TONE[TAG_TONE[r.tag]]])} strokeWidth={2.25} />
                                                <span className="min-w-0">
                                                    <Link className={ROW_LINK} href={routes.doctor.fighter(r.fighter.id)}>
                                                        {r.fighter.name}
                                                    </Link>
                                                    <small className={CELL_SUB}>{fmeta(r.fighter)}</small>
                                                </span>
                                            </span>
                                            <span className="sr-only">Thẻ {TAG_WORD[r.tag]}</span>
                                        </TD>
                                        <TD>
                                            <span className="flex flex-wrap gap-1.5">
                                                <Gate label="Tập" e={r.training} />
                                                {showCompetition && <Gate label="Thi đấu" e={r.competition} />}
                                            </span>
                                        </TD>
                                        <TD className="max-md:hidden">
                                            {reasons.length ? (
                                                <b className="font-semibold">{reasons.join(" · ")}</b>
                                            ) : excluded.length ? (
                                                `Tránh ${excluded.map((j) => JOINT[j].toLowerCase()).join(", ")}`
                                            ) : r.summary.clearanceState === "restricted" ? (
                                                "Tập có hạn chế"
                                            ) : (
                                                <span className="text-fg-muted">Không</span>
                                            )}
                                        </TD>
                                        <TD className="max-md:hidden">
                                            {r.summary.activeInjuries.length ? (
                                                r.summary.activeInjuries.map((j) => (
                                                    <span key={j.id} className="block">
                                                        {injuryName(j)}
                                                        <small className={CELL_SUB}>{injuryPlace(j)}</small>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-fg-muted">Không</span>
                                            )}
                                        </TD>
                                        <TD className="max-md:hidden">
                                            <Pill tone={st.tone}>{st.label}</Pill>
                                        </TD>
                                        <TD className="max-md:hidden">
                                            {last ? (
                                                <>
                                                    {fmtDate(last.date)}
                                                    <small className={CELL_SUB}>{last.scope ? (last.scope === "TRAINING" ? "Tập luyện" : "Thi đấu") : "Phiếu khám"}</small>
                                                </>
                                            ) : (
                                                <span className="text-fg-muted">Chưa khám</span>
                                            )}
                                        </TD>
                                    </TR>
                                );
                            })}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
