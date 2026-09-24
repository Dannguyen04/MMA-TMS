import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BodyMetricsCard, CareTeamCard, FightProfileCard } from "@/components/account/fighter-profile-cards";
import { ProfileForm } from "@/components/account/profile-form";
import { ProfileIdentityCard } from "@/components/account/profile-identity-card";
import { SecurityCard } from "@/components/account/security-card";
import {
    AccessSummaryCard,
    CoachProfileCard,
    DoctorProfileCard,
    MissingProfileCard,
    type RosterEntry,
} from "@/components/account/staff-profile-cards";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Fighter, User } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { listPermissionCatalog, listRoleDefinitions } from "@/lib/services/admin";
import { coachesForFighter, doctorsForFighter, getCoachByUserId, getDoctorByUserId, listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Profile" };

interface RoleSections {
    facts?: string[];
    nickname?: string | null;
    /** Role-specific cards under the identity card. */
    main: ReactNode;
}

export default async function ProfilePage() {
    const user = await requireUser();
    const now = new Date().toISOString();
    const sections = await roleSections(user, now);

    return (
        <>
            <PageHeader title="Profile" description="Your account details and how you appear to the rest of the academy." />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <ProfileIdentityCard user={user} nickname={sections.nickname} facts={sections.facts} now={now} />
                    {sections.main}
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <ProfileForm name={user.name} phone={user.phone} email={user.email} title={user.title} />
                    <SecurityCard lastActiveAt={user.lastActiveAt} now={now} />
                </div>
            </div>
        </>
    );
}

async function roleSections(user: User, now: string): Promise<RoleSections> {
    switch (user.role) {
        case "fighter": {
            if (!user.profileId) return { main: <MissingProfileCard kind="fighter" /> };
            const fighter = await requireFighterAccess(user, user.profileId);
            const [coaches, doctors] = await Promise.all([coachesForFighter(fighter.id), doctorsForFighter(fighter.id)]);
            return {
                nickname: fighter.nickname,
                facts: [fighter.primaryDiscipline, WEIGHT_CLASS_LABELS[fighter.weightClass], fighter.nationality],
                main: (
                    <>
                        <BodyMetricsCard fighter={fighter} />
                        <FightProfileCard fighter={fighter} now={now} />
                        <CareTeamCard coaches={coaches} doctors={doctors} primaryCoachId={fighter.primaryCoachId} />
                    </>
                ),
            };
        }
        case "coach": {
            const [coach, fighters] = await Promise.all([getCoachByUserId(user.id), listFighters(user)]);
            if (!coach) return { main: <MissingProfileCard kind="coaching" /> };
            return {
                facts: [coach.specialty],
                main: <CoachProfileCard coach={coach} rosterHref={routes.coach.fighters} roster={toRoster(fighters, routes.coach.fighter)} />,
            };
        }
        case "doctor": {
            const [doctor, fighters] = await Promise.all([getDoctorByUserId(user.id), listFighters(user)]);
            if (!doctor) return { main: <MissingProfileCard kind="clinical" /> };
            return {
                facts: [doctor.specialty],
                main: <DoctorProfileCard doctor={doctor} patientsHref={routes.doctor.fighters} roster={toRoster(fighters, routes.doctor.fighter)} />,
            };
        }
        case "admin": {
            const [roles, catalog] = await Promise.all([listRoleDefinitions(), listPermissionCatalog()]);
            const role = roles.find((definition) => definition.role === user.role);
            return {
                main: role ? <AccessSummaryCard role={role} catalog={catalog} rolesHref={routes.admin.roles} /> : null,
            };
        }
    }
}

/** Serializable roster rows (fighters are already scoped to the signed-in coach or doctor). */
function toRoster(fighters: Fighter[], hrefFor: (fighterId: string) => string): RosterEntry[] {
    return fighters.map(({ id, name, nickname, weightClass, stance, level, healthStatus }) => ({
        id,
        href: hrefFor(id),
        fighter: { name, nickname, weightClass, stance, level, healthStatus },
    }));
}
