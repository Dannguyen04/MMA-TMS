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
import { presentFacts } from "@/components/domain/domain-format";
import { PageHeader } from "@/components/ui/page-header";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { weightClassLabel } from "@/lib/domain/labels";
import type { Fighter, User } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listPermissionCatalog, listRoleDefinitions } from "@/lib/services/admin";
import { coachesForFighter, doctorsForFighter, getCoachByUserId, getDoctorByUserId, listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("account.profile.title") };
}

interface RoleSections {
    facts?: string[];
    nickname?: string | null;
    /** Role-specific cards under the identity card. */
    main: ReactNode;
}

export default async function ProfilePage() {
    const [user, { t, locale }] = await Promise.all([requireUser(), getTranslator()]);
    const now = new Date().toISOString();
    const sections = await roleSections(user, now, locale);

    return (
        <>
            <PageHeader title={t("account.profile.title")} description={t("account.profile.description")} />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <ProfileIdentityCard user={user} nickname={sections.nickname} facts={sections.facts} now={now} locale={locale} />
                    {sections.main}
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    {platformFeatureAvailable("selfProfileEdit") && <ProfileForm name={user.name} phone={user.phone} email={user.email} title={user.title} />}
                    <SecurityCard lastActiveAt={user.lastActiveAt} now={now} />
                </div>
            </div>
        </>
    );
}

async function roleSections(user: User, now: string, locale: Locale): Promise<RoleSections> {
    switch (user.role) {
        case "fighter": {
            if (!user.profileId) return { main: <MissingProfileCard kind="fighter" locale={locale} /> };
            const fighter = await requireFighterAccess(user, user.profileId);
            const [coaches, doctors] = await Promise.all([coachesForFighter(fighter.id), doctorsForFighter(fighter.id)]);
            return {
                nickname: fighter.nickname,
                facts: presentFacts(fighter.primaryDiscipline, weightClassLabel(fighter.weightClass, locale), fighter.nationality),
                main: (
                    <>
                        <BodyMetricsCard fighter={fighter} canLog={platformFeatureAvailable("bodyMetrics")} locale={locale} />
                        <FightProfileCard fighter={fighter} now={now} locale={locale} />
                        <CareTeamCard coaches={coaches} doctors={doctors} primaryCoachId={fighter.primaryCoachId} locale={locale} />
                    </>
                ),
            };
        }
        case "coach": {
            const [coach, fighters] = await Promise.all([getCoachByUserId(user.id), listFighters(user)]);
            if (!coach) return { main: <MissingProfileCard kind="coaching" locale={locale} /> };
            return {
                facts: presentFacts(coach.specialty),
                main: <CoachProfileCard coach={coach} rosterHref={routes.coach.fighters} roster={toRoster(fighters, routes.coach.fighter)} locale={locale} />,
            };
        }
        case "doctor": {
            const [doctor, fighters] = await Promise.all([getDoctorByUserId(user.id), listFighters(user)]);
            if (!doctor) return { main: <MissingProfileCard kind="clinical" locale={locale} /> };
            return {
                facts: presentFacts(doctor.specialty),
                main: <DoctorProfileCard doctor={doctor} patientsHref={routes.doctor.fighters} roster={toRoster(fighters, routes.doctor.fighter)} locale={locale} />,
            };
        }
        case "admin": {
            const [roles, catalog] = await Promise.all([listRoleDefinitions(), listPermissionCatalog()]);
            const role = roles.find((definition) => definition.role === user.role);
            return {
                main: role ? <AccessSummaryCard role={role} catalog={catalog} rolesHref={routes.admin.roles} locale={locale} /> : null,
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
