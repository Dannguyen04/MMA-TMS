import { PenLine, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AddFeedbackButton, CancelSessionButton, RecordResultButton } from "@/components/training/session-coach-actions";
import { SessionDetail, SessionHeaderMeta } from "@/components/training/session-detail";
import { getCoachNames, getExerciseLibrary, toIdentity } from "@/components/training/training-data";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getPlan, getSession, getSessionClearanceConflicts, listCoachFeedback } from "@/lib/services/training";
import { listVideos } from "@/lib/services/videos";
import { sum } from "@/lib/utils";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

export async function generateMetadata({ params }: PageProps<"/coach/sessions/[sessionId]">): Promise<Metadata> {
    const [{ sessionId }, user] = await Promise.all([params, getCurrentUser()]);
    const session = await loadSession(sessionId);
    return { title: session && user && canAccessFighter(user, session.fighterId) ? session.title : "Training session" };
}

export default async function CoachSessionPage({ params }: PageProps<"/coach/sessions/[sessionId]">) {
    const user = await requireRole("coach");
    const { sessionId } = await params;
    // Reference lookups start with the session read; everything about the session waits for the access check.
    const [session, coachNames, exercises] = await Promise.all([loadSession(sessionId), getCoachNames(), getExerciseLibrary()]);
    if (!session) notFound();
    const fighter = requireFighterAccess(user, session.fighterId);

    const current = new Date();
    const now = current.toISOString();
    const [videos, feedback, plan] = await Promise.all([
        listVideos({ fighterIds: [fighter.id] }),
        listCoachFeedback({ sessionId: session.id }),
        session.planId ? getPlan(session.planId) : Promise.resolve(null),
    ]);

    const active = session.status === "scheduled" || session.status === "in_progress";
    const started = session.scheduledAt <= now;
    const upcoming = active && Date.parse(session.scheduledAt) + session.durationMin * 60_000 >= current.getTime();
    const conflicts = upcoming ? getSessionClearanceConflicts(session) : [];
    const canRecord = started && (active || session.status === "completed");
    const canUpload = session.status !== "cancelled" && session.status !== "missed";
    const firstName = fighter.name.split(" ")[0];

    const recordButton = (
        <RecordResultButton
            variant={session.status === "completed" ? "secondary" : "primary"}
            sessionId={session.id}
            sessionTitle={session.title}
            plannedDurationMin={session.durationMin}
            targetRpe={session.targetRpe}
            plannedRounds={sum(session.exercises.map((e) => e.rounds ?? 0))}
            exercises={session.exercises.map((e) => ({ exerciseId: e.exerciseId, name: exercises[e.exerciseId]?.name ?? "Exercise", completed: e.completed }))}
            result={session.result}
        />
    );
    const uploadLink = (
        <ButtonLink href={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id, session: session.id })} variant="secondary" size="sm">
            <Upload aria-hidden />
            Upload video
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                eyebrow={`Training session · ${fighter.name}`}
                title={session.title}
                back={{ href: routes.coach.sessions, label: "Sessions" }}
                meta={<SessionHeaderMeta session={session} />}
                actions={
                    <>
                        {session.status === "scheduled" && (
                            <ButtonLink href={routes.coach.editSession(session.id)} variant="secondary">
                                <PenLine aria-hidden />
                                Edit
                            </ButtonLink>
                        )}
                        {active && (
                            <CancelSessionButton sessionId={session.id} sessionTitle={session.title} fighterName={fighter.name} when={formatDateTime(session.scheduledAt)} />
                        )}
                        {canRecord && recordButton}
                    </>
                }
            />
            <SessionDetail
                session={session}
                audience="coach"
                now={now}
                coachName={coachNames[session.coachId] ?? "Coach"}
                coachNames={coachNames}
                fighter={toIdentity(fighter)}
                fighterHref={routes.coach.fighter(fighter.id)}
                plan={plan ? { id: plan.id, title: plan.title } : null}
                exercises={exercises}
                videos={videos.filter((video) => video.sessionId === session.id || session.videoIds.includes(video.id))}
                feedback={feedback}
                conflicts={conflicts}
                feedbackAction={<AddFeedbackButton sessionId={session.id} fighterName={firstName} size="sm" />}
                videoAction={canUpload ? uploadLink : undefined}
            />
        </>
    );
}
