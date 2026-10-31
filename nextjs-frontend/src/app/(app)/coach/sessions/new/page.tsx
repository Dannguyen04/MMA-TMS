import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { rowFromSessionExercise } from "@/components/training/exercise-rows";
import { SessionForm, type SessionFormValues } from "@/components/training/session-form";
import { getClearanceSummaries, toFighterOption, toSessionFormPlan } from "@/components/training/training-data";
import { createSession } from "@/lib/actions/training";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import { nextWeeklySlot, presetDuration } from "@/lib/domain/training-templates";
import type { TrainingPlan, TrainingType } from "@/lib/domain/types";
import { addDaysToKey, dayKey } from "@/lib/format";
import { parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getSession, listExercises, listPlans, listSessions } from "@/lib/services/training";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Schedule session" };

const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];

const schedulable = (plan: TrainingPlan | undefined) => plan !== undefined && (plan.status === "active" || plan.status === "draft");

export default async function NewSessionPage({ searchParams }: PageProps<"/coach/sessions/new">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);
    const serviceForm = usesTrainingServiceForms();
    const types = serviceForm ? SERVICE_TRAINING_TYPES : TRAINING_TYPES;

    const fighterList = listFighters(user);
    const fromId = param(params.from);
    const [fighters, plans, library, sessions, clearances, fromSession] = await Promise.all([
        fighterList,
        listPlans({ fighterIds: scope }),
        // Exercises are part of the demo's session form only.
        serviceForm ? [] : listExercises(),
        listSessions({ fighterIds: scope }),
        getClearanceSummaries(scopedFighterIds(user, fighterList), now),
        fromId ? getSession(fromId) : Promise.resolve(null),
    ]);

    // "Schedule again" (?from=) copies a session on this coach's roster to the same time a week on.
    const source = fromSession && canAccessFighter(user, fromSession.fighterId) && fighters.some((f) => f.id === fromSession.fighterId) ? fromSession : null;

    // Otherwise prefill from ?plan=, ?fighter= and ?type= — only with records on this coach's roster.
    const requestedPlan = plans.find((p) => p.id === (source ? source.planId : param(params.plan)));
    const plan = schedulable(requestedPlan) ? requestedPlan : undefined;
    const requestedFighter = fighters.find((f) => f.id === (source ? source.fighterId : param(params.fighter)));
    const fighter = plan && !source ? fighters.find((f) => f.id === plan.fighterId) : requestedFighter;
    // Without a plan in the link, the fighter's only active plan is preselected.
    const activePlans = fighter ? plans.filter((p) => p.fighterId === fighter.id && p.status === "active") : [];
    const planId = plan && plan.fighterId === fighter?.id ? plan.id : !source && activePlans.length === 1 ? activePlans[0].id : "";

    const today = dayKey(now);
    const type = (source && parseEnum(source.type, types)) || parseEnum(param(params.type), types) || "pad_work";
    const slot = source ? nextWeeklySlot(source.scheduledAt, now) : null;
    const defaults: SessionFormValues = {
        fighterId: fighter?.id ?? "",
        planId,
        title: source?.title ?? "",
        type,
        date: slot?.date ?? addDaysToKey(today, 1),
        time: slot?.time ?? "17:30",
        durationMin: String(source?.durationMin ?? presetDuration(type)),
        location: source?.location ?? "",
        targetRpe: source?.targetRpe ?? 6,
        exercises: source && !serviceForm ? source.exercises.map(rowFromSessionExercise) : [],
        notes: source?.notes ?? "",
    };
    const locations = [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort();
    const back = source
        ? { href: routes.coach.session(source.id), label: source.title }
        : plan
          ? { href: routes.coach.plan(plan.id), label: plan.title }
          : fighter
            ? { href: routes.coach.fighterTraining(fighter.id), label: fighter.name }
            : { href: routes.coach.sessions, label: "Sessions" };

    return (
        <>
            <PageHeader
                title={source ? "Schedule again" : "Schedule a session"}
                description={
                    source
                        ? `A copy of ${source.title}, a week later at the same time. Check the details, then schedule it.`
                        : serviceForm
                          ? "The fighter's Medical Clearance is checked when the session starts."
                          : "Every session is checked live against the fighter's Medical Clearance. The fighter is notified when you schedule it."
                }
                back={back}
            />
            <SessionForm
                mode="create"
                action={createSession}
                fighters={fighters.map(toFighterOption)}
                plans={plans.map(toSessionFormPlan)}
                library={library}
                clearances={clearances}
                locations={locations}
                defaults={defaults}
                now={now}
                minDate={today}
                cancelHref={back.href}
                serviceForm={serviceForm}
            />
        </>
    );
}
