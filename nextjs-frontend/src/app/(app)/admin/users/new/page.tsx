import { KeyRound, MailCheck, ShieldAlert, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";

import { CLINICAL_PERMISSIONS, ROLE_ORDER } from "@/components/admin/admin-format";
import { InviteUserForm, type RoleOption } from "@/components/admin/invite-user-form";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listRoleDefinitions } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Invite user" };

const STEPS = [
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
    {
        icon: KeyRound,
        title: "Access follows the role",
        body: "Permissions come from the role, so changing a role's permissions updates everyone who has it.",
    },
];

export default async function InviteUserPage() {
    await requireRole("admin");
    const definitions = await listRoleDefinitions();

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
                title="Invite user"
                description="Create an account and send the person an invitation to set their password."
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader title="Account details" description="Fields marked * are required." />
                    <InviteUserForm roles={roles} defaultRole="fighter" />
                </Card>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title="What happens next" />
                        <CardContent>
                            <ol className="flex flex-col gap-4">
                                {STEPS.map((step, index) => {
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
                        The sports doctor role opens medical records, injuries and Medical Clearance. Only invite licensed sports medicine staff to it.
                    </Callout>
                </div>
            </div>
        </>
    );
}
