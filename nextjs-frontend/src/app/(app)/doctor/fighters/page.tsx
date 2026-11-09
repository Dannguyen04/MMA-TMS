import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HEALTH_STATUS, JOINT, fmeta, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { Empty, Gate, PageHead, Panel, Pill, reasonsText } from "@/components/doctor/ui";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { TRIAGE_ORDER, loadDoctorBoard, type Triage } from "@/lib/services/doctor-board";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Võ sĩ" };
const TAG_WORD: Record<Triage, string> = { red: "Chặn", amber: "Theo dõi", green: "Thông qua" };
const LOC: Record<string, Triage | null> = { all: null, blocked: "red", watch: "amber", ok: "green" };

export default async function DoctorFightersPage({ searchParams }: PageProps<"/doctor/fighters">) {
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
    const seg = (k: string, l: string) => (
        <Link href={`${routes.doctor.fighters}?${new URLSearchParams({ ...(q && { q }), loc: k })}`} aria-current={loc === k ? "page" : undefined}>
            {l}
        </Link>
    );
    const showCompetition = rows.some((r) => r.competition);

    return (
        <div className="yt-page">
            <PageHead title="Võ sĩ" sub={`${rows.length} võ sĩ được giao · sắp theo màu thẻ, đỏ trước`} />
            <form className="yt-filters" role="search" data-shot="filters">
                <label className="yt-search">
                    <Search aria-hidden />
                    <span className="sr-only">Tìm võ sĩ theo tên</span>
                    <input name="q" defaultValue={q} placeholder="Tìm theo tên võ sĩ" />
                </label>
                <input type="hidden" name="loc" value={loc} />
                <nav className="yt-segs" aria-label="Lọc theo thẻ">
                    {seg("all", "Tất cả")}
                    {seg("blocked", "Chặn")}
                    {seg("watch", "Theo dõi")}
                    {seg("ok", "Thông qua")}
                </nav>
            </form>
            <Panel id="roster">
                {list.length === 0 ? (
                    <Empty
                        title={rows.length ? "Không có võ sĩ phù hợp" : "Chưa có võ sĩ nào được giao"}
                        action={
                            rows.length ? (
                                <Link href={routes.doctor.fighters} className="yt-btn">
                                    Xóa bộ lọc
                                </Link>
                            ) : undefined
                        }
                    >
                        {rows.length ? `${q ? `Không có tên nào chứa “${q}”.` : "Chưa có võ sĩ nào ở nhóm này."} Thử bỏ bớt điều kiện lọc.` : "Khi quản trị viên giao võ sĩ cho bạn, danh sách sẽ hiện ở đây."}
                    </Empty>
                ) : (
                    <div className="yt-tablewrap">
                        <table className="yt-table">
                            <thead>
                                <tr>
                                    <th>Võ sĩ</th>
                                    <th>Điều kiện</th>
                                    <th className="yt-hide-sm">Lý do / hạn chế</th>
                                    <th className="yt-hide-sm">Chấn thương mở</th>
                                    <th className="yt-hide-sm">Tình trạng</th>
                                    <th className="yt-hide-sm">Khám gần nhất</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((r, i) => {
                                    const last = r.summary.latestExamination;
                                    const st = HEALTH_STATUS[r.fighter.healthStatus];
                                    const reasons = reasonsText(r.training);
                                    const excluded = r.dossier?.currentExaminations.TRAINING?.restrictions?.excludedJoints ?? [];
                                    return (
                                        <tr key={r.fighter.id} style={{ ["--i" as string]: i }}>
                                            <td>
                                                <span className="ro-name" data-tag={r.tag}>
                                                    <span className="yt-hole" aria-hidden />
                                                    <span>
                                                        <Link className="yt-rowlink" href={routes.doctor.fighter(r.fighter.id)}>
                                                            {r.fighter.name}
                                                        </Link>
                                                        <small>{fmeta(r.fighter)}</small>
                                                    </span>
                                                </span>
                                                <span className="sr-only">Thẻ {TAG_WORD[r.tag]}</span>
                                            </td>
                                            <td>
                                                <span className="ro-gates">
                                                    <Gate label="Tập" e={r.training} />
                                                    {showCompetition && <Gate label="Thi đấu" e={r.competition} />}
                                                </span>
                                            </td>
                                            <td className="yt-hide-sm">
                                                {reasons.length ? (
                                                    <b>{reasons.join(" · ")}</b>
                                                ) : excluded.length ? (
                                                    `Tránh ${excluded.map((j) => JOINT[j].toLowerCase()).join(", ")}`
                                                ) : r.summary.clearanceState === "restricted" ? (
                                                    "Tập có hạn chế"
                                                ) : (
                                                    <span className="yt-muted">Không</span>
                                                )}
                                            </td>
                                            <td className="yt-hide-sm">
                                                {r.summary.activeInjuries.length ? (
                                                    r.summary.activeInjuries.map((j) => (
                                                        <span key={j.id}>
                                                            {injuryName(j)}
                                                            <small>{injuryPlace(j)}</small>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="yt-muted">Không</span>
                                                )}
                                            </td>
                                            <td className="yt-hide-sm">
                                                <Pill tone={st.tone}>{st.label}</Pill>
                                            </td>
                                            <td className="yt-hide-sm">
                                                {last ? (
                                                    <>
                                                        {fmtDate(last.date)}
                                                        <small>{last.scope ? (last.scope === "TRAINING" ? "Tập luyện" : "Thi đấu") : "Phiếu khám"}</small>
                                                    </>
                                                ) : (
                                                    <span className="yt-muted">Chưa khám</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}
