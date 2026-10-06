import { Ban, Clock, IdCard, KeyRound, ScrollText, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AccountActions } from "@/components/admin/account-actions";
import { CareTeamCard } from "@/components/admin/care-team-card";
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
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { NOT_RECORDED, labelOf } from "@/components/domain/domain-format";
import { ROLE_LABELS, STANCE_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, User } from "@/lib/domain/types";
import { dayKey, formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getUserDetail, listPermissionCatalog } from "@/lib/services/admin";
import { adminFeatureAvailable, usesUserServiceForms } from "@/lib/services/admin-features";
import { getCareTeam, listAssignableStaff } from "@/lib/services/care-team";
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

    const showPermissions = adminFeatureAvailable("rolePermissions");
    const showActivity = adminFeatureAvailable("auditTrail");
    const actions = { edit: adminFeatureAvailable("editUsers"), status: adminFeatureAvailable("accountStatus") };
    const [detail, catalog] = await Promise.all([loadUserDetail(userId), showPermissions ? listPermissionCatalog() : []]);
    if (!detail) notFound();
    const { user, profile, recentAudit, permissions, account } = detail;
    const fighterProfile = user.role === "fighter" ? profile : null;
    const [careTeam, assignableStaff] = fighterProfile ? await Promise.all([getCareTeam(fighterProfile.id), listAssignableStaff()]) : [null, null];

    const isSelf = user.id === admin.id;
    const roleLockReason = isSelf
        ? "You can't change your own role. Ask another administrator."
        : user.profileId !== null
          ? `${user.name} has a linked ${ROLE_LABELS[user.role].toLowerCase()} profile, so the role can't change. Invite a new account instead.`
          : null;

    // Fields the user service doesn't keep are left out rather than shown as empty.
    const accountItems: (DescriptionItem | false)[] = [
        { label: "Email", value: user.email },
        adminFeatureAvailable("accountPhone") && { label: "Phone", value: user.phone ?? <span className="font-normal text-fg-subtle">Not provided</span> },
        { label: "Job title", value: user.title || <span className="font-normal text-fg-subtle">Not set</span> },
        { label: "Role", value: ROLE_LABELS[user.role] },
        { label: "Created", value: formatDate(user.createdAt) },
        adminFeatureAvailable("lastActive") && {
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

    const notices = {
        invited: { title: "Invitation sent", description: `${user.email} will receive a link to set a password.` },
        created: { title: "Account created", description: `${user.name} can sign in now with the password you set.` },
    };
    const notice = param(query.notice);

    // API mode edits the profile and deletes the account; the demo edits name, title and role, and suspends.
    const headerActions = usesUserServiceForms() ? (
        <AccountActions
            user={{ id: user.id, name: user.name, email: user.email }}
            account={account?.role === "admin" ? null : account}
            canDelete={!isSelf}
            today={dayKey(now)}
        />
    ) : (
        (actions.edit || actions.status) && (
            <UserActions
                user={{ id: user.id, name: user.name, email: user.email, title: user.title, role: user.role, status: user.status }}
                roleLockReason={roleLockReason}
                isSelf={isSelf}
                available={actions}
            />
        )
    );

    return (
        <>
            <FlashToast notice={notice === "invited" || notice === "created" ? notices[notice] : null} cleanHref={routes.admin.user(user.id)} />
            <PageHeader
                back={{ href: routes.admin.users, label: "Users" }}
                eyebrow="User account"
                title={
                    <span className="flex items-center gap-4">
                        <Avatar name={user.name} size="lg" shape={user.role === "fighter" ? "octagon" : "circle"} />
                        <span className="min-w-0 break-words">{user.name}</span>
                    </span>
                }
                description={[user.title, user.email].filter(Boolean).join(" · ")}
                meta={
                    <>
                        <RoleBadge role={user.role} />
                        <UserStatusBadge status={user.status} />
                        {isSelf && <Badge tone="primary">Your account</Badge>}
                    </>
                }
                actions={headerActions}
            />

            <div className="flex flex-col gap-6">
                <StatusCallout user={user} now={now} />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title="Account" icon={<IdCard />} />
                            <CardContent>
                                <DescriptionList items={accountItems.filter((item) => item !== false)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Linked profile"
                                description={profile ? `${ROLE_LABELS[user.role]} profile used across the platform` : undefined}
                                icon={<UserRound />}
                            />
                            <CardContent>
                                <LinkedProfile user={user} profile={profile} showCredentials={adminFeatureAvailable("coachCredentials")} />
                            </CardContent>
                        </Card>

                        {fighterProfile && careTeam && assignableStaff && (
                            <CareTeamCard fighterId={fighterProfile.id} fighterName={user.name} team={careTeam} staff={assignableStaff} />
                        )}

                        <Card className="overflow-hidden">
                            <CardHeader
                                title="Recent activity"
                                description={showActivity ? (recentAudit.length === 0 ? "Nothing recorded yet" : `Latest ${pluralize(recentAudit.length, "action")} by ${user.name}`) : undefined}
                                icon={<ScrollText />}
                            />
                            {!showActivity ? (
                                <CardContent>
                                    <FeatureUnavailable compact title="Activity isn't available yet" description="The user service doesn't share an account's activity yet. It will appear here once it does." />
                                </CardContent>
                            ) : recentAudit.length === 0 ? (
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
                            description={showPermissions ? `${pluralize(permissions.length, "permission")} from the ${ROLE_LABELS[user.role]} role` : undefined}
                            icon={<KeyRound />}
                        />
                        <CardContent>
                            {showPermissions ? (
                                <PermissionList catalog={catalog} granted={permissions} />
                            ) : (
                                <FeatureUnavailable compact title="Role permissions aren't available yet" description="The user service doesn't share what each role grants yet. It will appear here once it does." />
                            )}
                        </CardContent>
                        {showPermissions && (
                            <CardFooter>
                                <span className="text-fg-muted">Permissions are set per role</span>
                                <Link href={routes.admin.roles} className="font-medium text-primary-soft-fg hover:underline">
                                    Edit role
                                </Link>
                            </CardFooter>
                        )}
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

function LinkedProfile({
    user,
    profile,
    showCredentials,
}: {
    user: User;
    profile: Fighter | Coach | Doctor | null;
    /** False where the service keeps no certifications or experience: those rows are left out rather than shown as empty. */
    showCredentials: boolean;
}) {
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
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: "Weight class", value: WEIGHT_CLASS_LABELS[profile.weightClass] },
                    { label: "Primary discipline", value: profile.primaryDiscipline ?? NOT_RECORDED },
                    { label: "Level", value: labelOf(TRAINING_LEVEL_LABELS, profile.level) ?? NOT_RECORDED },
                    { label: "Stance", value: labelOf(STANCE_LABELS, profile.stance) ?? NOT_RECORDED },
                    { label: "Record (W–L–D)", value: profile.record ? `${profile.record.wins}–${profile.record.losses}–${profile.record.draws}` : NOT_RECORDED },
                    { label: "Joined", value: formatDate(profile.joinedAt) },
                ]}
            />
        );
    }

    if (user.role === "coach" && "yearsExperience" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: "Specialty", value: profile.specialty || <span className="font-normal text-fg-subtle">{NOT_RECORDED}</span> },
                    ...(showCredentials ? [{ label: "Experience", value: profile.yearsExperience === null ? NOT_RECORDED : pluralize(profile.yearsExperience, "year") }] : []),
                    { label: "Roster", value: pluralize(profile.fighterIds.length, "fighter") },
                    ...(showCredentials
                        ? [
                              {
                                  label: "Certifications",
                                  wide: true,
                                  value: profile.certifications.length > 0 ? profile.certifications.join(" · ") : <span className="font-normal text-fg-subtle">None recorded</span>,
                              },
                          ]
                        : []),
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
                    {
                        label: "License number",
                        value: profile.licenseNumber ? <code className="font-mono text-[13px]">{profile.licenseNumber}</code> : <span className="font-normal text-fg-subtle">{NOT_RECORDED}</span>,
                    },
                    { label: "Patients", value: pluralize(profile.fighterIds.length, "fighter") },
                ]}
            />
        );
    }

    return <EmptyState compact title="Profile unavailable" description="The linked profile doesn't match this account's role." />;
}
