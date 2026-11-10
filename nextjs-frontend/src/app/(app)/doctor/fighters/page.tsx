import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HEALTH_STATUS, JOINT, fmeta, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { Empty, Gate, PageHead, Panel, Pill, reasonsText } from "@/components/doctor/ui";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { TRIAGE_ORDER, loadDoctorBoard, type Triage } from "@/lib/services/doctor-board";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.fighters") };
}
const TAG_WORD: Record<Triage, MessageKey> = { red: "screens.doctor.lane.red.word", amber: "screens.doctor.lane.amber.word", green: "doctorPages.dashboard.laneClear" };
const LOC: Record<string, Triage | null> = { all: null, blocked: "red", watch: "amber", ok: "green" };

export default async function DoctorFightersPage({ searchParams }: PageProps<"/doctor/fighters">) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
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
            <PageHead title={t("doctorPages.meta.fighters")} sub={plural(t, "doctorPages.fighters.sub", rows.length)} />
            <form className="yt-filters" role="search" data-shot="filters">
                <label className="yt-search">
                    <Search aria-hidden />
                    <span className="sr-only">{t("doctorPages.fighters.searchLabel")}</span>
                    <input name="q" defaultValue={q} placeholder={t("doctorPages.fighters.searchPlaceholder")} />
                </label>
                <input type="hidden" name="loc" value={loc} />
                <nav className="yt-segs" aria-label={t("doctorPages.fighters.filterAria")}>
                    {seg("all", t("screens.doctor.all"))}
                    {seg("blocked", t(TAG_WORD.red))}
                    {seg("watch", t(TAG_WORD.amber))}
                    {seg("ok", t(TAG_WORD.green))}
                </nav>
            </form>
            <Panel id="roster">
                {list.length === 0 ? (
                    <Empty
                        title={t(rows.length ? "doctorPages.fighters.empty.noMatch" : "doctorPages.fighters.empty.noneAssigned")}
                        action={
                            rows.length ? (
                                <Link href={routes.doctor.fighters} className="yt-btn">
                                    {t("doctorPages.fighters.clearFilters")}
                                </Link>
                            ) : undefined
                        }
                    >
                        {rows.length
                            ? `${q ? t("doctorPages.fighters.empty.noName", { q }) : t("doctorPages.fighters.empty.noneInGroup")} ${t("doctorPages.fighters.empty.tryLess")}`
                            : t("doctorPages.fighters.empty.assignHint")}
                    </Empty>
                ) : (
                    <div className="yt-tablewrap">
                        <table className="yt-table">
                            <thead>
                                <tr>
                                    <th>{t("doctorPages.fighters.col.fighter")}</th>
                                    <th>{t("doctorPages.fighters.col.eligibility")}</th>
                                    <th className="yt-hide-sm">{t("doctorPages.fighters.col.reasons")}</th>
                                    <th className="yt-hide-sm">{t("doctorPages.fighters.col.openInjuries")}</th>
                                    <th className="yt-hide-sm">{t("doctorPages.fighters.col.status")}</th>
                                    <th className="yt-hide-sm">{t("doctorPages.fighters.col.lastExam")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((r, i) => {
                                    const last = r.summary.latestExamination;
                                    const st = HEALTH_STATUS[r.fighter.healthStatus];
                                    const reasons = reasonsText(t, r.training);
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
                                                        <small>{fmeta(t, r.fighter)}</small>
                                                    </span>
                                                </span>
                                                <span className="sr-only">{t("doctorPages.fighters.tagSr", { tag: t(TAG_WORD[r.tag]) })}</span>
                                            </td>
                                            <td>
                                                <span className="ro-gates">
                                                    <Gate label={t("doctorPages.fighters.gateTraining")} e={r.training} t={t} />
                                                    {showCompetition && <Gate label={t("screens.doctor.gate.competition")} e={r.competition} t={t} />}
                                                </span>
                                            </td>
                                            <td className="yt-hide-sm">
                                                {reasons.length ? (
                                                    <b>{reasons.join(" · ")}</b>
                                                ) : excluded.length ? (
                                                    t("screens.doctor.avoid", { region: excluded.map((j) => t(JOINT[j]).toLowerCase()).join(", ") })
                                                ) : r.summary.clearanceState === "restricted" ? (
                                                    t("doctorPages.fighters.restricted")
                                                ) : (
                                                    <span className="yt-muted">{t("doctorPages.fighters.none")}</span>
                                                )}
                                            </td>
                                            <td className="yt-hide-sm">
                                                {r.summary.activeInjuries.length ? (
                                                    r.summary.activeInjuries.map((j) => (
                                                        <span key={j.id}>
                                                            {injuryName(t, j)}
                                                            <small>{injuryPlace(t, j)}</small>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="yt-muted">{t("doctorPages.fighters.none")}</span>
                                                )}
                                            </td>
                                            <td className="yt-hide-sm">
                                                <Pill tone={st.tone}>{t(st.label)}</Pill>
                                            </td>
                                            <td className="yt-hide-sm">
                                                {last ? (
                                                    <>
                                                        {fmtDate(last.date, locale)}
                                                        <small>{t(last.scope ? (last.scope === "TRAINING" ? "screens.doctor.gate.training" : "screens.doctor.gate.competition") : "screens.doctor.event.exam")}</small>
                                                    </>
                                                ) : (
                                                    <span className="yt-muted">{t("doctorPages.fighters.notExamined")}</span>
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
