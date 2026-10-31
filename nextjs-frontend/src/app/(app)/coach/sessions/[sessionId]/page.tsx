import { CalendarPlus, PenLine, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { FlashToast } from "@/components/medical/flash-toast";
import { ButtonLink } from "@/components/ui/button";
import type { ToastInput } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { AddFeedbackButton, CancelSessionButton, MarkMissedButton, RecordResultButton, StartSessionButton } from "@/components/training/session-coach-actions";
import { SessionDetail, SessionHeaderMeta } from "@/components/training/session-detail";
import { getCoachNames, getExerciseLibrary, toIdentity } from "@/components/training/training-data";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { hrefWith, type SearchParams } from "@/lib/query";
import { routes } from "@/lib/routes";
import { platformFeatureAvailable, usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getPlan, getSession, listCoachFeedback, loadSessionClearanceConflicts } from "@/lib/services/training";
import { listVideos } from "@/lib/services/videos";
import { param, sum } from "@/lib/utils";
import { plannedEndMs } from "@/components/training/training-utils";

/** One session read per request, shared by the metadata and the page. */
const loadSession = cache(getSession);

const count = (value: string | string[] | undefined) => Math.max(0, Math.floor(Number(param(value)) || 0));

/** The toast after "Repeat weekly" (`?notice=repeated` from `createSession`), or null. */
function repeatNotice(query: SearchParams, t: Translator): ToastInput | null {
    if (param(query.notice) !== "repeated") return null;
    const created = Math.max(1, count(query.created));
    const failed = count(query.failed);
    const skipped = count(query.skipped);
    const skippedText = skipped > 0 ? plural(t, "training.repeat.weeksSkipped", skipped) : null;
    if (failed > 0) {
        return {
            title: plural(t, "training.repeat.partialTitle", created + failed, { created }),
            description: [plural(t, "training.repeat.partialDesc", failed), skippedText].filter(Boolean).join(" "),
            tone: "warning",
        };
    }
    return {
        title: plural(t, "training.repeat.doneTitle", created),
        description: [created > 1 ? t("training.repeat.doneDesc") : null, skippedText].filter(Boolean).join(" ") || undefined,
        tone: "success",
    };
}

export async function generateMetadata({ params }: PageProps<"/coach/sessions/[sessionId]">): Promise<Metadata> {
    const [{ sessionId }, user, { t }] = await Promise.all([params, getCurrentUser(), getTranslator()]);
    const session = await loadSession(sessionId);
    return { title: session && user && canAccessFighter(user, session.fighterId) ? session.title : t("training.sessionPage.eyebrowFighter") };
}

export default async function CoachSessionPage({ params, searchParams }: PageProps<"/coach/sessions/[sessionId]">) {
    const user = await requireRole("coach");
    const [{ sessionId }, query, { t, locale }] = await Promise.all([params, searchParams, getTranslator()]);
    // Reference lookups start with the session read; everything about the session waits for the access check.
    const [session, coachNames, exercises] = await Promise.all([loadSession(sessionId), getCoachNames(), getExerciseLibrary()]);
    if (!session) notFound();
    const fighter = await requireFighterAccess(user, session.fighterId);

    const current = new Date();
    const now = current.toISOString();
    const [videos, feedback, plan] = await Promise.all([
        listVideos({ fighterIds: [fighter.id] }),
        platformFeatureAvailable("coachFeedback") ? listCoachFeedback({ sessionId: session.id }) : null,
        session.planId ? getPlan(session.planId) : Promise.resolve(null),
    ]);

    const serviceForm = usesTrainingServiceForms();
    const scheduled = session.status === "scheduled";
    const active = scheduled || session.status === "in_progress";
    const started = session.scheduledAt <= now;
    const upcoming = active && plannedEndMs(session) >= current.getTime();
    const conflicts = upcoming ? await loadSessionClearanceConflicts(session) : [];
    // The demo records a result straight from a scheduled session once it has begun; the training service only
    // completes a session that was started.
    const canRecord = session.status === "completed" || session.status === "in_progress" || (!serviceForm && scheduled && started);
    const transitionProps = { sessionId: session.id, sessionTitle: session.title, fighterName: fighter.name };
    const canUpload = session.status !== "cancelled" && session.status !== "missed";
    const firstName = fighter.name.split(" ")[0];

    const recordButton = (
        <RecordResultButton
            variant={session.status === "completed" || scheduled ? "secondary" : "primary"}
            sessionId={session.id}
            sessionTitle={session.title}
            plannedDurationMin={session.durationMin}
            targetRpe={session.targetRpe}
            plannedRounds={sum(session.exercises.map((e) => e.rounds ?? 0))}
            exercises={session.exercises.map((e) => ({ exerciseId: e.exerciseId, name: exercises[e.exerciseId]?.name ?? t("screens.training.exerciseFallback"), completed: e.completed }))}
            result={session.result}
            serviceForm={serviceForm}
        />
    );
    const uploadLink = (
        <ButtonLink href={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id, session: session.id })} variant="secondary" size="sm">
            <Upload aria-hidden />
            {t("training.sessionPage.uploadVideo")}
        </ButtonLink>
    );

    return (
        <>
            <FlashToast notice={repeatNotice(query, t)} cleanHref={routes.coach.session(session.id)} />
            <PageHeader
                eyebrow={t("training.sessionPage.eyebrowCoach", { name: fighter.name })}
                title={session.title}
                back={{ href: routes.coach.sessions, label: t("training.sessionPage.backSessions") }}
                meta={<SessionHeaderMeta session={session} locale={locale} />}
                actions={
                    <>
                        <ButtonLink href={hrefWith(routes.coach.newSession, {}, { from: session.id })} variant="secondary">
                            <CalendarPlus aria-hidden />
                            {t("training.repeat.scheduleAgain")}
                        </ButtonLink>
                        {scheduled && (
                            <ButtonLink href={routes.coach.editSession(session.id)} variant="secondary">
                                <PenLine aria-hidden />
                                {t("training.sessionPage.edit")}
                            </ButtonLink>
                        )}
                        {scheduled && started && <MarkMissedButton {...transitionProps} />}
                        {active && <CancelSessionButton {...transitionProps} when={formatDateTime(session.scheduledAt, locale)} />}
                        {canRecord && recordButton}
                        {scheduled && <StartSessionButton {...transitionProps} />}
                    </>
                }
            />
            <SessionDetail
                locale={locale}
                session={session}
                audience="coach"
                now={now}
                coachName={(session.coachId && coachNames[session.coachId]) || t("training.plan.coach")}
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
                serviceForm={serviceForm}
            />
        </>
    );
}
