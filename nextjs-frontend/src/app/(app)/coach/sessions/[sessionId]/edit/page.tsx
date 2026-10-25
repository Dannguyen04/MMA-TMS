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
import { sessionStatusLabel } from "@/lib/domain/labels";
import { dayKey, formatTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getSession, listExercises, listPlans, listSessions } from "@/lib/services/training";
import { MID_RPE } from "@/components/training/training-utils";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

export async function generateMetadata({ params }: PageProps<"/coach/sessions/[sessionId]/edit">): Promise<Metadata> {
    const [{ sessionId }, user, { t }] = await Promise.all([params, getCurrentUser(), getTranslator()]);
    const session = await loadSession(sessionId);
    return { title: session && user && canAccessFighter(user, session.fighterId) ? `${t("training.sessionPage.edit")} ${session.title}` : t("training.sessionForm.titleEdit") };
}

export default async function EditSessionPage({ params }: PageProps<"/coach/sessions/[sessionId]/edit">) {
    const user = await requireRole("coach");
    const [{ sessionId }, { t }] = await Promise.all([params, getTranslator()]);
    const serviceForm = usesTrainingServiceForms();
    // Exercises are part of the demo's session form only.
    const [session, library] = await Promise.all([loadSession(sessionId), serviceForm ? [] : listExercises()]);
    if (!session) notFound();
    const fighter = await requireFighterAccess(user, session.fighterId);
    const back = { href: routes.coach.session(session.id), label: t("training.sessionPage.backToSession") };

    if (session.status !== "scheduled") {
        return (
            <>
                <PageHeader eyebrow={t("training.sessionPage.editEyebrow")} title={session.title} back={back} />
                <EmptyState
                    icon={<CalendarX2 />}
                    title={t("training.sessionPage.notScheduledTitle", { status: sessionStatusLabel(t, session.status).toLowerCase() })}
                    description={t("training.sessionPage.notScheduledDesc")}
                    action={
                        <>
                            <ButtonLink href={back.href} variant="secondary">
                                {t("training.sessionPage.backToSession")}
                            </ButtonLink>
                            <ButtonLink href={hrefWith(routes.coach.newSession, {}, { fighter: fighter.id })}>{t("training.sessionPage.scheduleNew")}</ButtonLink>
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
        durationMin: session.durationMin === null ? "" : String(session.durationMin),
        location: session.location,
        // The form needs an intensity; a session without one starts mid-scale.
        targetRpe: session.targetRpe ?? MID_RPE,
        exercises: session.exercises.map(rowFromSessionExercise),
        notes: session.notes ?? "",
    };

    return (
        <>
            <PageHeader
                eyebrow={t("training.sessionPage.editEyebrow")}
                title={session.title}
                description={t("training.sessionForm.descEdit", {
                    name: fighter.name,
                    checkNotice: serviceForm ? "" : t("training.sessionForm.checkNotice"),
                })}
                back={back}
            />
            <SessionForm
                mode="edit"
                action={updateSession.bind(null, session.id)}
                fighters={[toFighterOption(fighter)]}
                plans={plans.map((p) => ({ id: p.id, title: p.title, fighterId: p.fighterId, status: p.status }))}
                library={library}
                clearances={clearances}
                locations={[...new Set(sessions.map((s) => s.location).filter(Boolean))].sort()}
                defaults={defaults}
                now={now}
                cancelHref={back.href}
                serviceForm={serviceForm}
            />
        </>
    );
}
