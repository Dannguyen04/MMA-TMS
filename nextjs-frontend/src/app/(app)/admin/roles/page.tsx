import { Dumbbell, Lock, ShieldAlert, ShieldCheck, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CLINICAL_PERMISSIONS, ROLE_ORDER } from "@/components/admin/admin-format";
import { RoleMatrix, type MatrixRole } from "@/components/admin/role-matrix";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import type { Role } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listPermissionCatalog, listRoleDefinitions, listUsers } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Roles & permissions" };

const ROLE_ICONS: Record<Role, LucideIcon> = {
    fighter: UserRound,
    coach: Dumbbell,
    doctor: Stethoscope,
    admin: ShieldCheck,
};

export default async function AdminRolesPage() {
    await requireRole("admin");
    const [definitions, catalog, users] = await Promise.all([listRoleDefinitions(), listPermissionCatalog(), listUsers()]);

    const roles: MatrixRole[] = ROLE_ORDER.flatMap((role) => {
        const definition = definitions.find((d) => d.role === role);
        return definition
            ? [{ role, label: definition.label, permissions: [...definition.permissions], memberCount: users.filter((u) => u.role === role).length }]
            : [];
    });

    return (
        <>
            <PageHeader
                title="Roles & permissions"
                description="Decide what each role can see and do. Saving a role applies the change to every account with that role straight away."
            />

            <div className="flex flex-col gap-6">
                <section aria-label="Roles" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {ROLE_ORDER.map((role) => {
                        const definition = definitions.find((d) => d.role === role);
                        const matrixRole = roles.find((r) => r.role === role);
                        if (!definition || !matrixRole) return null;
                        const Icon = ROLE_ICONS[role];
                        const clinical = definition.permissions.some((p) => CLINICAL_PERMISSIONS.includes(p));
                        return (
                            <Card key={role} className="flex min-w-0 flex-col gap-3 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                                        <Icon aria-hidden className="size-[18px]" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-[15px] font-semibold text-fg">{definition.label}</h2>
                                        <p className="text-xs text-fg-subtle">
                                            <Link href={hrefWith(routes.admin.users, {}, { role })} className="hover:text-fg hover:underline">
                                                {pluralize(matrixRole.memberCount, "account")}
                                            </Link>{" "}
                                            · {pluralize(definition.permissions.length, "permission")}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-[13px] text-pretty text-fg-muted">{definition.description}</p>
                                {clinical && (
                                    <p className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-warning-fg">
                                        <ShieldAlert aria-hidden className="size-3.5" />
                                        Has clinical access
                                    </p>
                                )}
                                {role === "admin" && (
                                    <p className="mt-auto inline-flex items-start gap-1.5 text-xs text-fg-subtle">
                                        <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
                                        Always keeps user and role management, so access can be restored.
                                    </p>
                                )}
                            </Card>
                        );
                    })}
                </section>

                <Card className="min-w-0 overflow-hidden">
                    <RoleMatrix roles={roles} catalog={catalog} />
                </Card>
            </div>
        </>
    );
}
