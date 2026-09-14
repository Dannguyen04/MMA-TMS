import { Ban, Clock, IdCard, KeyRound, ScrollText, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PermissionList } from "@/components/admin/permission-list";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { UserActions } from "@/components/admin/user-actions";
import { RoleBadge, UserStatusBadge } from "@/components/domain/status-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, STANCE_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, User } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getUserDetail, listPermissionCatalog } from "@/lib/services/admin";
import { listCoaches } from "@/lib/services/people";
import { param } from "@/lib/utils";

/** One read per request, shared by the metadata and the page. */
const loadUserDetail = cache((userId: string) => getUserDetail(userId));

export async function generateMetadata({ params }: PageProps<"/admin/users/[userId]">): Promise<Metadata> {
    await requireRole("admin");
    const { userId } = await params;
    const detail = await loadUserDetail(userId);
    return { title: detail ? `${detail.user.name} — User` : "User not found" };
}

export default async function AdminUserDetailPage({ params, searchParams }: PageProps<"/admin/users/[userId]">) {
    const admin = await requireRole("admin");
    const { userId } = await params;
    const query = await searchParams;
    const now = new Date().toISOString();

    const [detail, catalog, allCoaches] = await Promise.all([loadUserDetail(userId), listPermissionCatalog(), listCoaches()]);
    if (!detail) notFound();
    const { user, profile, recentAudit, permissions } = detail;
    const coaches = user.role === "fighter" && profile ? allCoaches : [];

    const isSelf = user.id === admin.id;
    const roleLockReason = isSelf
        ? "You can't change your own role. Ask another administrator."
        : user.profileId !== null
          ? `${user.name} has a linked ${ROLE_LABELS[user.role].toLowerCase()} profile, so the role can't change. Invite a new account instead.`
          : null;

    const accountItems: DescriptionItem[] = [
        { label: "Email", value: user.email },
        { label: "Phone", value: user.phone ?? <span className="font-normal text-fg-subtle">Not provided</span> },
        { label: "Job title", value: user.title || <span className="font-normal text-fg-subtle">Not set</span> },
        { label: "Role", value: ROLE_LABELS[user.role] },
        { label: "Created", value: formatDate(user.createdAt) },
        {
            label: "Last active",
            value: user.lastActiveAt ? (
                <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt)}>
                    {formatRelative(user.lastActiveAt, now)}
                </time>
            ) : (
                <span className="font-normal text-fg-subtle">{user.status === "invited" ? "Hasn't signed in yet" : "Never"}</span>
            ),
        },
        { label: "Account ID", value: <code className="font-mono text-[13px]">{user.id}</code>, wide: true },
    ];

    return (
        <>
            <FlashToast
                notice={param(query.notice) === "invited" ? { title: "Invitation sent", description: `${user.email} will receive a link to set a password.` } : null}
                cleanHref={routes.admin.user(user.id)}
            />
            <PageHeader
                back={{ href: routes.admin.users, label: "Users" }}
                eyebrow="User account"
                title={
                    <span className="flex items-center gap-4">
                        <Avatar name={user.name} size="lg" shape={user.role === "fighter" ? "octagon" : "circle"} />
                        <span className="min-w-0 break-words">{user.name}</span>
                    </span>
                }
                description={`${user.title} · ${user.email}`}
                meta={
                    <>
                        <RoleBadge role={user.role} />
                        <UserStatusBadge status={user.status} />
                        {isSelf && <Badge tone="primary">Your account</Badge>}
                    </>
                }
                actions={
                    <UserActions
                        user={{ id: user.id, name: user.name, email: user.email, title: user.title, role: user.role, status: user.status }}
                        roleLockReason={roleLockReason}
                        isSelf={isSelf}
                    />
                }
            />

            <div className="flex flex-col gap-6">
                <StatusCallout user={user} now={now} />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title="Account" icon={<IdCard />} />
                            <CardContent>
                                <DescriptionList items={accountItems} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Linked profile"
                                description={profile ? `${ROLE_LABELS[user.role]} profile used across the platform` : undefined}
                                icon={<UserRound />}
                            />
                            <CardContent>
                                <LinkedProfile user={user} profile={profile} coaches={coaches} />
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader title="Recent activity" description={recentAudit.length === 0 ? "Nothing recorded yet" : `Latest ${pluralize(recentAudit.length, "action")} by ${user.name}`} icon={<ScrollText />} />
                            {recentAudit.length === 0 ? (
                                <CardContent>
                                    <EmptyState compact title="No activity recorded" description="Sign-ins and changes this person makes will appear here." />
                                </CardContent>
                            ) : (
                                <>
                                    <AuditActivityList entries={recentAudit} now={now} showActor={false} className="border-t border-border" />
                                    <CardFooter>
                                        <span className="text-fg-muted">Showing the latest entries</span>
                                        <Link href={hrefWith(routes.admin.auditLogs, {}, { q: user.name })} className="font-medium text-primary-soft-fg hover:underline">
                                            View in audit logs
                                        </Link>
                                    </CardFooter>
                                </>
                            )}
                        </Card>
                    </div>

                    <Card className="min-w-0">
                        <CardHeader
                            title="Effective permissions"
                            description={`${pluralize(permissions.length, "permission")} from the ${ROLE_LABELS[user.role]} role`}
                            icon={<KeyRound />}
                        />
                        <CardContent>
                            <PermissionList catalog={catalog} granted={permissions} />
                        </CardContent>
                        <CardFooter>
                            <span className="text-fg-muted">Permissions are set per role</span>
                            <Link href={routes.admin.roles} className="font-medium text-primary-soft-fg hover:underline">
                                Edit role
                            </Link>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </>
    );
}

function StatusCallout({ user, now }: { user: User; now: string }) {
    if (user.status === "active") return null;
    return user.status === "invited" ? (
        <Callout tone="info" icon={Clock} title="Invitation pending" role="status">
            Invited {formatRelative(user.createdAt, now)}. {user.name} can&apos;t sign in until they accept — resend the invitation if they
            can&apos;t find the email.
        </Callout>
    ) : (
        <Callout tone="danger" icon={Ban} title="Account suspended" role="status">
            {user.name} can&apos;t sign in or receive notifications. Reactivate the account to restore their previous access.
        </Callout>
    );
}

function LinkedProfile({ user, profile, coaches }: { user: User; profile: Fighter | Coach | Doctor | null; coaches: Coach[] }) {
    if (!profile) {
        return user.role === "admin" ? (
            <EmptyState compact title="No profile needed" description="Administrator accounts operate the platform and have no athlete or staff profile." />
        ) : (
            <EmptyState
                compact
                title={`No ${ROLE_LABELS[user.role].toLowerCase()} profile linked yet`}
                description={`The profile is connected when ${user.name} completes onboarding.`}
            />
        );
    }

    if (user.role === "fighter" && "weightClass" in profile) {
        const assigned = profile.coachIds
            .map((id) => coaches.find((coach) => coach.id === id))
            .filter((coach): coach is Coach => coach !== undefined)
            .sort((a, b) => Number(b.id === profile.primaryCoachId) - Number(a.id === profile.primaryCoachId));
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: "Weight class", value: WEIGHT_CLASS_LABELS[profile.weightClass] },
                    { label: "Primary discipline", value: profile.primaryDiscipline },
                    { label: "Level", value: TRAINING_LEVEL_LABELS[profile.level] },
                    { label: "Stance", value: STANCE_LABELS[profile.stance] },
                    { label: "Record (W–L–D)", value: `${profile.record.wins}–${profile.record.losses}–${profile.record.draws}` },
                    { label: "Joined", value: formatDate(profile.joinedAt) },
                    {
                        label: "Coaches",
                        wide: true,
                        value:
                            assigned.length === 0 ? (
                                <span className="font-normal text-fg-subtle">No coach assigned</span>
                            ) : (
                                <span className="flex flex-wrap gap-2">
                                    {assigned.map((coach) => (
                                        <Link key={coach.id} href={routes.admin.user(coach.userId)} className="inline-flex items-center gap-1.5 hover:underline">
                                            <Avatar name={coach.name} size="xs" />
                                            {coach.name}
                                            {coach.id === profile.primaryCoachId && <span className="font-normal text-fg-subtle">(primary)</span>}
                                        </Link>
                                    ))}
                                </span>
                            ),
                    },
                ]}
            />
        );
    }

    if (user.role === "coach" && "yearsExperience" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: "Specialty", value: profile.specialty },
                    { label: "Experience", value: pluralize(profile.yearsExperience, "year") },
                    { label: "Roster", value: pluralize(profile.fighterIds.length, "fighter") },
                    {
                        label: "Certifications",
                        wide: true,
                        value: profile.certifications.length > 0 ? profile.certifications.join(" · ") : <span className="font-normal text-fg-subtle">None recorded</span>,
                    },
                ]}
            />
        );
    }

    if (user.role === "doctor" && "licenseNumber" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: "Specialty", value: profile.specialty },
                    { label: "License number", value: <code className="font-mono text-[13px]">{profile.licenseNumber}</code> },
                    { label: "Patients", value: pluralize(profile.fighterIds.length, "fighter") },
                ]}
            />
        );
    }

    return <EmptyState compact title="Profile unavailable" description="The linked profile doesn't match this account's role." />;
}
