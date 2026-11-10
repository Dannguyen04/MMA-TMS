import { ArrowRight, CircleCheck, CircleX, Stethoscope, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BodyPanel } from "@/components/doctor/body-panel";
import { DECISION_OF, examLabel } from "@/components/doctor/exam-meta";
import { loadFighterRow } from "@/components/doctor/fighter-row";
import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_TYPE, DECISION, INJURY_STATUS, REQUESTER_ROLE, clearanceBadge, dayDiff, fmtDate, fmtDateTime, injuryName, injuryPlace, jointOf } from "@/components/doctor/labels";
import { Panel, Pill, Restrictions, Vitals } from "@/components/doctor/ui";
import { FlashToast } from "@/components/medical/flash-toast";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import type { ToastInput } from "@/components/ui/toast";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { MedicalClearance } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getClearanceHistory, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getFighter } from "@/lib/services/people";
import { listSuspensions } from "@/lib/services/suspensions";
import { ClearSuspensionButton } from "@/app/(app)/coach/bouts/suspensions/clear-suspension-button";
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

const NOTICES: Record<string, { title: MessageKey; description?: MessageKey }> = {
    "examination-not-eligible": { title: "screens.doctor.fighter.notice.examSaved", description: "screens.doctor.fighter.notice.examSavedNotEligible" },
    "clearance-issued": { title: "screens.doctor.fighter.notice.clearanceIssued" },
    "clearance-full": { title: "screens.doctor.fighter.notice.clearanceFull" },
    "clearance-restricted": { title: "screens.doctor.fighter.notice.clearanceRestricted" },
    "clearance-not_cleared": { title: "screens.doctor.fighter.notice.notCleared" },
};

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]">): Promise<Metadata> {
    const { fighterId } = await params;
    const user = await requireRole("doctor");
    const { t } = await getTranslator();
    const fighter = canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    return { title: fighter ? t("screens.doctor.fighter.metaTitle", { name: fighter.name }) : t("screens.doctor.fighter.notFound") };
}

function clearanceExcluded(c: MedicalClearance | null): string[] {
    if (!c) return [];
    return [...(c.allowLists?.excludedJoints ?? []), ...c.restrictions.flatMap((r) => r.blockedRegions.map((region) => jointOf({ bodyRegion: region })))];
}

export default async function DoctorFighterProfilePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    // Same cached read as the profile layout, so the record is fetched once.
    const { user, row } = await loadFighterRow(fighterId);
    const { t, locale } = await getTranslator();
    const stored = row.fighter;
    const now = new Date().toISOString();

    const [examinations, injuries, clearances, plans, reviewRequests, observations, suspensions] = await Promise.all([
        listExaminations({ fighterIds: [stored.id] }),
        listInjuries({ fighterIds: [stored.id] }),
        getClearanceHistory(stored.id),
        listRecoveryPlans({ fighterIds: [stored.id] }),
        listReviewRequests(stored.id),
        medicalFeatureAvailable("aiObservations") ? nullIfServiceFails(listAlerts({ fighterIds: [stored.id] })) : Promise.resolve([]),
        nullIfServiceFails(listSuspensions({ fighterId: stored.id }, user)),
    ]);
    const { fighter, summary, dossier } = row;

    // Căn cứ tập luyện: phiếu khám đang quyết định phạm vi tập (API) hoặc phiếu gần nhất (demo).
    const currentTrainingId = dossier?.currentExaminations.TRAINING?.id;
    const basis = (currentTrainingId ? examinations.find((e) => e.id === currentTrainingId) : (summary.latestExamination ?? undefined)) ?? null;
    const withVitals = basis?.vitals ? basis : (examinations.find((e) => e.vitals) ?? null);
    const shownInjuries = injuries.filter((i) => i.status !== "resolved" || (i.resolvedAt && dayDiff(i.resolvedAt, now) >= -RECENT_RESOLVED_DAYS));
    const excluded = [...new Set([...(basis?.decisionRestrictions?.excludedJoints ?? []), ...clearanceExcluded(summary.clearance)])];
    const abnormalHead = !!basis?.assessments.some((a) => a.result !== "normal" && /neuro|thần kinh|thị lực|vision|head|đầu/i.test(a.area));
    const openReviews = reviewRequests.filter((r) => r.status === "OPEN");


    // Quỹ đạo 5 tuần.
    const ev: { kind: Kind; day: number; text: string }[] = [];
    summary.activeInjuries.forEach((i) => ev.push({ kind: "injury", day: dayDiff(i.occurredAt, now), text: `${injuryName(t, i)} · ${injuryPlace(t, i)}` }));
    openReviews.forEach((r) => ev.push({ kind: "review", day: dayDiff(r.requestedAt, now), text: r.reason }));
    clearances.filter((c) => c.status === "active" && c.validUntil).forEach((c) => ev.push({ kind: "expiry", day: dayDiff(c.validUntil!, now), text: t("screens.doctor.fighter.expires", { name: t(c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]) }) }));
    if (summary.nextFollowUp) ev.push({ kind: "followup", day: summary.nextFollowUp.daysUntil, text: t("screens.doctor.fighter.followUpFromExam") });
    plans.filter((p) => p.status === "active").forEach((p) => (p.milestones ?? []).forEach((m) => !m.isCompleted && m.targetDate && ev.push({ kind: "milestone", day: dayDiff(m.targetDate, now), text: m.title })));
    examinations.forEach((e) => ev.push({ kind: "exam", day: dayDiff(e.date, now), text: examLabel(t, e) }));
    const events = ev.filter((e) => e.day >= SPAN[0] && e.day <= SPAN[1]).sort((a, b) => a.day - b.day);

    const pathname = routes.doctor.fighter(fighter.id);
    const noticeKeys = NOTICES[param(query.notice) ?? ""] ?? null;
    const notice: ToastInput | null = noticeKeys
        ? { title: t(noticeKeys.title), ...(noticeKeys.description ? { description: t(noticeKeys.description) } : {}), tone: "success" }
        : null;
    const decision = basis ? (basis.scope ? (dossier?.currentExaminations.TRAINING?.decision ?? DECISION_OF[basis.outcome]) : DECISION_OF[basis.outcome]) : null;

    return (
        <>
            <FlashToast notice={notice} cleanHref={hrefWith(pathname, query, { notice: null })} />


            <div className="hs-grid">
                <Panel title={t("screens.doctor.fighter.bodyMap")} id="body3d" tone="plate" aside={<span className="yt-drag-hint">{t("screens.doctor.fighter.dragToRotate")}</span>}>
                    <BodyPanel injuries={shownInjuries} excluded={excluded} height={500} abnormalHead={abnormalHead} />
                </Panel>
                <div className="hs-col">
                    <Panel
                        title={t("screens.doctor.fighter.injuries", { n: summary.activeInjuries.length })}
                        id="chan-thuong"
                        aside={
                            <Link className="yt-go" href={routes.doctor.fighterInjuries(fighter.id)}>
                                {t("screens.doctor.all")} <ArrowRight aria-hidden />
                            </Link>
                        }
                    >
                        {shownInjuries.length ? (
                            <ul className="hs-inj">
                                {shownInjuries.map((i) => (
                                    <li key={i.id}>
                                        <Link href={routes.doctor.fighterInjury(i.fighterId, i.id)}>{injuryName(t, i)}</Link>
                                        <small>
                                            {injuryPlace(t, i)} · {fmtDate(i.occurredAt, locale)}
                                        </small>
                                        <Pill tone={INJURY_STATUS[i.status].tone}>{t(INJURY_STATUS[i.status].label)}</Pill>
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
                                <Link className="yt-go" href={routes.doctor.fighterExamination(basis.fighterId, basis.id)}>
                                    {t("screens.doctor.fighter.basisExam")} <ArrowRight aria-hidden />
                                </Link>
                            ) : undefined
                        }
                    >
                        {basis && decision ? (
                            <>
                                <p className="hs-decision" data-d={decision}>
                                    {decision === "NOT_ELIGIBLE" ? <CircleX aria-hidden /> : decision === "ELIGIBLE" ? <CircleCheck aria-hidden /> : <TriangleAlert aria-hidden />}
                                    {t(DECISION[decision].label)}
                                </p>
                                <p className="hs-basis-meta">
                                    {examLabel(t, basis)}
                                    {basis.validUntil ? t("screens.doctor.fighter.validUntil", { date: fmtDate(basis.validUntil, locale) }) : ""}
                                </p>
                                <p>{basis.summary}</p>
                                <Restrictions r={basis.decisionRestrictions} t={t} />
                                {!basis.decisionRestrictions && summary.clearance?.restrictions.length ? (
                                    <ul className="yt-chips" style={{ marginTop: 10 }}>
                                        {summary.clearance.restrictions.flatMap((r) => r.blockedRegions).map((b) => (
                                            <li key={b} data-tone="block">
                                                {t("screens.doctor.avoid", { region: t(BODY_REGION[b]).toLowerCase() })}
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
                                <Link href={hrefWith(routes.doctor.fighterNewExamination(fighter.id), {}, { type: "baseline" })} className="yt-btn" data-v="primary">
                                    {t("screens.doctor.fighter.createBaseline")}
                                </Link>
                            </div>
                        )}
                    </Panel>
                    <Panel title={t("screens.doctor.fighter.vitals")} id="sinh-hieu" aside={withVitals ? fmtDate(withVitals.date, locale) : undefined}>
                        <Vitals v={withVitals?.vitals} t={t} />
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
                                            {fmtDate(s.startsOn, locale)} – {fmtDate(s.endsOn, locale)}
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
                                                        ? t("screens.doctor.fighter.suspension.endedEarlyOn", { date: fmtDate(s.clearedAt, locale) })
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
                                        {/* Hết hạn nhưng cần xác nhận: bác sĩ phụ trách xác nhận cho tập lại (POST /suspensions/:id/clear). */}
                                        {s.status === "AWAITING_CLEARANCE" && !s.clearedAt && (
                                            <span style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                                                <ClearSuspensionButton suspension={s} fighterName={fighter.name} />
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
                            <span className="tj-now" />
                            {[-14, -7, 7, 14, 21].map((tick) => (
                                <span key={tick} className="tj-tick" style={{ left: `${xp(tick)}%` }}>
                                    {tick > 0 ? `+${tick}` : tick}
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
                            <Link className="yt-go" href={routes.doctor.fighterClearance(fighter.id)}>
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
                                        <li key={c.id} data-off={s.label !== "doctorUi.clearanceBadge.active"}>
                                            <b>{t(c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level])}</b>
                                            <small>
                                                {fmtDate(c.issuedAt, locale)} – {c.validUntil ? fmtDate(c.validUntil, locale) : t("screens.doctor.fighter.noEnd")}
                                            </small>
                                            <Pill tone={s.tone}>{t(s.label)}</Pill>
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
                                            {t(REQUESTER_ROLE[r.requesterRole])} · {fmtDateTime(r.requestedAt, locale)}
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
                                                <b>{t(BODY_REGION[a.bodyRegion])}</b>
                                            </Link>
                                            <small>
                                                {t("screens.doctor.fighter.observationRange", {
                                                    observed: a.metric.observed,
                                                    baseline: a.metric.baseline,
                                                    unit: a.metric.unit,
                                                    date: fmtDate(a.detectedAt, locale),
                                                })}
                                            </small>
                                            <Pill tone={a.status === "new" ? "blue" : "neutral"}>
                                                {t(a.status === "new" ? "screens.doctor.fighter.observationNew" : "screens.doctor.fighter.observationSeen")}
                                            </Pill>
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
        </>
    );
}
