import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SessionDetail, SessionHeaderMeta } from "@/components/training/session-detail";
import { getCoachNames, getExerciseLibrary } from "@/components/training/training-data";
import { requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { platformFeatureAvailable, usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getPlan, getSession, listCoachFeedback, loadSessionClearanceConflicts } from "@/lib/services/training";
import { listVideos } from "@/lib/services/videos";
import { plannedEndMs } from "@/components/training/training-utils";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

export async function generateMetadata({ params }: PageProps<"/fighter/training/sessions/[sessionId]">): Promise<Metadata> {
    const [{ sessionId }, user, { t }] = await Promise.all([params, getCurrentUser(), getTranslator()]);
    const session = await loadSession(sessionId);
    const visible = session && user?.role === "fighter" && session.fighterId === user.profileId;
    return { title: visible ? session.title : t("training.sessionPage.eyebrowFighter") };
}

export default async function FighterSessionPage({ params }: PageProps<"/fighter/training/sessions/[sessionId]">) {
    const user = await requireRole("fighter");
    const [{ sessionId }, { t }] = await Promise.all([params, getTranslator()]);
    // Reference lookups start with the session read; everything about the session waits for the access check.
    const [session, coachNames, exercises] = await Promise.all([loadSession(sessionId), getCoachNames(), getExerciseLibrary()]);
    if (!session || session.fighterId !== user.profileId) notFound();
    await requireFighterAccess(user, session.fighterId);

    const now = new Date().toISOString();
    const [videos, feedback, plan] = await Promise.all([
        listVideos({ fighterIds: [session.fighterId] }),
        platformFeatureAvailable("coachFeedback") ? listCoachFeedback({ sessionId: session.id }) : null,
        session.planId ? getPlan(session.planId) : Promise.resolve(null),
    ]);

    const upcoming = (session.status === "scheduled" || session.status === "in_progress") && plannedEndMs(session) >= Date.parse(now);
    const conflicts = upcoming ? await loadSessionClearanceConflicts(session) : [];
    const past = session.scheduledAt < now && !upcoming;

    return (
        <>
            <PageHeader
                eyebrow={t("training.sessionPage.eyebrowFighter")}
                title={session.title}
                back={past ? { href: routes.fighter.history, label: t("training.sessionPage.backHistory") } : { href: routes.fighter.schedule, label: t("training.sessionPage.backSchedule") }}
                meta={<SessionHeaderMeta session={session} />}
            />
            <SessionDetail
                session={session}
                audience="fighter"
                now={now}
                coachName={(session.coachId && coachNames[session.coachId]) || t("training.plan.coach")}
                coachNames={coachNames}
                plan={plan ? { id: plan.id, title: plan.title } : null}
                exercises={exercises}
                videos={videos.filter((video) => video.sessionId === session.id || session.videoIds.includes(video.id))}
                feedback={feedback}
                conflicts={conflicts}
                serviceForm={usesTrainingServiceForms()}
            />
        </>
    );
}
