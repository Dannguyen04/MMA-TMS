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
    const fighter = (await presetRoleFrom(searchParams)) === "fighter";
    return { title: usesUserServiceForms() ? (fighter ? "Add fighter" : "Add user") : "Invite user" };
}

const ACCESS_STEP = {
    icon: KeyRound,
    title: "Access follows the role",
    body: "Permissions come from the role, so changing a role's permissions updates everyone who has it.",
};

/** The user service creates accounts ready to sign in, with the profile filled in up front. */
const ACCOUNT_STEPS = [
    {
        icon: LockKeyhole,
        title: "They sign in with the password you set",
        body: "Share it privately. They can choose their own at any time with “Forgot password” on the sign-in page.",
    },
    {
        icon: Stethoscope,
        title: "A new fighter needs a sports doctor",
        body: "They can't train until a sports doctor records their baseline exam. Assign the doctor, and a coach, from the fighter's account page.",
    },
    {
        icon: UsersRound,
        title: "Rosters come next",
        body: "Coaches and doctors see the fighters assigned to them.",
    },
    ACCESS_STEP,
];

const INVITATION_STEPS = [
    {
        icon: MailCheck,
        title: "They receive an invitation email",
        body: "The link lets them set a password. Until then the account shows as Invited and can't sign in.",
    },
    {
        icon: UserRoundCheck,
        title: "Their profile is linked on first sign-in",
        body: "Fighter, coach and doctor profiles are connected during onboarding, then rosters can be assigned.",
    },
    ACCESS_STEP,
];

/** API mode creates the account outright; the demo invites the person to set their own password. */
export default async function NewUserPage({ searchParams }: PageProps<"/admin/users/new">) {
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
                back={{ href: routes.admin.users, label: "Users" }}
                title={serviceForms ? (addingFighter ? "Add fighter" : "Add user") : "Invite user"}
                description={
                    serviceForms
                        ? addingFighter
                            ? "Create the fighter's account with a first password and their profile."
                            : "Create an account with a first password and the person's profile."
                        : "Create an account and send the person an invitation to set their password."
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader title="Account details" description="Fields marked * are required." />
                    {serviceForms ? (
                        <CreateAccountForm roles={roles} defaultRole="fighter" presetRole={presetRole} today={dayKey(new Date())} />
                    ) : (
                        <InviteUserForm roles={roles} defaultRole={presetRole ?? "fighter"} />
                    )}
                </Card>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title="What happens next" />
                        <CardContent>
                            <ol className="flex flex-col gap-4">
                                {(serviceForms ? ACCOUNT_STEPS : INVITATION_STEPS).map((step, index) => {
                                    const Icon = step.icon;
                                    return (
                                        <li key={step.title} className="flex gap-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted ring-1 ring-border ring-inset">
                                                <Icon aria-hidden className="size-4" />
                                                <span className="sr-only">Step {index + 1}</span>
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
                    <Callout tone="warning" icon={ShieldAlert} title="Clinical access">
                        The sports doctor role opens medical records, injuries and Medical Clearance. Only give it to licensed sports medicine staff.
                    </Callout>
                </div>
            </div>
        </>
    );
}
