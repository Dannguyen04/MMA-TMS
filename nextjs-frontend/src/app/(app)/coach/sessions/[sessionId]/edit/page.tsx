import { CalendarX2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { rowFromSessionExercise } from "@/components/training/exercise-rows";
import { SessionForm, type SessionFormValues } from "@/components/training/session-form";
import { getClearanceSummaries, toFighterOption } from "@/components/training/training-data";
import { updateSession } from "@/lib/actions/training";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { SESSION_STATUS_LABELS } from "@/lib/domain/labels";
import { dayKey, formatTime } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSession, listExercises, listPlans, listSessions } from "@/lib/services/training";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

export async function generateMetadata({ params }: PageProps<"/coach/sessions/[sessionId]/edit">): Promise<Metadata> {
    const [{ sessionId }, user] = await Promise.all([params, getCurrentUser()]);
    const session = await loadSession(sessionId);
    return { title: session && user && canAccessFighter(user, session.fighterId) ? `Edit ${session.title}` : "Edit session" };
}

export default async function EditSessionPage({ params }: PageProps<"/coach/sessions/[sessionId]/edit">) {
    const user = await requireRole("coach");
    const { sessionId } = await params;
    const [session, library] = await Promise.all([loadSession(sessionId), listExercises()]);
    if (!session) notFound();
    const fighter = requireFighterAccess(user, session.fighterId);
    const back = { href: routes.coach.session(session.id), label: "Back to session" };

    if (session.status !== "scheduled") {
        return (
            <>
                <PageHeader eyebrow="Edit session" title={session.title} back={back} />
                <EmptyState
                    icon={<CalendarX2 />}
                    title={`This session is ${SESSION_STATUS_LABELS[session.status].toLowerCase()}`}
                    description="Only scheduled sessions can be edited. Record or correct the result from the session page instead, or schedule a new session."
                    action={
                        <>
                            <ButtonLink href={back.href} variant="secondary">
                                Back to session
                            </ButtonLink>
                            <ButtonLink href={hrefWith(routes.coach.newSession, {}, { fighter: fighter.id })}>Schedule a new session</ButtonLink>
                        </>
                    }
                />
            </>
        );
    }

    const now = new Date().toISOString();
    const [plans, sessions, clearances] = await Promise.all([
        listPlans({ fighterIds: [fighter.id] }),
        listSessions({ fighterIds: [fighter.id] }),
        getClearanceSummaries([fighter.id], now),
    ]);

    const defaults: SessionFormValues = {
        fighterId: fighter.id,
        planId: session.planId ?? "",
        title: session.title,
        type: session.type,
        date: dayKey(session.scheduledAt),
        time: formatTime(session.scheduledAt),
        durationMin: String(session.durationMin),
        location: session.location,
        targetRpe: session.targetRpe,
        exercises: session.exercises.map(rowFromSessionExercise),
        notes: session.notes ?? "",
    };

    return (
        <>
            <PageHeader
                eyebrow="Edit session"
                title={session.title}
                description={`${fighter.name} is notified about the change. The clearance check runs again as you edit.`}
                back={back}
            />
            <SessionForm
                mode="edit"
                action={updateSession.bind(null, session.id)}
                fighters={[toFighterOption(fighter)]}
                plans={plans.map((p) => ({ id: p.id, title: p.title, fighterId: p.fighterId, status: p.status }))}
                library={library}
                clearances={clearances}
                locations={[...new Set(sessions.map((s) => s.location))].sort()}
                defaults={defaults}
                now={now}
                cancelHref={back.href}
            />
        </>
    );
}
