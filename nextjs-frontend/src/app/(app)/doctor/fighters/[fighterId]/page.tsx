import { CircleCheck, CircleDashed, CircleX, Clock, FilePlus2, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BodyPanel } from "@/components/doctor/body-panel";
import { DECISION_OF, examLabel } from "@/components/doctor/exam-meta";
import { FighterHead } from "@/components/doctor/fighter-head";
import { BODY_REGION, CLEARANCE_LEVEL, CLEARANCE_TYPE, DECISION, INJURY_STATUS, REQUESTER_ROLE, clearanceBadge, dayDiff, fmtDate, fmtDateTime, injuryName, injuryPlace, jointOf } from "@/components/doctor/labels";
import { AvoidList, Panel, Pill, Restrictions, Vitals } from "@/components/doctor/ui";
import { CardLink } from "@/components/dashboard/card-link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { TONE_TEXT } from "@/components/ui/tone";
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
import { cn, param } from "@/lib/utils";

/** Return-to-fight steps: tone, icon and the note's words carry the state. */
const STEP = {
    done: { tone: "success", icon: CircleCheck },
    skip: { tone: "neutral", icon: CircleDashed },
    current: { tone: "warning", icon: Clock },
    blocked: { tone: "danger", icon: CircleX },
} as const;
const DECISION_LOOK = {
    ELIGIBLE: { tone: "success", icon: CircleCheck },
    ELIGIBLE_WITH_RESTRICTIONS: { tone: "warning", icon: TriangleAlert },
    NOT_ELIGIBLE: { tone: "danger", icon: CircleX },
} as const;
/** Card lists: title and sub line on the left, the status badge on the right. */
const LIST = "divide-y divide-border";
const ITEM = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-3 text-sm first:pt-0 last:pb-0";
const ITEM_SUB = "col-start-1 text-[13px] text-fg-muted";
const ITEM_BADGE = "col-start-2 row-span-2 row-start-1 self-center";

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
        <div className="flex flex-col gap-6">
            <FlashToast notice={notice} cleanHref={hrefWith(pathname, query, { notice: null })} />
            <FighterHead
                fighter={fighter}
                training={training}
                competition={competition}
                tag={tag}
                actions={
                    <>
                        <ButtonLink href={`${routes.doctor.grantClearance}?fighter=${fighter.id}`} variant="secondary">
                            <ShieldCheck aria-hidden />
                            {t("screens.doctor.issueClearance")}
                        </ButtonLink>
                        <ButtonLink href={`${routes.doctor.newExamination}?fighter=${fighter.id}`}>
                            <FilePlus2 aria-hidden />
                            {t("screens.doctor.newExamination")}
                        </ButtonLink>
                    </>
                }
            />

            <Panel title={t("screens.doctor.fighter.ladder")} id="ladder" aside={t("screens.doctor.fighter.ladderAside")}>
                <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: steps.length }}>
                    {steps.map((s) => {
                        const look = STEP[s.state as keyof typeof STEP];
                        const Icon = look.icon;
                        return (
                            <li key={s.key} data-state={s.state} className="flex min-w-0 items-start gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5">
                                <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", TONE_TEXT[look.tone])} strokeWidth={2.25} />
                                <span className="min-w-0">
                                    <b className="block text-sm font-semibold text-fg">{s.label}</b>
                                    <small className={cn("block text-[13px]", s.state === "blocked" || s.state === "current" ? cn("font-medium", TONE_TEXT[look.tone]) : "text-fg-muted")}>{s.note}</small>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </Panel>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] min-[1361px]:grid-cols-[minmax(320px,400px)_minmax(0,1fr)_minmax(0,1fr)]">
                <Panel title={t("screens.doctor.fighter.bodyMap")} id="body3d" aside={<span className="yt-drag-hint">{t("screens.doctor.fighter.dragToRotate")}</span>}>
                    <BodyPanel injuries={shownInjuries} excluded={excluded} height={500} abnormalHead={abnormalHead} />
                </Panel>
                <div className="flex min-w-0 flex-col gap-6">
                    <Panel
                        title={t("screens.doctor.fighter.injuries", { n: summary.activeInjuries.length })}
                        id="chan-thuong"
                        aside={<CardLink href={`${routes.doctor.injuries}?fighter=${fighter.id}`}>{t("screens.doctor.all")}</CardLink>}
                    >
                        {shownInjuries.length ? (
                            <ul className={LIST}>
                                {shownInjuries.map((i) => (
                                    <li key={i.id} className={ITEM}>
                                        <Link href={routes.doctor.injury(i.id)} className="font-semibold text-fg hover:underline">
                                            {injuryName(i)}
                                        </Link>
                                        <small className={ITEM_SUB}>
                                            {injuryPlace(i)} · {fmtDate(i.occurredAt)}
                                        </small>
                                        <span className={ITEM_BADGE}>
                                            <Pill tone={INJURY_STATUS[i.status].tone}>{INJURY_STATUS[i.status].label}</Pill>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noInjuries")}</p>
                        )}
                        <p className="mt-3">
                            <CardLink href={`${routes.doctor.newInjury}?fighter=${fighter.id}`} className="-ml-2">
                                {t("screens.doctor.fighter.recordInjury")}
                            </CardLink>
                        </p>
                    </Panel>
                    <Panel
                        title={t("screens.doctor.fighter.basis")}
                        id="can-cu"
                        aside={basis ? <CardLink href={routes.doctor.examination(basis.id)}>{t("screens.doctor.fighter.basisExam")}</CardLink> : undefined}
                    >
                        {basis && decision ? (
                            <>
                                <p className={cn("flex items-center gap-2 text-base font-semibold", TONE_TEXT[DECISION_LOOK[decision].tone])} data-d={decision}>
                                    {(() => {
                                        const DIcon = DECISION_LOOK[decision].icon;
                                        return <DIcon aria-hidden className="size-[18px] shrink-0" strokeWidth={2.25} />;
                                    })()}
                                    {DECISION[decision].label}
                                </p>
                                <p className="mt-0.5 mb-2 text-[13px] text-fg-muted">
                                    {examLabel(basis)}
                                    {basis.validUntil ? t("screens.doctor.fighter.validUntil", { date: fmtDate(basis.validUntil) }) : ""}
                                </p>
                                <p className="text-sm text-fg">{basis.summary}</p>
                                <Restrictions r={basis.decisionRestrictions} />
                                {!basis.decisionRestrictions && summary.clearance?.restrictions.length ? (
                                    <AvoidList
                                        items={summary.clearance.restrictions
                                            .flatMap((r) => r.blockedRegions)
                                            .map((b) => ({ key: b, label: t("screens.doctor.avoid", { region: BODY_REGION[b].toLowerCase() }) }))}
                                    />
                                ) : null}
                            </>
                        ) : (
                            <EmptyState
                                compact
                                icon={<Stethoscope />}
                                title={t("screens.doctor.fighter.noBasis")}
                                description={t("screens.doctor.fighter.noBasisHint")}
                                action={
                                    <ButtonLink href={`${routes.doctor.newExamination}?fighter=${fighter.id}`} size="sm">
                                        {t("screens.doctor.fighter.createBaseline")}
                                    </ButtonLink>
                                }
                            />
                        )}
                    </Panel>
                    <Panel title={t("screens.doctor.fighter.vitals")} id="sinh-hieu" aside={withVitals ? fmtDate(withVitals.date) : undefined}>
                        <Vitals v={withVitals?.vitals} />
                    </Panel>
                    <Panel title={suspensions ? t("screens.doctor.fighter.suspensionsCount", { n: suspensions.length }) : t("screens.doctor.fighter.suspensions")} id="dinh-chi">
                        {suspensions === null ? (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.suspensionsUnavailable")}</p>
                        ) : suspensions.length ? (
                            <ul className={LIST}>
                                {suspensions.map((s) => (
                                    <li key={s.id} className={ITEM}>
                                        <b className="font-semibold text-fg">
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
                                        <small className={ITEM_SUB}>
                                            {fmtDate(s.startsOn)} – {fmtDate(s.endsOn)}
                                            {s.issuedBy === "ORGANIZER" && s.issuerReference ? t("screens.doctor.fighter.suspension.organizerRef", { ref: s.issuerReference }) : ""}
                                        </small>
                                        <span className={ITEM_BADGE}>
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
                                        </span>
                                        {s.earlyEndExaminationId && (
                                            <span className="col-span-full">
                                                <CardLink href={routes.doctor.examination(s.earlyEndExaminationId)} className="-ml-2">
                                                    {s.clearedAt
                                                        ? t("screens.doctor.fighter.suspension.endedEarlyOn", { date: fmtDate(s.clearedAt) })
                                                        : t("screens.doctor.fighter.suspension.endedEarly")}
                                                </CardLink>
                                            </span>
                                        )}
                                        {s.liftReference && <span className="col-span-full text-xs text-fg-muted">{t("screens.doctor.fighter.suspension.liftedBy", { ref: s.liftReference })}</span>}
                                        {s.status === "ACTIVE" && s.reason === "MEDICAL" && s.issuedBy === "CLUB" && (
                                            <span className="col-span-full mt-1">
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
                                            <span className="col-span-full mt-1">
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
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noSuspensions")}</p>
                        )}
                    </Panel>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-6 lg:col-span-full lg:grid-cols-2 min-[1361px]:col-span-1 min-[1361px]:grid-cols-1">
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
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noEvents")}</p>
                        )}
                    </Panel>
                    <Panel title={t("screens.doctor.fighter.clearances")} id="giay-phep" aside={<CardLink href={`${routes.doctor.clearance}?fighter=${fighter.id}`}>{t("screens.doctor.all")}</CardLink>}>
                        {clearances.length ? (
                            <ul className={LIST}>
                                {clearances.slice(0, 4).map((c) => {
                                    const s = clearanceBadge(c);
                                    const canRevoke = c.status === "active" && c.isCurrentlyValid !== false && c.level !== "not_cleared";
                                    return (
                                        <li key={c.id} className={ITEM} data-off={s.label !== "Hiệu lực"}>
                                            <b className={s.label !== "Hiệu lực" ? "font-medium text-fg-muted" : "font-semibold text-fg"}>{c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]}</b>
                                            <small className={ITEM_SUB}>
                                                {fmtDate(c.issuedAt)} – {c.validUntil ? fmtDate(c.validUntil) : t("screens.doctor.fighter.noEnd")}
                                            </small>
                                            <span className={ITEM_BADGE}>
                                                <Pill tone={s.tone}>{s.label}</Pill>
                                            </span>
                                            {canRevoke && (
                                                <span className="col-span-full">
                                                    <RevokeClearanceButton clearanceId={c.id} fighterId={fighter.id} fighterName={fighter.name} />
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noClearances")}</p>
                        )}
                    </Panel>
                    <Panel
                        title={t("screens.doctor.fighter.reviews", { n: openReviews.length })}
                        id="yeu-cau"
                        aside={<CardLink href={`${routes.doctor.reviewRequests}?fighter=${fighter.id}`}>{t("screens.doctor.all")}</CardLink>}
                    >
                        {openReviews.length ? (
                            <ul className={LIST}>
                                {openReviews.map((r) => (
                                    <li key={r.id} className={ITEM}>
                                        <b className="font-semibold text-fg">{r.reason}</b>
                                        <small className={ITEM_SUB}>
                                            {REQUESTER_ROLE[r.requesterRole]} · {fmtDateTime(r.requestedAt)}
                                        </small>
                                        <span className={ITEM_BADGE}>
                                            <Pill tone="amber">{t("screens.doctor.fighter.reviewOpen")}</Pill>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noReviews")}</p>
                        )}
                    </Panel>
                    {medicalFeatureAvailable("aiObservations") && (
                        <Panel title={t("screens.doctor.fighter.observations")} id="quan-sat" aside={<CardLink href={routes.doctor.aiAlerts}>{t("screens.doctor.all")}</CardLink>}>
                            {observations === null ? (
                                <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.observationsUnavailable")}</p>
                            ) : observations.length ? (
                                <ul className={LIST}>
                                    {observations.slice(0, 3).map((a) => (
                                        <li key={a.id} className={ITEM}>
                                            <Link href={routes.doctor.aiAlert(a.id)} className="font-semibold text-fg hover:underline">
                                                {BODY_REGION[a.bodyRegion]}
                                            </Link>
                                            <small className={ITEM_SUB}>
                                                {t("screens.doctor.fighter.observationRange", {
                                                    observed: a.metric.observed,
                                                    baseline: a.metric.baseline,
                                                    unit: a.metric.unit,
                                                    date: fmtDate(a.detectedAt),
                                                })}
                                            </small>
                                            <span className={ITEM_BADGE}>
                                                <Pill tone={a.status === "new" ? "blue" : "neutral"}>{t(a.status === "new" ? "screens.doctor.fighter.observationNew" : "screens.doctor.fighter.observationSeen")}</Pill>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-fg-muted">{t("screens.doctor.fighter.noObservations")}</p>
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
