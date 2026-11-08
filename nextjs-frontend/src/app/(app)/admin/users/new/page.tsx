import { KeyRound, LockKeyhole, MailCheck, ShieldAlert, Stethoscope, UserRoundCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";

import { CLINICAL_PERMISSIONS, ROLE_ORDER } from "@/components/admin/admin-format";
import { CreateAccountForm } from "@/components/admin/create-account-form";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import type { RoleOption } from "@/components/admin/role-options";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import type { Role } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
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
    return { title: usesUserServiceForms() ? (fighter ? t("adminBody.users.addFighter") : t("adminBody.users.add")) : t("adminBody.users.invite") };
}

function accountSteps(t: Translator) {
    return [
        { icon: LockKeyhole, title: t("adminBody.users.stepPassword"), body: t("adminBody.users.stepPasswordText") },
        { icon: Stethoscope, title: t("adminBody.users.stepDoctor"), body: t("adminBody.users.stepDoctorText") },
        { icon: UsersRound, title: t("adminBody.users.stepRoster"), body: t("adminBody.users.stepRosterText") },
        { icon: KeyRound, title: t("adminBody.users.stepAccess"), body: t("adminBody.users.stepAccessText") },
    ];
}

function invitationSteps(t: Translator) {
    return [
        { icon: MailCheck, title: t("adminBody.users.stepMail"), body: t("adminBody.users.stepMailText") },
        { icon: UserRoundCheck, title: t("adminBody.users.stepLink"), body: t("adminBody.users.stepLinkText") },
        { icon: KeyRound, title: t("adminBody.users.stepAccess"), body: t("adminBody.users.stepAccessText") },
    ];
}

/** API mode creates the account outright; the demo invites the person to set their own password. */
export default async function NewUserPage({ searchParams }: PageProps<"/admin/users/new">) {
    const { t } = await getTranslator();
    await requireRole("admin");
    const serviceForms = usesUserServiceForms();
    const [definitions, presetRole] = await Promise.all([listRoleDefinitions(), presetRoleFrom(searchParams)]);
    const addingFighter = serviceForms && presetRole === "fighter";

    const roles: RoleOption[] = ROLE_ORDER.flatMap((role) => {
        const definition = definitions.find((d) => d.role === role);
        if (!definition) return [];
        return [
            {
                role,
                label: definition.label,
                description: definition.description,
                permissionCount: definition.permissions.length,
                clinical: definition.permissions.some((permission) => CLINICAL_PERMISSIONS.includes(permission)),
            },
        ];
    });

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.users, label: t("adminBody.users.back") }}
                title={serviceForms ? (addingFighter ? t("adminBody.users.addFighter") : t("adminBody.users.add")) : t("adminBody.users.invite")}
                description={serviceForms ? (addingFighter ? t("adminBody.users.descFighter") : t("adminBody.users.descAccount")) : t("adminBody.users.descInviteForm")}
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader title={t("adminBody.users.accountDetails")} description={t("adminBody.users.required")} />
                    {serviceForms ? (
                        <CreateAccountForm roles={roles} defaultRole="fighter" presetRole={presetRole} today={dayKey(new Date())} />
                    ) : (
                        <InviteUserForm roles={roles} defaultRole={presetRole ?? "fighter"} />
                    )}
                </Card>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title={t("adminBody.users.next")} />
                        <CardContent>
                            <ol className="flex flex-col gap-4">
                                {(serviceForms ? accountSteps(t) : invitationSteps(t)).map((step, index) => {
                                    const Icon = step.icon;
                                    return (
                                        <li key={step.title} className="flex gap-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted ring-1 ring-border ring-inset">
                                                <Icon aria-hidden className="size-4" />
                                                <span className="sr-only">{t("adminBody.users.step", { n: index + 1 })}</span>
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-fg">{step.title}</p>
                                                <p className="mt-0.5 text-[13px] text-fg-muted">{step.body}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </CardContent>
                    </Card>
                    <Callout tone="warning" icon={ShieldAlert} title={t("adminBody.users.clinical")}>
                        {t("adminBody.users.clinicalText")}
                    </Callout>
                </div>
            </div>
        </>
    );
}
