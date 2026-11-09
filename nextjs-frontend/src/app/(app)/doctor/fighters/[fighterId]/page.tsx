import { ArrowRight, CircleCheck, CircleX, FilePlus2, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BodyPanel } from "@/components/doctor/body-panel";
import { DECISION_OF, examLabel } from "@/components/doctor/exam-meta";
import { FighterHead } from "@/components/doctor/fighter-head";
import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_TYPE, DECISION, INJURY_STATUS, REQUESTER_ROLE, clearanceBadge, dayDiff, fmtDate, fmtDateTime, injuryName, injuryPlace, jointOf } from "@/components/doctor/labels";
import { Panel, Pill, Restrictions, Vitals } from "@/components/doctor/ui";
import { FlashToast } from "@/components/medical/flash-toast";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import type { ToastInput } from "@/components/ui/toast";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import type { MedicalClearance } from "@/lib/domain/types";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { loadDoctorRow } from "@/lib/services/doctor-board";
import { getClearanceHistory, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getFighter } from "@/lib/services/people";
import { listSuspensions } from "@/lib/services/suspensions";
import { EarlyEndSuspensionButton } from "@/app/(app)/coach/bouts/suspensions/early-end-suspension-button";
import { param } from "@/lib/utils";

type Kind = "injury" | "review" | "expiry" | "followup" | "milestone" | "exam";
const MAG: Record<Kind, number> = { injury: 8, review: 8, expiry: 7, followup: 6, milestone: 5, exam: 5 };
const KL: Record<Kind, MessageKey> = {
    injury: "screens.doctor.event.injury",
    review: "screens.doctor.event.review",
    expiry: "screens.doctor.event.expiry",
    followup: "screens.doctor.event.followup",
    milestone: "screens.doctor.event.milestone",
    exam: "screens.doctor.event.exam",
};
const SPAN = [-14, 21] as const;
const xp = (d: number) => ((d - SPAN[0]) / (SPAN[1] - SPAN[0])) * 100;
const relDay = (t: Translator, d: number) =>
    d === 0 ? t("screens.doctor.today") : d > 0 ? plural(t, "screens.doctor.fighter.relDay.future", d) : plural(t, "screens.doctor.fighter.relDay.past", -d);
const RECENT_RESOLVED_DAYS = 180;

const notices = (t: Translator): Record<string, ToastInput> => ({
    "examination-not-eligible": { title: t("screens.doctor.fighter.notice.examSaved"), description: t("screens.doctor.fighter.notice.examSavedNotEligible"), tone: "success" },
    "clearance-issued": { title: t("screens.doctor.fighter.notice.clearanceIssued"), tone: "success" },
    "clearance-full": { title: t("screens.doctor.fighter.notice.clearanceFull"), tone: "success" },
    "clearance-restricted": { title: t("screens.doctor.fighter.notice.clearanceRestricted"), tone: "success" },
    "clearance-not_cleared": { title: t("screens.doctor.fighter.notice.notCleared"), tone: "success" },
});

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]">): Promise<Metadata> {
    const { fighterId } = await params;
    const [user, { t }] = await Promise.all([requireRole("doctor"), getTranslator()]);
    const fighter = canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    return { title: fighter ? t("screens.doctor.fighter.metaTitle", { name: fighter.name }) : t("screens.doctor.fighter.notFound") };
}

function clearanceExcluded(c: MedicalClearance | null): string[] {
    if (!c) return [];
    return [...(c.allowLists?.excludedJoints ?? []), ...c.restrictions.flatMap((r) => r.blockedRegions.map((region) => jointOf({ bodyRegion: region })))];
}

export default async function DoctorFighterProfilePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]">) {
    const user = await requireRole("doctor");
    const { t } = await getTranslator();
    const { fighterId } = await params;
    const query = await searchParams;
    const stored = await requireFighterAccess(user, fighterId);
    const now = new Date().toISOString();

    const [row, examinations, injuries, clearances, plans, reviewRequests, observations, suspensions] = await Promise.all([
        loadDoctorRow(stored),
        listExaminations({ fighterIds: [stored.id] }),
        listInjuries({ fighterIds: [stored.id] }),
        getClearanceHistory(stored.id),
        listRecoveryPlans({ fighterIds: [stored.id] }),
        listReviewRequests(stored.id),
        medicalFeatureAvailable("aiObservations") ? nullIfServiceFails(listAlerts({ fighterIds: [stored.id] })) : Promise.resolve([]),
        nullIfServiceFails(listSuspensions({ fighterId: stored.id }, user)),
    ]);
    if (!row) notFound();
    const { fighter, summary, training, competition, dossier, tag } = row;

    // Căn cứ tập luyện: phiếu khám đang quyết định phạm vi tập (API) hoặc phiếu gần nhất (demo).
    const currentTrainingId = dossier?.currentExaminations.TRAINING?.id;
    const basis = (currentTrainingId ? examinations.find((e) => e.id === currentTrainingId) : (summary.latestExamination ?? undefined)) ?? null;
    const withVitals = basis?.vitals ? basis : (examinations.find((e) => e.vitals) ?? null);
    const shownInjuries = injuries.filter((i) => i.status !== "resolved" || (i.resolvedAt && dayDiff(i.resolvedAt, now) >= -RECENT_RESOLVED_DAYS));
    const excluded = [...new Set([...(basis?.decisionRestrictions?.excludedJoints ?? []), ...clearanceExcluded(summary.clearance)])];
    const abnormalHead = !!basis?.assessments.some((a) => a.result !== "normal" && /neuro|thần kinh|thị lực|vision|head|đầu/i.test(a.area));
    const activePlan = summary.activeRecoveryPlan;
    const openReviews = reviewRequests.filter((r) => r.status === "OPEN");

    // Đường trở lại thi đấu, suy ra từ hồ sơ.
    const milestones = activePlan?.plan.milestones ?? [];
    const steps = [
        {
            key: "baseline",
            label: t("screens.doctor.fighter.step.baseline"),
            state: summary.needsBaseline ? "blocked" : "done",
            note: t(summary.needsBaseline ? "screens.doctor.fighter.step.missing" : "screens.doctor.fighter.step.done"),
        },
        {
            key: "injury",
            label: t("screens.doctor.fighter.step.injury"),
            state: summary.activeInjuries.length ? "current" : "skip",
            note: summary.activeInjuries.length ? t("screens.doctor.fighter.step.openCount", { n: summary.activeInjuries.length }) : t("screens.doctor.fighter.step.none"),
        },
        {
            key: "recovery",
            label: t("screens.doctor.fighter.step.recovery"),
            state: activePlan ? "current" : "skip",
            note: activePlan
                ? milestones.length
                    ? t("screens.doctor.fighter.step.milestones", { done: milestones.filter((m) => m.isCompleted).length, total: milestones.length })
                    : `${activePlan.progressPct}%`
                : t("screens.doctor.fighter.step.noPlan"),
        },
        {
            key: "training",
            label: t("screens.doctor.gate.training"),
            state: training ? (training.eligible ? "done" : "blocked") : "skip",
            note: t(training ? (training.eligible ? "screens.doctor.fighter.step.fit" : "screens.doctor.fighter.step.notFit") : "screens.doctor.fighter.step.unknown"),
        },
        ...(competition
            ? [
                  {
                      key: "competition",
                      label: t("screens.doctor.gate.competition"),
                      state: competition.eligible ? "done" : "blocked",
                      note: t(competition.eligible ? "screens.doctor.fighter.step.fit" : "screens.doctor.fighter.step.notFit"),
                  },
              ]
            : []),
    ];

    // Quỹ đạo 5 tuần.
    const ev: { kind: Kind; day: number; text: string }[] = [];
    summary.activeInjuries.forEach((i) => ev.push({ kind: "injury", day: dayDiff(i.occurredAt, now), text: `${injuryName(i)} · ${injuryPlace(i)}` }));
    openReviews.forEach((r) => ev.push({ kind: "review", day: dayDiff(r.requestedAt, now), text: r.reason }));
    clearances.filter((c) => c.status === "active" && c.validUntil).forEach((c) => ev.push({ kind: "expiry", day: dayDiff(c.validUntil!, now), text: t("screens.doctor.fighter.expires", { name: c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level] }) }));
    if (summary.nextFollowUp) ev.push({ kind: "followup", day: summary.nextFollowUp.daysUntil, text: t("screens.doctor.fighter.followUpFromExam") });
    plans.filter((p) => p.status === "active").forEach((p) => (p.milestones ?? []).forEach((m) => !m.isCompleted && m.targetDate && ev.push({ kind: "milestone", day: dayDiff(m.targetDate, now), text: m.title })));
    examinations.forEach((e) => ev.push({ kind: "exam", day: dayDiff(e.date, now), text: examLabel(e) }));
    const events = ev.filter((e) => e.day >= SPAN[0] && e.day <= SPAN[1]).sort((a, b) => a.day - b.day);

    const pathname = routes.doctor.fighter(fighter.id);
    const notice = notices(t)[param(query.notice) ?? ""] ?? null;
    const decision = basis ? (basis.scope ? (dossier?.currentExaminations.TRAINING?.decision ?? DECISION_OF[basis.outcome]) : DECISION_OF[basis.outcome]) : null;

    return (
        <div className="yt-page">
            <FlashToast notice={notice} cleanHref={hrefWith(pathname, query, { notice: null })} />
            <FighterHead
                fighter={fighter}
                training={training}
                competition={competition}
                tag={tag}
                actions={
                    <>
                        <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                            <FilePlus2 aria-hidden />
                            {t("screens.doctor.newExamination")}
                        </Link>
                        <Link href={`${routes.doctor.grantClearance}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                            <ShieldCheck aria-hidden />
                            {t("screens.doctor.issueClearance")}
                        </Link>
                    </>
                }
            />

            <Panel title={t("screens.doctor.fighter.ladder")} id="ladder" aside={t("screens.doctor.fighter.ladderAside")}>
                <ol className="hs-ladder" style={{ ["--n" as string]: steps.length }}>
                    {steps.map((s, i) => (
                        <li key={s.key} className="hs-step" data-state={s.state} style={{ ["--i" as string]: i }}>
                            <i aria-hidden />
                            <b>{s.label}</b>
                            <small>{s.note}</small>
                        </li>
                    ))}
                </ol>
            </Panel>

            <div className="hs-grid">
                <Panel title={t("screens.doctor.fighter.bodyMap")} id="body3d" aside={<span className="yt-drag-hint">{t("screens.doctor.fighter.dragToRotate")}</span>}>
                    <BodyPanel injuries={shownInjuries} excluded={excluded} height={500} abnormalHead={abnormalHead} />
                </Panel>
                <div className="hs-col">
                    <Panel
                        title={t("screens.doctor.fighter.injuries", { n: summary.activeInjuries.length })}
                        id="chan-thuong"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.injuries}?fighter=${fighter.id}`}>
                                {t("screens.doctor.all")} <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {shownInjuries.length ? (
                            <ul className="hs-inj">
                                {shownInjuries.map((i) => (
                                    <li key={i.id}>
                                        <Link href={routes.doctor.injury(i.id)}>{injuryName(i)}</Link>
                                        <small>
                                            {injuryPlace(i)} · {fmtDate(i.occurredAt)}
                                        </small>
                                        <Pill tone={INJURY_STATUS[i.status].tone}>{INJURY_STATUS[i.status].label}</Pill>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.fighter.noInjuries")}</p>
                        )}
                        <p style={{ marginTop: 12 }}>
                            <Link className="yt-go" href={`${routes.doctor.newInjury}?fighter=${fighter.id}`}>
                                {t("screens.doctor.fighter.recordInjury")} <ArrowRight aria-hidden />
                            </Link>
                        </p>
                    </Panel>
                    <Panel
                        title={t("screens.doctor.fighter.basis")}
                        id="can-cu"
                        aside={
                            basis ? (
                                <Link className="yt-go" href={routes.doctor.examination(basis.id)}>
                                    {t("screens.doctor.fighter.basisExam")} <ArrowRight aria-hidden />
                                </Link>
                            ) : undefined
                        }
                    >
                        {basis && decision ? (
                            <>
                                <p className="hs-decision" data-d={decision}>
                                    {decision === "NOT_ELIGIBLE" ? <CircleX aria-hidden /> : decision === "ELIGIBLE" ? <CircleCheck aria-hidden /> : <TriangleAlert aria-hidden />}
                                    {DECISION[decision].label}
                                </p>
                                <p className="hs-basis-meta">
                                    {examLabel(basis)}
                                    {basis.validUntil ? t("screens.doctor.fighter.validUntil", { date: fmtDate(basis.validUntil) }) : ""}
                                </p>
                                <p>{basis.summary}</p>
                                <Restrictions r={basis.decisionRestrictions} />
                                {!basis.decisionRestrictions && summary.clearance?.restrictions.length ? (
                                    <ul className="yt-chips" style={{ marginTop: 10 }}>
                                        {summary.clearance.restrictions.flatMap((r) => r.blockedRegions).map((b) => (
                                            <li key={b} data-tone="block">
                                                {t("screens.doctor.avoid", { region: BODY_REGION[b].toLowerCase() })}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </>
                        ) : (
                            <div className="yt-empty" style={{ padding: 24 }}>
                                <Stethoscope aria-hidden />
                                <p className="yt-empty-t">{t("screens.doctor.fighter.noBasis")}</p>
                                <p className="yt-empty-d">{t("screens.doctor.fighter.noBasisHint")}</p>
                                <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}`} className="yt-btn" data-v="primary">
                                    {t("screens.doctor.fighter.createBaseline")}
                                </Link>
                            </div>
                        )}
                    </Panel>
                    <Panel title={t("screens.doctor.fighter.vitals")} id="sinh-hieu" aside={withVitals ? fmtDate(withVitals.date) : undefined}>
                        <Vitals v={withVitals?.vitals} />
                    </Panel>
                    <Panel title={suspensions ? t("screens.doctor.fighter.suspensionsCount", { n: suspensions.length }) : t("screens.doctor.fighter.suspensions")} id="dinh-chi">
                        {suspensions === null ? (
                            <p className="yt-muted">{t("screens.doctor.fighter.suspensionsUnavailable")}</p>
                        ) : suspensions.length ? (
                            <ul className="hs-clr">
                                {suspensions.map((s) => (
                                    <li key={s.id}>
                                        <b>
                                            {t(
                                                s.reason === "MEDICAL"
                                                    ? s.issuedBy === "ORGANIZER"
                                                        ? "screens.doctor.fighter.suspension.medicalOrganizer"
                                                        : "screens.doctor.fighter.suspension.medical"
                                                    : s.reason === "KO"
                                                      ? "screens.doctor.fighter.suspension.ko"
                                                      : s.reason === "TKO"
                                                        ? "screens.doctor.fighter.suspension.tko"
                                                        : s.reason === "DQ"
                                                          ? "screens.doctor.fighter.suspension.dq"
                                                          : s.reason === "MANDATORY_REST"
                                                            ? "screens.doctor.fighter.suspension.mandatoryRest"
                                                            : "screens.doctor.fighter.suspension.other",
                                            )}
                                        </b>
                                        <small>
                                            {fmtDate(s.startsOn)} – {fmtDate(s.endsOn)}
                                            {s.issuedBy === "ORGANIZER" && s.issuerReference ? t("screens.doctor.fighter.suspension.organizerRef", { ref: s.issuerReference }) : ""}
                                        </small>
                                        <Pill
                                            tone={
                                                s.status === "ACTIVE"
                                                    ? "red"
                                                    : s.status === "AWAITING_CLEARANCE"
                                                      ? "amber"
                                                      : s.status === "ENDED"
                                                        ? "green"
                                                        : "neutral"
                                            }
                                        >
                                            {t(
                                                s.status === "ACTIVE"
                                                    ? "screens.doctor.fighter.suspension.active"
                                                    : s.status === "AWAITING_CLEARANCE"
                                                      ? "screens.doctor.fighter.suspension.awaitingClearance"
                                                      : s.status === "ENDED"
                                                        ? "screens.doctor.fighter.suspension.ended"
                                                        : "screens.doctor.fighter.suspension.notStarted",
                                            )}
                                        </Pill>
                                        {s.earlyEndExaminationId && (
                                            <span style={{ gridColumn: "1 / -1", fontSize: "12px" }}>
                                                <Link
                                                    href={routes.doctor.examination(s.earlyEndExaminationId)}
                                                    className="yt-go"
                                                >
                                                    {s.clearedAt
                                                        ? t("screens.doctor.fighter.suspension.endedEarlyOn", { date: fmtDate(s.clearedAt) })
                                                        : t("screens.doctor.fighter.suspension.endedEarly")}{" "}
                                                    <ArrowRight aria-hidden />
                                                </Link>
                                            </span>
                                        )}
                                        {s.liftReference && (
                                            <span className="yt-muted" style={{ gridColumn: "1 / -1", fontSize: "12px" }}>
                                                {t("screens.doctor.fighter.suspension.liftedBy", { ref: s.liftReference })}
                                            </span>
                                        )}
                                        {s.status === "ACTIVE" && s.reason === "MEDICAL" && s.issuedBy === "CLUB" && (
                                            <span style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                                                <EarlyEndSuspensionButton
                                                    suspension={s}
                                                    fighterName={fighter.name}
                                                    examinations={examinations}
                                                    doctorId={user.profileId ?? undefined}
                                                    label={t("screens.doctor.fighter.suspension.endEarly")}
                                                />
                                            </span>
                                        )}
                                        {s.status === "ACTIVE" && s.issuedBy === "ORGANIZER" && (
                                            <span style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                                                <EarlyEndSuspensionButton
                                                    suspension={s}
                                                    fighterName={fighter.name}
                                                    examinations={examinations}
                                                    doctorId={user.profileId ?? undefined}
                                                    label={t("screens.doctor.fighter.suspension.organizerLifted")}
                                                />
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.fighter.noSuspensions")}</p>
                        )}
                    </Panel>
                </div>
                <div className="hs-col hs-col3">
                    <Panel title={t("screens.doctor.fighter.trajectory")} id="quy-dao" aside={t("screens.doctor.fighter.trajectoryAside")}>
                        <div className="tj" aria-hidden>
                            <span className="tj-axis" />
                            <span className="tj-past" />
                            <span className="tj-now" data-label={t("screens.doctor.today")} />
                            {[-14, -7, 7, 14, 21].map((t) => (
                                <span key={t} className="tj-tick" style={{ left: `${xp(t)}%` }}>
                                    {t > 0 ? `+${t}` : t}
                                </span>
                            ))}
                            {events.map((e, i) => {
                                const flip = i % 2 === 0;
                                return (
                                    <span
                                        key={i}
                                        className="tj-dot"
                                        data-k={e.kind}
                                        data-up={flip && e.kind === "exam"}
                                        style={{ left: `${xp(e.day)}%`, ["--m" as string]: MAG[e.kind], ["--d" as string]: i * 70 }}
                                        title={`${t(KL[e.kind])}: ${e.text}`}
                                    />
                                );
                            })}
                        </div>
                        {events.length ? (
                            <ol className="tj-list">
                                {events.map((e, i) => (
                                    <li key={i} data-k={e.kind} data-future={e.day >= 0}>
                                        <time>{relDay(t, e.day)}</time>
                                        <span>
                                            {t(KL[e.kind])}
                                            <small>{e.text}</small>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.fighter.noEvents")}</p>
                        )}
                    </Panel>
                    <Panel
                        title={t("screens.doctor.fighter.clearances")}
                        id="giay-phep"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.clearance}?fighter=${fighter.id}`}>
                                {t("screens.doctor.all")} <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {clearances.length ? (
                            <ul className="hs-clr">
                                {clearances.slice(0, 4).map((c) => {
                                    const s = clearanceBadge(c);
                                    const canRevoke = c.status === "active" && c.isCurrentlyValid !== false && c.level !== "not_cleared";
                                    return (
                                        <li key={c.id} data-off={s.label !== "Hiệu lực"}>
                                            <b>{c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]}</b>
                                            <small>
                                                {fmtDate(c.issuedAt)} – {c.validUntil ? fmtDate(c.validUntil) : t("screens.doctor.fighter.noEnd")}
                                            </small>
                                            <Pill tone={s.tone}>{s.label}</Pill>
                                            {canRevoke && (
                                                <span style={{ gridColumn: "1 / -1" }}>
                                                    <RevokeClearanceButton clearanceId={c.id} fighterId={fighter.id} fighterName={fighter.name} />
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.fighter.noClearances")}</p>
                        )}
                    </Panel>
                    <Panel
                        title={t("screens.doctor.fighter.reviews", { n: openReviews.length })}
                        id="yeu-cau"
                        aside={
                            <Link className="yt-go" href={`${routes.doctor.reviewRequests}?fighter=${fighter.id}`}>
                                {t("screens.doctor.all")} <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {openReviews.length ? (
                            <ul className="hs-clr">
                                {openReviews.map((r) => (
                                    <li key={r.id}>
                                        <b>{r.reason}</b>
                                        <small>
                                            {REQUESTER_ROLE[r.requesterRole]} · {fmtDateTime(r.requestedAt)}
                                        </small>
                                        <Pill tone="amber">{t("screens.doctor.fighter.reviewOpen")}</Pill>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="yt-muted">{t("screens.doctor.fighter.noReviews")}</p>
                        )}
                    </Panel>
                    {medicalFeatureAvailable("aiObservations") && (
                        <Panel
                            title={t("screens.doctor.fighter.observations")}
                            id="quan-sat"
                            aside={
                                <Link className="yt-go" href={routes.doctor.aiAlerts}>
                                    {t("screens.doctor.all")} <ArrowRight aria-hidden />
                                </Link>
                            }
                        >
                            {observations === null ? (
                                <p className="yt-muted">{t("screens.doctor.fighter.observationsUnavailable")}</p>
                            ) : observations.length ? (
                                <ul className="hs-clr">
                                    {observations.slice(0, 3).map((a) => (
                                        <li key={a.id}>
                                            <Link href={routes.doctor.aiAlert(a.id)}>
                                                <b>{BODY_REGION[a.bodyRegion]}</b>
                                            </Link>
                                            <small>
                                                {t("screens.doctor.fighter.observationRange", {
                                                    observed: a.metric.observed,
                                                    baseline: a.metric.baseline,
                                                    unit: a.metric.unit,
                                                    date: fmtDate(a.detectedAt),
                                                })}
                                            </small>
                                            <Pill tone={a.status === "new" ? "blue" : "neutral"}>{t(a.status === "new" ? "screens.doctor.fighter.observationNew" : "screens.doctor.fighter.observationSeen")}</Pill>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="yt-muted">{t("screens.doctor.fighter.noObservations")}</p>
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
