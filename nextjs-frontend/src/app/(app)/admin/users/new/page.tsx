import { KeyRound, LockKeyhole, MailCheck, ShieldAlert, Stethoscope, UserRoundCheck, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";

import { CLINICAL_PERMISSIONS, roleDescription, roleLabel, ROLE_ORDER } from "@/components/admin/admin-format";
import { CreateAccountForm } from "@/components/admin/create-account-form";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import type { RoleOption } from "@/components/admin/role-options";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import type { Role } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listRoleDefinitions } from "@/lib/services/admin";
import { usesUserServiceForms } from "@/lib/services/admin-features";
import { param } from "@/lib/utils";

/** `?role=fighter` (an "Add fighter" entry) opens the form with that role already chosen. */
async function presetRoleFrom(searchParams: PageProps<"/admin/users/new">["searchParams"]): Promise<Role | null> {
    return parseEnum(param((await searchParams).role), ROLE_ORDER) ?? null;
}

export async function generateMetadata({ searchParams }: PageProps<"/admin/users/new">): Promise<Metadata> {
    const { t } = await getTranslator();
    const fighter = (await presetRoleFrom(searchParams)) === "fighter";
    return {
        title: usesUserServiceForms() ? (fighter ? t("screens.admin.common.addFighter") : t("screens.admin.common.addUser")) : t("screens.admin.common.inviteUser"),
    };
}

/** One "what happens next" step; its title and body are `screens.admin.newUser.steps.<id>.*`. */
interface Step {
    id: "access" | "password" | "doctor" | "rosters" | "email" | "link";
    icon: LucideIcon;
}

const ACCESS_STEP: Step = { id: "access", icon: KeyRound };

/** The user service creates accounts ready to sign in, with the profile filled in up front. */
const ACCOUNT_STEPS: Step[] = [{ id: "password", icon: LockKeyhole }, { id: "doctor", icon: Stethoscope }, { id: "rosters", icon: UsersRound }, ACCESS_STEP];

const INVITATION_STEPS: Step[] = [{ id: "email", icon: MailCheck }, { id: "link", icon: UserRoundCheck }, ACCESS_STEP];

/** API mode creates the account outright; the demo invites the person to set their own password. */
export default async function NewUserPage({ searchParams }: PageProps<"/admin/users/new">) {
    await requireRole("admin");
    const { t } = await getTranslator();
    const serviceForms = usesUserServiceForms();
    const [definitions, presetRole] = await Promise.all([listRoleDefinitions(), presetRoleFrom(searchParams)]);
    const addingFighter = serviceForms && presetRole === "fighter";

    const roles: RoleOption[] = ROLE_ORDER.flatMap((role) => {
        const definition = definitions.find((d) => d.role === role);
        if (!definition) return [];
        return [
            {
                role,
                label: roleLabel(t, role),
                description: roleDescription(t, role, definition.description),
                permissionCount: definition.permissions.length,
                clinical: definition.permissions.some((permission) => CLINICAL_PERMISSIONS.includes(permission)),
            },
        ];
    });

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.users, label: t("screens.admin.common.users") }}
                title={serviceForms ? (addingFighter ? t("screens.admin.common.addFighter") : t("screens.admin.common.addUser")) : t("screens.admin.common.inviteUser")}
                description={
                    serviceForms
                        ? addingFighter
                            ? t("screens.admin.newUser.descriptionFighter")
                            : t("screens.admin.newUser.descriptionAdd")
                        : t("screens.admin.newUser.descriptionInvite")
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader title={t("screens.admin.newUser.details")} description={t("screens.admin.newUser.requiredNote")} />
                    {serviceForms ? (
                        <CreateAccountForm roles={roles} defaultRole="fighter" presetRole={presetRole} today={dayKey(new Date())} />
                    ) : (
                        <InviteUserForm roles={roles} defaultRole={presetRole ?? "fighter"} />
                    )}
                </Card>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title={t("screens.admin.newUser.next")} />
                        <CardContent>
                            <ol className="flex flex-col gap-4">
                                {(serviceForms ? ACCOUNT_STEPS : INVITATION_STEPS).map((step, index) => {
                                    const Icon = step.icon;
                                    return (
                                        <li key={step.id} className="flex gap-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted ring-1 ring-border ring-inset">
                                                <Icon aria-hidden className="size-4" />
                                                <span className="sr-only">{t("screens.admin.newUser.step", { n: index + 1 })}</span>
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-fg">{t(`screens.admin.newUser.steps.${step.id}.title` as MessageKey)}</p>
                                                <p className="mt-0.5 text-[13px] text-fg-muted">{t(`screens.admin.newUser.steps.${step.id}.body` as MessageKey)}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </CardContent>
                    </Card>
                    <Callout tone="warning" icon={ShieldAlert} title={t("screens.admin.newUser.clinicalTitle")}>
                        {t("screens.admin.newUser.clinicalBody")}
                    </Callout>
                </div>
            </div>
        </>
    );
}
