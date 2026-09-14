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
import { EXERCISE_CATEGORY_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { ClearanceConflict } from "@/lib/domain/rules";
import type { CoachFeedback, Exercise, SessionResult, TrainingPlan, TrainingSession, Video } from "@/lib/domain/types";
import { formatClock, formatDate, formatDateTime, formatMinutes, formatTime, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { sum } from "@/lib/utils";
import { Callout } from "./callout";
import { videoHref, type TrainingAudience } from "./session-table";
import { exerciseVolume, rpeLabel } from "./training-utils";

const MINUTE_MS = 60_000;

/** Status, type and start time for the session page header. */
export function SessionHeaderMeta({ session }: { session: TrainingSession }) {
    const TypeIcon = TRAINING_TYPE_ICONS[session.type];
    return (
        <>
            <SessionStatusBadge status={session.status} />
            <Badge variant="outline" icon={TypeIcon}>
                {TRAINING_TYPE_LABELS[session.type]}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
                <Clock aria-hidden className="size-3.5 text-fg-subtle" />
                <time dateTime={session.scheduledAt}>{formatDateTime(session.scheduledAt)}</time>
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
    feedback: CoachFeedback[];
    /** Clearance conflicts for an upcoming session (empty for past sessions). */
    conflicts: ClearanceConflict[];
    /** Coach: opens the feedback dialog. */
    feedbackAction?: ReactNode;
    /** Coach: upload footage for this session. */
    videoAction?: ReactNode;
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
}: SessionDetailProps) {
    const started = session.scheduledAt <= now;
    const awaitingResult = started && !session.result && (session.status === "scheduled" || session.status === "in_progress");

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                {session.status === "cancelled" && (
                    <Callout tone="neutral" icon={Ban} title="This session was cancelled">
                        {session.cancellationReason ?? "No reason was recorded."}
                    </Callout>
                )}
                {session.status === "missed" && (
                    <Callout tone="warning" icon={CalendarX2} title="This session was missed">
                        {audience === "fighter"
                            ? "No result was recorded. If something kept you from training, let your coach know so the plan can adapt."
                            : "No result was recorded. Check in with the fighter and adjust the plan if needed."}
                    </Callout>
                )}
                {conflicts.length > 0 && <ClearanceNote conflicts={conflicts} audience={audience} />}

                {session.result ? (
                    <ResultCard session={session} result={session.result} />
                ) : (
                    awaitingResult && (
                        <Card>
                            <CardHeader title="Session result" icon={<ListChecks />} />
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<ListChecks />}
                                    title="Result not recorded yet"
                                    description={
                                        audience === "fighter"
                                            ? "Your coach records duration, RPE and a rating after the session."
                                            : "Use Record result to log the actual duration, the fighter's RPE and your rating so adherence and load stay accurate."
                                    }
                                />
                            </CardContent>
                        </Card>
                    )
                )}

                <ExercisesCard session={session} exercises={exercises} />

                <Card>
                    <CardHeader
                        title="Coach feedback"
                        description="Notes on this session"
                        icon={<MessageSquare />}
                        action={feedbackAction}
                    />
                    <CardContent>
                        {feedback.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<MessageSquare />}
                                title="No feedback yet"
                                description={
                                    audience === "fighter"
                                        ? "Feedback from your coach about this session will appear here."
                                        : "Share praise, corrections or notes so the fighter knows what to work on."
                                }
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-border">
                                {feedback.map((item) => (
                                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                        <CoachFeedbackItem
                                            feedback={item}
                                            coachName={coachNames[item.coachId] ?? "Coach"}
                                            now={now}
                                            videoHref={item.videoId ? videoHref(audience, item.videoId) : undefined}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
                <DetailsCard session={session} audience={audience} coachName={coachName} fighter={fighter} fighterHref={fighterHref} plan={plan} />

                <Card>
                    <CardHeader title="Linked videos" icon={<VideoIcon />} />
                    <CardContent>
                        {videos.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<VideoIcon />}
                                title="No footage linked"
                                description={
                                    audience === "fighter"
                                        ? "Videos uploaded for this session appear here with their AI analysis status."
                                        : "Upload footage from this session to run AI analysis."
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
                                                {formatClock(video.durationSec)} · uploaded {formatDate(video.uploadedAt)}
                                            </p>
                                            <VideoStatusBadge status={video.status} size="sm" className="mt-1.5" />
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

function ClearanceNote({ conflicts, audience }: { conflicts: ClearanceConflict[]; audience: TrainingAudience }) {
    const blocked = conflicts.some((c) => c.severity === "block");
    return (
        <Callout
            tone={blocked ? "danger" : "warning"}
            icon={ShieldAlert}
            title={blocked ? "This session conflicts with the Medical Clearance" : "Medical Clearance restrictions apply to this session"}
            action={
                <Link
                    href={audience === "fighter" ? routes.fighter.health : routes.coach.clearance}
                    className="text-sm font-medium text-primary-soft-fg hover:underline"
                >
                    View clearance
                </Link>
            }
        >
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {conflicts.map((conflict) => (
                    <li key={conflict.message}>{conflict.message}</li>
                ))}
            </ul>
            <p className="mt-1.5">
                {audience === "fighter"
                    ? "Follow your doctor's restrictions. Talk to your coach before training if the session doesn't match them."
                    : blocked
                      ? "Adjust or cancel this session. Only the sports doctor can change the clearance."
                      : "Adapt the drills to protect the affected area, or talk to the sports doctor."}
            </p>
        </Callout>
    );
}

function ResultCard({ session, result }: { session: TrainingSession; result: SessionResult }) {
    const durationDelta = result.actualDurationMin - session.durationMin;
    return (
        <Card>
            <CardHeader
                title="Session result"
                description={
                    <>
                        Recorded <time dateTime={result.completedAt}>{formatDateTime(result.completedAt)}</time>
                    </>
                }
                icon={<ListChecks />}
            />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricTile
                        label="Actual duration"
                        value={formatMinutes(result.actualDurationMin)}
                        hint={durationDelta === 0 ? "As planned" : `Planned ${formatMinutes(session.durationMin)}`}
                    />
                    <MetricTile label="Session RPE" value={result.rpe} unit={rpeLabel(result.rpe)} hint={`Target ${session.targetRpe}`} />
                    <MetricTile label="Rounds completed" value={result.roundsCompleted} />
                    <MetricTile label="Coach rating" value={<CoachRating rating={result.coachRating} className="flex-wrap gap-y-1 text-base font-normal" />} />
                </div>
                {result.summary && (
                    <div className="rounded-lg border border-border px-4 py-3">
                        <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Coach summary</p>
                        <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{result.summary}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ExercisesCard({ session, exercises }: { session: TrainingSession; exercises: Record<string, Exercise> }) {
    const rounds = sum(session.exercises.map((e) => e.rounds ?? 0));
    const completedSession = session.status === "completed";
    const doneCount = session.exercises.filter((e) => e.completed).length;
    const description =
        session.exercises.length === 0
            ? undefined
            : [pluralize(session.exercises.length, "exercise"), rounds > 0 ? pluralize(rounds, "round") : null, completedSession ? `${doneCount} done` : null]
                  .filter(Boolean)
                  .join(" · ");

    return (
        <Card>
            <CardHeader title="Exercises" description={description} icon={<Dumbbell />} />
            {session.exercises.length === 0 ? (
                <CardContent>
                    <EmptyState compact icon={<Dumbbell />} title="No exercises listed" description="This session has no planned drills." />
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <Table caption="Exercises in this session" className="relative">
                        <THead>
                            <tr>
                                <TH className="w-10">#</TH>
                                <TH>Exercise</TH>
                                <TH>Category</TH>
                                <TH>Volume</TH>
                                <TH>Notes</TH>
                                <TH className="text-center">Done</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {session.exercises.map((item, index) => {
                                const exercise = exercises[item.exerciseId];
                                return (
                                    <TR key={`${item.exerciseId}-${index}`}>
                                        <TD className="text-fg-subtle">{index + 1}</TD>
                                        <TD className="min-w-48 font-medium">{exercise?.name ?? "Exercise no longer in library"}</TD>
                                        <TD className="whitespace-nowrap text-fg-muted">{exercise ? EXERCISE_CATEGORY_LABELS[exercise.category] : "—"}</TD>
                                        <TD className="whitespace-nowrap">{exerciseVolume(item) ?? <span className="text-fg-subtle">—</span>}</TD>
                                        <TD className="min-w-40 text-fg-muted">{item.notes ?? <span className="text-fg-subtle">—</span>}</TD>
                                        <TD className="text-center">
                                            {!completedSession ? (
                                                <>
                                                    <span aria-hidden className="text-fg-subtle">
                                                        —
                                                    </span>
                                                    <span className="sr-only">Not yet done</span>
                                                </>
                                            ) : item.completed ? (
                                                <CircleCheck role="img" aria-label="Completed" className="mx-auto size-[18px] text-success-fg" />
                                            ) : (
                                                <CircleDashed role="img" aria-label="Not completed" className="mx-auto size-[18px] text-fg-subtle" />
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
}: {
    session: TrainingSession;
    audience: TrainingAudience;
    coachName: string;
    fighter?: FighterIdentityData;
    fighterHref?: string;
    plan: Pick<TrainingPlan, "id" | "title"> | null;
}) {
    const end = new Date(Date.parse(session.scheduledAt) + session.durationMin * MINUTE_MS).toISOString();
    const items: DescriptionItem[] = [];
    if (fighter) {
        items.push({ label: "Fighter", value: <FighterIdentity fighter={fighter} href={fighterHref} size="sm" className="mt-1" />, wide: true });
    }
    items.push(
        { label: "Date", value: <time dateTime={session.scheduledAt}>{formatWeekdayDate(session.scheduledAt)}</time> },
        {
            label: "Time",
            value: (
                <>
                    <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time> – <time dateTime={end}>{formatTime(end)}</time>
                </>
            ),
        },
        { label: "Planned duration", value: formatMinutes(session.durationMin) },
        { label: "Target intensity", value: `RPE ${session.targetRpe} · ${rpeLabel(session.targetRpe)}` },
        { label: "Location", value: session.location, wide: true },
        { label: "Coach", value: coachName, wide: true },
        {
            label: "Training plan",
            wide: true,
            value: plan ? (
                <Link
                    href={audience === "fighter" ? routes.fighter.plan(plan.id) : routes.coach.plan(plan.id)}
                    className="text-primary-soft-fg hover:underline"
                >
                    {plan.title}
                </Link>
            ) : (
                <span className="font-normal text-fg-muted">Not part of a plan</span>
            ),
        },
    );
    if (session.notes) items.push({ label: "Session notes", value: <span className="font-normal whitespace-pre-line">{session.notes}</span>, wide: true });

    return (
        <Card>
            <CardHeader title="Session details" icon={<Clock />} />
            <CardContent>
                <DescriptionList items={items} />
            </CardContent>
        </Card>
    );
}

