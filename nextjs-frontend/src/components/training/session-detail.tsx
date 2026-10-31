import { Ban, CalendarX2, CircleCheck, CircleDashed, Clock, Dumbbell, ListChecks, MessageSquare, ShieldAlert, Video as VideoIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CoachRating } from "@/components/domain/coach-rating";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { MetricTile } from "@/components/domain/metric-tile";
import { SessionStatusBadge, VideoStatusBadge } from "@/components/domain/status-badges";
import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { clearanceConflictMessage } from "@/lib/domain/clearance-rules";
import { exerciseCategoryLabel, trainingTypeLabel } from "@/lib/domain/labels";
import type { ClearanceConflict } from "@/lib/domain/rules";
import type { CoachFeedback, Exercise, SessionResult, TrainingPlan, TrainingSession, Video } from "@/lib/domain/types";
import { formatClock, formatDate, formatDateTime, formatMinutes, formatTime, formatWeekdayDate, pluralize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { sum } from "@/lib/utils";
import { Callout } from "./callout";
import { videoHref, type TrainingAudience } from "./session-table";
import { NOT_RECORDED } from "@/components/domain/domain-format";
import { exerciseVolume, plannedEndMs, rpeLabel, rpeText } from "./training-utils";

/** Status, type and start time for the session page header. */
export function SessionHeaderMeta({ session, locale = "en" }: { session: TrainingSession; locale?: Locale }) {
    const t = createTranslator(locale);
    const TypeIcon = TRAINING_TYPE_ICONS[session.type];
    return (
        <>
            <SessionStatusBadge locale={locale} status={session.status} />
            <Badge variant="outline" icon={TypeIcon}>
                {trainingTypeLabel(t, session.type)}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
                <Clock aria-hidden className="size-3.5 text-fg-subtle" />
                <time dateTime={session.scheduledAt} className={session.status === "pending" ? "line-through text-fg-muted" : undefined}>{formatDateTime(session.scheduledAt, locale)}</time>
            </span>
        </>
    );
}

export interface SessionDetailProps {
    session: TrainingSession;
    audience: TrainingAudience;
    /** Server time (ISO). */
    now: string;
    coachName: string;
    /** Coach names by id, for feedback authors. */
    coachNames: Record<string, string>;
    /** Staff views: whose session it is. */
    fighter?: FighterIdentityData;
    fighterHref?: string;
    plan: Pick<TrainingPlan, "id" | "title"> | null;
    /** Exercise library by id. */
    exercises: Record<string, Exercise>;
    videos: Video[];
    /** Null while coach feedback isn't available, which leaves the card out. */
    feedback: CoachFeedback[] | null;
    /** Clearance conflicts for an upcoming session (empty for past sessions). */
    conflicts: ClearanceConflict[];
    /** Coach: opens the feedback dialog. */
    feedbackAction?: ReactNode;
    /** Coach: upload footage for this session. */
    videoAction?: ReactNode;
    /** What the training service keeps (`usesTrainingServiceForms`): no exercise list, target intensity or coach rating. */
    serviceForm: boolean;
    locale?: Locale;
}

/** Everything about one training session. Shared by the fighter and coach views. */
export function SessionDetail({
    session,
    audience,
    now,
    coachName,
    coachNames,
    fighter,
    fighterHref,
    plan,
    exercises,
    videos,
    feedback,
    conflicts,
    feedbackAction,
    videoAction,
    serviceForm,
    locale = "en",
}: SessionDetailProps) {
    const t = createTranslator(locale);
    const started = session.scheduledAt <= now;
    const awaitingResult = started && !session.result && (session.status === "scheduled" || session.status === "in_progress");

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                {session.status === "cancelled" && (
                    <Callout tone="neutral" icon={Ban} title={t("training.sessionDetail.cancelledTitle")}>
                        {session.cancellationReason ?? t("training.sessionDetail.noCancellationReason")}
                    </Callout>
                )}
                {session.status === "missed" && (
                    <Callout tone="warning" icon={CalendarX2} title={t("training.sessionDetail.missedTitle")}>
                        {audience === "fighter"
                            ? t("training.sessionDetail.missedFighterDesc")
                            : t("training.sessionDetail.missedCoachDesc")}
                    </Callout>
                )}
                {conflicts.length > 0 && <ClearanceNote conflicts={conflicts} audience={audience} t={t} locale={locale} />}

                {session.result ? (
                    <ResultCard session={session} result={session.result} withRating={!serviceForm} t={t} locale={locale} />
                ) : (
                    awaitingResult && (
                        <Card>
                            <CardHeader title={t("training.sessionDetail.resultTitle")} icon={<ListChecks />} />
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<ListChecks />}
                                    title={t("training.sessionDetail.resultNotRecorded")}
                                    description={
                                        serviceForm
                                            ? audience === "fighter"
                                                ? t("training.sessionDetail.resultDescServiceFighter")
                                                : session.status === "in_progress"
                                                  ? t("training.sessionDetail.resultDescServiceCoachInProgress")
                                                  : t("training.sessionDetail.resultDescServiceCoachScheduled")
                                            : audience === "fighter"
                                              ? t("training.sessionDetail.resultDescDemoFighter")
                                              : t("training.sessionDetail.resultDescDemoCoach")
                                    }
                                />
                            </CardContent>
                        </Card>
                    )
                )}

                {!serviceForm && <ExercisesCard session={session} exercises={exercises} t={t} />}

                {feedback && (
                    <Card>
                        <CardHeader
                            title={t("training.sessionDetail.feedbackTitle")}
                            description={t("training.sessionDetail.feedbackDesc")}
                            icon={<MessageSquare />}
                            action={feedbackAction}
                        />
                        <CardContent>
                            {feedback.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<MessageSquare />}
                                    title={t("training.sessionDetail.feedbackEmptyTitle")}
                                    description={
                                        audience === "fighter"
                                            ? t("training.sessionDetail.feedbackEmptyFighter")
                                            : t("training.sessionDetail.feedbackEmptyCoach")
                                    }
                                />
                            ) : (
                                <ul className="flex flex-col divide-y divide-border">
                                    {feedback.map((item) => (
                                        <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                            <CoachFeedbackItem
                                                feedback={item}
                                                coachName={coachNames[item.coachId] ?? t("training.plan.coach")}
                                                now={now}
                                                videoHref={item.videoId ? videoHref(audience, item.videoId) : undefined}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="flex min-w-0 flex-col gap-6">
                <DetailsCard session={session} audience={audience} coachName={coachName} fighter={fighter} fighterHref={fighterHref} plan={plan} withTarget={!serviceForm} t={t} locale={locale} />

                <Card>
                    <CardHeader title={t("training.sessionDetail.videosTitle")} icon={<VideoIcon />} />
                    <CardContent>
                        {videos.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<VideoIcon />}
                                title={t("training.sessionDetail.videosEmptyTitle")}
                                description={
                                    audience === "fighter"
                                        ? t("training.sessionDetail.videosEmptyFighter")
                                        : t("training.sessionDetail.videosEmptyCoach")
                                }
                                action={videoAction}
                            />
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {videos.map((video) => (
                                    <li key={video.id} className="relative flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-muted/50">
                                        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                                            <VideoIcon className="size-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={videoHref(audience, video.id)}
                                                className="rounded-sm text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:underline"
                                            >
                                                {video.title}
                                            </Link>
                                            <p className="mt-0.5 text-xs text-fg-muted">
                                                {formatClock(video.durationSec)} · {t("training.sessionDetail.videoUploaded", { date: formatDate(video.uploadedAt, locale) })}
                                            </p>
                                            <VideoStatusBadge locale={locale} status={video.status} size="sm" className="mt-1.5" />
                                        </div>
                                    </li>
                                ))}
                                {videoAction && <li className="pt-1">{videoAction}</li>}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function ClearanceNote({ conflicts, audience, t, locale }: { conflicts: ClearanceConflict[]; audience: TrainingAudience; t: Translator; locale: Locale }) {
    const blocked = conflicts.some((c) => c.severity === "block");
    return (
        <Callout
            tone={blocked ? "danger" : "warning"}
            icon={ShieldAlert}
            title={blocked ? t("training.sessionDetail.clearanceConflictTitle") : t("training.sessionDetail.clearanceRestrictionsTitle")}
            action={
                <Link
                    href={audience === "fighter" ? routes.fighter.health : routes.coach.clearance}
                    className="text-sm font-medium text-primary-soft-fg hover:underline"
                >
                    {t("training.sessionDetail.viewClearance")}
                </Link>
            }
        >
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {conflicts.map((conflict, index) => (
                    <li key={index}>{clearanceConflictMessage(t, conflict, locale)}</li>
                ))}
            </ul>
            <p className="mt-1.5">
                {audience === "fighter"
                    ? t("training.sessionDetail.clearanceNoteFighter")
                    : blocked
                      ? t("training.sessionDetail.clearanceNoteCoachBlocked")
                      : t("training.sessionDetail.clearanceNoteCoachWarn")}
            </p>
        </Callout>
    );
}

function ResultCard({ session, result, withRating, t, locale }: { session: TrainingSession; result: SessionResult; withRating: boolean; t: Translator; locale: Locale }) {
    const durationDelta = result.actualDurationMin !== null && session.durationMin !== null ? result.actualDurationMin - session.durationMin : null;
    return (
        <Card>
            <CardHeader
                title={t("training.sessionDetail.resultTitle")}
                description={
                    <>
                        {t("training.sessionDetail.recordedAt", { date: "" })} <time dateTime={result.completedAt}>{formatDateTime(result.completedAt, locale)}</time>
                    </>
                }
                icon={<ListChecks />}
            />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricTile
                        label={t("training.sessionDetail.actualDuration")}
                        value={result.actualDurationMin === null ? NOT_RECORDED : formatMinutes(result.actualDurationMin)}
                        hint={
                            durationDelta === null
                                ? undefined
                                : durationDelta === 0
                                  ? t("training.sessionDetail.asPlanned")
                                  : t("training.sessionDetail.plannedDurationHint", { min: formatMinutes(session.durationMin ?? 0) })
                        }
                    />
                    <MetricTile
                        label={t("training.sessionDetail.sessionRpe")}
                        value={result.rpe ?? NOT_RECORDED}
                        unit={result.rpe === null ? undefined : rpeLabel(result.rpe)}
                        hint={session.targetRpe === null ? undefined : t("training.sessionDetail.targetRpeHint", { rpe: session.targetRpe })}
                    />
                    <MetricTile label={t("training.sessionDetail.roundsCompleted")} value={result.roundsCompleted} />
                    {withRating && (
                        <MetricTile
                            label={t("training.sessionDetail.coachRating")}
                            value={
                                result.coachRating === null ? (
                                    NOT_RECORDED
                                ) : (
                                    <CoachRating locale={locale} rating={result.coachRating} className="flex-wrap gap-y-1 text-base font-normal" />
                                )
                            }
                        />
                    )}
                </div>
                {result.summary && (
                    <div className="rounded-lg border border-border px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t("training.sessionDetail.coachSummary")}</p>
                        <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{result.summary}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ExercisesCard({ session, exercises, t }: { session: TrainingSession; exercises: Record<string, Exercise>; t: Translator }) {
    const rounds = sum(session.exercises.map((e) => e.rounds ?? 0));
    const completedSession = session.status === "completed";
    const doneCount = session.exercises.filter((e) => e.completed).length;
    const description =
        session.exercises.length === 0
            ? undefined
            : [pluralize(session.exercises.length, "exercise"), rounds > 0 ? plural(t, "training.sessionDetail.roundsCount", rounds) : null, completedSession ? t("training.sessionDetail.exercisesDoneCount", { done: doneCount }) : null]
                  .filter(Boolean)
                  .join(" · ");

    return (
        <Card>
            <CardHeader title={t("training.sessionDetail.exercisesTitle")} description={description} icon={<Dumbbell />} />
            {session.exercises.length === 0 ? (
                <CardContent>
                    <EmptyState compact icon={<Dumbbell />} title={t("training.sessionDetail.exercisesEmptyTitle")} description={t("training.sessionDetail.exercisesEmptyDesc")} />
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <Table caption={t("training.sessionDetail.captionExercises")} className="relative">
                        <THead>
                            <tr>
                                <TH className="w-10">{t("training.sessionDetail.thNum")}</TH>
                                <TH>{t("training.sessionDetail.thExercise")}</TH>
                                <TH>{t("training.sessionDetail.thCategory")}</TH>
                                <TH>{t("training.sessionDetail.thVolume")}</TH>
                                <TH>{t("training.sessionDetail.thNotes")}</TH>
                                <TH className="text-center">{t("training.sessionDetail.thDone")}</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {session.exercises.map((item, index) => {
                                const exercise = exercises[item.exerciseId];
                                return (
                                    <TR key={`${item.exerciseId}-${index}`}>
                                        <TD className="text-fg-subtle">{index + 1}</TD>
                                        <TD className="min-w-48 font-medium">{exercise?.name ?? t("training.sessionDetail.exerciseNoLongerInLibrary")}</TD>
                                        <TD className="whitespace-nowrap text-fg-muted">{exercise ? exerciseCategoryLabel(t, exercise.category) : "—"}</TD>
                                        <TD className="whitespace-nowrap">{exerciseVolume(item) ?? <span className="text-fg-subtle">—</span>}</TD>
                                        <TD className="min-w-40 text-fg-muted">{item.notes ?? <span className="text-fg-subtle">—</span>}</TD>
                                        <TD className="text-center">
                                            {!completedSession ? (
                                                <>
                                                    <span aria-hidden className="text-fg-subtle">
                                                        —
                                                    </span>
                                                    <span className="sr-only">{t("training.sessionDetail.notYetDone")}</span>
                                                </>
                                            ) : item.completed ? (
                                                <CircleCheck role="img" aria-label={t("training.sessionDetail.completedAria")} className="mx-auto size-[18px] text-success-fg" />
                                            ) : (
                                                <CircleDashed role="img" aria-label={t("training.sessionDetail.notCompletedAria")} className="mx-auto size-[18px] text-fg-subtle" />
                                            )}
                                        </TD>
                                    </TR>
                                );
                            })}
                        </TBody>
                    </Table>
                </div>
            )}
        </Card>
    );
}

function DetailsCard({
    session,
    audience,
    coachName,
    fighter,
    fighterHref,
    plan,
    withTarget,
    t,
    locale,
}: {
    session: TrainingSession;
    audience: TrainingAudience;
    coachName: string;
    fighter?: FighterIdentityData;
    fighterHref?: string;
    plan: Pick<TrainingPlan, "id" | "title"> | null;
    /** Show the planned intensity, which the training service doesn't keep. */
    withTarget: boolean;
    t: Translator;
    locale: Locale;
}) {
    const end = session.durationMin === null ? null : new Date(plannedEndMs(session)).toISOString();
    const items: DescriptionItem[] = [];
    if (fighter) {
        items.push({ label: t("training.sessionDetail.fighter"), value: <FighterIdentity fighter={fighter} href={fighterHref} size="sm" className="mt-1" />, wide: true });
    }
    items.push(
        { label: t("training.sessionDetail.date"), value: <time dateTime={session.scheduledAt} className={session.status === "pending" ? "line-through text-fg-muted" : undefined}>{formatWeekdayDate(session.scheduledAt, locale)}</time> },
        {
            label: t("training.sessionDetail.time"),
            value: (
                <span className={session.status === "pending" ? "line-through text-fg-muted" : undefined}>
                    <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt, locale)}</time>
                    {end && (
                        <>
                            {" – "}
                            <time dateTime={end}>{formatTime(end, locale)}</time>
                        </>
                    )}
                </span>
            ),
        },
        { label: t("training.sessionDetail.plannedDuration"), value: session.durationMin === null ? NOT_RECORDED : formatMinutes(session.durationMin) },
        ...(withTarget ? [{ label: t("training.sessionDetail.targetIntensity"), value: rpeText(session.targetRpe) ?? NOT_RECORDED }] : []),
        { label: t("training.sessionDetail.location"), value: session.location || NOT_RECORDED, wide: true },
        { label: t("training.sessionDetail.coach"), value: coachName, wide: true },
        {
            label: t("training.sessionDetail.trainingPlan"),
            wide: true,
            value: plan ? (
                <Link
                    href={audience === "fighter" ? routes.fighter.plan(plan.id) : routes.coach.plan(plan.id)}
                    className="text-primary-soft-fg hover:underline"
                >
                    {plan.title}
                </Link>
            ) : (
                <span className="font-normal text-fg-muted">{t("training.sessionDetail.notPartOfPlan")}</span>
            ),
        },
    );
    if (session.notes) items.push({ label: t("training.sessionDetail.sessionNotes"), value: <span className="font-normal whitespace-pre-line">{session.notes}</span>, wide: true });

    return (
        <Card>
            <CardHeader title={t("training.sessionDetail.detailsTitle")} icon={<Clock />} />
            <CardContent>
                <DescriptionList items={items} />
            </CardContent>
        </Card>
    );
}
