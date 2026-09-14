import type { Metadata } from "next";

import { GrantClearanceForm, type ClearanceFighterContext } from "@/components/medical/grant-clearance-form";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, INJURY_STATUS_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceState, currentClearance } from "@/lib/domain/rules";
import { dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { listDoctors, listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Update Medical Clearance" };

/** Recent examinations offered as evidence for the decision. */
const EXAMINATION_OPTIONS = 8;

export default async function GrantClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [assigned, examinations, injuries, doctors, settings, clearances] = await Promise.all([
        listFighters(user),
        listExaminations({ fighterIds: scope }),
        listInjuries({ fighterIds: scope }),
        listDoctors(),
        getSettings(),
        listClearances({ fighterIds: scope }),
    ]);
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

    const fighters: ClearanceFighterContext[] = assigned
        .map((fighter) => ({ fighter, clearance: currentClearance(clearances, fighter.id) }))
        .map(({ fighter, clearance }) => ({
            id: fighter.id,
            name: fighter.name,
            nickname: fighter.nickname,
            weightClass: fighter.weightClass,
            stance: fighter.stance,
            level: fighter.level,
            healthStatus: fighter.healthStatus,
            clearance,
            state: clearanceState(clearance, now),
            issuedByName: clearance ? (doctorNames.get(clearance.doctorId) ?? null) : null,
            openInjuries: injuries
                .filter((injury) => injury.fighterId === fighter.id && injury.status !== "resolved")
                .map(
                    (injury) =>
                        `${INJURY_TYPE_LABELS[injury.type]} — ${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()} (${INJURY_STATUS_LABELS[injury.status].toLowerCase()})`,
                ),
            examinations: examinations
                .filter((exam) => exam.fighterId === fighter.id)
                .slice(0, EXAMINATION_OPTIONS)
                .map((exam) => ({ id: exam.id, date: exam.date, type: exam.type, outcome: exam.outcome, summary: exam.summary })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const requestedFighter = param(params.fighter);
    const defaultFighterId = requestedFighter && canAccessFighter(user, requestedFighter) ? requestedFighter : "";
    const preselected = fighters.find((fighter) => fighter.id === defaultFighterId);

    return (
        <>
            <PageHeader
                back={
                    preselected
                        ? { href: routes.doctor.fighter(preselected.id), label: preselected.name }
                        : { href: routes.doctor.clearance, label: "Medical Clearance" }
                }
                eyebrow="Medical Clearance"
                title={preselected ? `Update clearance for ${preselected.name}` : "Issue Medical Clearance"}
                description="The new clearance replaces the current one immediately. Coaches plan training against it, and the fighter and their coaches are notified."
            />
            <GrantClearanceForm
                fighters={fighters}
                defaultFighterId={defaultFighterId}
                defaultExaminationId={param(params.exam) ?? ""}
                today={dayKey(now)}
                now={now}
                doctorName={user.name}
                warningDays={settings.clearanceExpiryWarningDays}
            />
        </>
    );
}
