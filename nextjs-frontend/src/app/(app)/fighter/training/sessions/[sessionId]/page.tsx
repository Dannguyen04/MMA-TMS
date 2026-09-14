import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SessionDetail, SessionHeaderMeta } from "@/components/training/session-detail";
import { getCoachNames, getExerciseLibrary } from "@/components/training/training-data";
import { requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { getPlan, getSession, getSessionClearanceConflicts, listCoachFeedback } from "@/lib/services/training";
import { listVideos } from "@/lib/services/videos";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

export async function generateMetadata({ params }: PageProps<"/fighter/training/sessions/[sessionId]">): Promise<Metadata> {
    const [{ sessionId }, user] = await Promise.all([params, getCurrentUser()]);
    const session = await loadSession(sessionId);
    const visible = session && user?.role === "fighter" && session.fighterId === user.profileId;
    return { title: visible ? session.title : "Training session" };
}

export default async function FighterSessionPage({ params }: PageProps<"/fighter/training/sessions/[sessionId]">) {
    const user = await requireRole("fighter");
    const { sessionId } = await params;
    // Reference lookups start with the session read; everything about the session waits for the access check.
    const [session, coachNames, exercises] = await Promise.all([loadSession(sessionId), getCoachNames(), getExerciseLibrary()]);
    if (!session || session.fighterId !== user.profileId) notFound();
    requireFighterAccess(user, session.fighterId);

    const now = new Date().toISOString();
    const [videos, feedback, plan] = await Promise.all([
        listVideos({ fighterIds: [session.fighterId] }),
        listCoachFeedback({ sessionId: session.id }),
        session.planId ? getPlan(session.planId) : Promise.resolve(null),
    ]);

    const upcoming = (session.status === "scheduled" || session.status === "in_progress") && Date.parse(session.scheduledAt) + session.durationMin * 60_000 >= Date.parse(now);
    const conflicts = upcoming ? getSessionClearanceConflicts(session) : [];
    const past = session.scheduledAt < now && !upcoming;

    return (
        <>
            <PageHeader
                eyebrow="Training session"
                title={session.title}
                back={past ? { href: routes.fighter.history, label: "Training history" } : { href: routes.fighter.schedule, label: "Schedule" }}
                meta={<SessionHeaderMeta session={session} />}
            />
            <SessionDetail
                session={session}
                audience="fighter"
                now={now}
                coachName={coachNames[session.coachId] ?? "Coach"}
                coachNames={coachNames}
                plan={plan ? { id: plan.id, title: plan.title } : null}
                exercises={exercises}
                videos={videos.filter((video) => video.sessionId === session.id || session.videoIds.includes(video.id))}
                feedback={feedback}
                conflicts={conflicts}
            />
        </>
    );
}
