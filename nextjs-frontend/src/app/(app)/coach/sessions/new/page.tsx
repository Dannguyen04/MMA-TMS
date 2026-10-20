import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { SessionForm, type SessionFormValues } from "@/components/training/session-form";
import { getClearanceSummaries, toFighterOption } from "@/components/training/training-data";
import { createSession } from "@/lib/actions/training";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import type { TrainingType } from "@/lib/domain/types";
import { addDaysToKey, dayKey } from "@/lib/format";
import { parseEnum } from "@/lib/query";
import { getLocale } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { listExercises, listPlans, listSessions, listSessionTemplates } from "@/lib/services/training";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Schedule session" };

const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];

export default async function NewSessionPage({ searchParams }: PageProps<"/coach/sessions/new">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);
    const serviceForm = usesTrainingServiceForms();

    const fighterList = listFighters(user);
    const [fighters, plans, library, sessions, clearances, templates] = await Promise.all([
        fighterList,
        listPlans({ fighterIds: scope }),
        // Exercises are part of the demo's session form only.
        serviceForm ? [] : listExercises(),
        listSessions({ fighterIds: scope }),
        getClearanceSummaries(scopedFighterIds(user, fighterList), now),
        // A service without the templates (migration 029 not applied yet) only hides the picker.
        getLocale().then((locale) => listSessionTemplates(locale)).catch(() => []),
    ]);

    // Prefill from ?plan=, ?fighter= and ?type= — only with records on this coach's roster.
    const plan = plans.find((p) => p.id === param(params.plan) && (p.status === "active" || p.status === "draft"));
    const requestedFighter = fighters.find((f) => f.id === param(params.fighter));
    const fighter = plan ? fighters.find((f) => f.id === plan.fighterId) : requestedFighter;
    const today = dayKey(now);
    const defaults: SessionFormValues = {
        fighterId: fighter?.id ?? "",
        planId: plan && plan.fighterId === fighter?.id ? plan.id : "",
        title: "",
        type: parseEnum(param(params.type), serviceForm ? SERVICE_TRAINING_TYPES : TRAINING_TYPES) ?? "pad_work",
        date: addDaysToKey(today, 1),
        time: "17:30",
        durationMin: "60",
        location: "",
        targetRpe: 6,
        exercises: [],
        notes: "",
    };
    const locations = [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort();
    const back = plan
        ? { href: routes.coach.plan(plan.id), label: plan.title }
        : fighter
          ? { href: routes.coach.fighterTraining(fighter.id), label: fighter.name }
          : { href: routes.coach.sessions, label: "Sessions" };

    return (
        <>
            <PageHeader
                title="Schedule a session"
                description={
                    serviceForm
                        ? "The fighter's Medical Clearance is checked when the session starts."
                        : "Every session is checked live against the fighter's Medical Clearance. The fighter is notified when you schedule it."
                }
                back={back}
            />
            <SessionForm
                mode="create"
                action={createSession}
                fighters={fighters.map(toFighterOption)}
                plans={plans.map((p) => ({ id: p.id, title: p.title, fighterId: p.fighterId, status: p.status }))}
                templates={templates}
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
