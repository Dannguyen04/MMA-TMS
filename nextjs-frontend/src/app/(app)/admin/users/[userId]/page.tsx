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
import { FighterJourney } from "@/components/domain/fighter-journey";
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
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { NOT_RECORDED, labelOf } from "@/components/domain/domain-format";
import { CARE_ROLES } from "@/lib/domain/care-team";
import { ROLE_LABELS, STANCE_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, User } from "@/lib/domain/types";
import { dayKey, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getUserDetail, listPermissionCatalog } from "@/lib/services/admin";
import { adminFeatureAvailable, usesUserServiceForms } from "@/lib/services/admin-features";
import { getCareTeam, listAssignableStaff } from "@/lib/services/care-team";
import { getFighterJourney } from "@/lib/services/fighter-journey";
import { param } from "@/lib/utils";

/** One read per request, shared by the metadata and the page. */
const loadUserDetail = cache((userId: string) => getUserDetail(userId));

export async function generateMetadata({ params }: PageProps<"/admin/users/[userId]">): Promise<Metadata> {
    const { t } = await getTranslator();
    await requireRole("admin");
    const { userId } = await params;
    const detail = await loadUserDetail(userId);
    return { title: detail ? `${detail.user.name} — ${t("adminBody.users.colUser")}` : t("adminBody.users.notFound") };
}

export default async function AdminUserDetailPage({ params, searchParams }: PageProps<"/admin/users/[userId]">) {
    const { t } = await getTranslator();
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
    const [careTeam, assignableStaff, journey] = fighterProfile
        ? await Promise.all([getCareTeam(fighterProfile.id), listAssignableStaff(), getFighterJourney(fighterProfile.id, { viewer: "admin" })])
        : [null, null, null];

    const isSelf = user.id === admin.id;
    const locale = t.locale === "en" ? "en" : "vi";
    const roleLockReason = isSelf
        ? t("adminBody.users.selfRole")
        : user.profileId !== null
          ? t("adminBody.users.linkedRole", { name: user.name, role: ROLE_LABELS[user.role] })
          : null;

    // Fields the user service doesn't keep are left out rather than shown as empty.
    const accountItems: (DescriptionItem | false)[] = [
        { label: t("adminBody.users.email"), value: user.email },
        adminFeatureAvailable("accountPhone") && { label: t("adminBody.users.phone"), value: user.phone ?? <span className="font-normal text-fg-subtle">{t("adminBody.users.notProvided")}</span> },
        { label: t("adminBody.users.jobTitle"), value: user.title || <span className="font-normal text-fg-subtle">{t("adminBody.users.notSet")}</span> },
        { label: t("adminBody.users.colRole"), value: ROLE_LABELS[user.role] },
        { label: t("adminBody.users.colCreated"), value: formatDate(user.createdAt) },
        adminFeatureAvailable("lastActive") && {
            label: t("adminBody.users.colLast"),
            value: user.lastActiveAt ? (
                <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt)}>
                    {formatRelative(user.lastActiveAt, now, locale)}
                </time>
            ) : (
                <span className="font-normal text-fg-subtle">{user.status === "invited" ? t("adminBody.users.notSignedIn") : t("adminBody.users.never")}</span>
            ),
        },
        { label: t("adminBody.users.accountId"), value: <code className="font-mono text-[13px]">{user.id}</code>, wide: true },
    ];

    // A new fighter can't train yet: the notice names the next step instead of ending at "can sign in".
    const missing = careTeam ? CARE_ROLES.filter((role) => careTeam[role]?.length === 0) : [];
    const nextStep = missing.includes("doctor")
        ? missing.includes("coach")
            ? t("adminBody.users.nextBoth")
            : t("adminBody.users.nextDoctor")
        : missing.includes("coach")
          ? t("adminBody.users.nextCoach")
          : "";
    const notices = {
        invited: { title: t("adminBody.users.invitedTitle"), description: t("adminBody.users.invitedText", { email: user.email, next: nextStep }) },
        created: { title: t("adminBody.users.createdTitle"), description: t("adminBody.users.createdText", { name: user.name, next: nextStep }) },
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
                back={{ href: routes.admin.users, label: t("adminBody.users.back") }}
                eyebrow={t("adminBody.users.eyebrow")}
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
                        {isSelf && <Badge tone="primary">{t("adminBody.users.yours")}</Badge>}
                    </>
                }
                actions={headerActions}
            />

            <div className="flex flex-col gap-6">
                <StatusCallout user={user} now={now} t={t} />

                {/* Where the fighter is on the way to training; the care team card below holds the assign actions. */}
                {journey && !journey.complete && <FighterJourney journey={journey} variant="compact" />}

                {/* A fighter's care team decides whether they can train, so it leads the page; an empty role is its next step. */}
                {fighterProfile && careTeam && assignableStaff && (
                    <CareTeamCard fighterId={fighterProfile.id} fighterName={user.name} team={careTeam} staff={assignableStaff} />
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title={t("adminBody.users.account")} icon={<IdCard />} />
                            <CardContent>
                                <DescriptionList items={accountItems.filter((item) => item !== false)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("adminBody.users.linked")}
                                description={profile ? t("adminBody.users.linkedDesc", { role: ROLE_LABELS[user.role] }) : undefined}
                                icon={<UserRound />}
                            />
                            <CardContent>
                                <LinkedProfile user={user} profile={profile} showCredentials={adminFeatureAvailable("coachCredentials")} t={t} />
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title={t("adminBody.today.activity")}
                                description={showActivity ? (recentAudit.length === 0 ? t("adminBody.users.nothingRecorded") : plural(t, "adminBody.users.latestBy", recentAudit.length, { name: user.name })) : undefined}
                                icon={<ScrollText />}
                            />
                            {!showActivity ? (
                                <CardContent>
                                    <FeatureUnavailable compact title={t("adminBody.users.activityLater")} description={t("adminBody.users.activityLaterText")} />
                                </CardContent>
                            ) : recentAudit.length === 0 ? (
                                <CardContent>
                                    <EmptyState compact title={t("adminBody.users.noActivity")} description={t("adminBody.users.noActivityText")} />
                                </CardContent>
                            ) : (
                                <>
                                    <AuditActivityList entries={recentAudit} now={now} showActor={false} className="border-t border-border" />
                                    <CardFooter>
                                        <span className="text-fg-muted">{t("adminBody.users.showingLatest")}</span>
                                        <Link href={hrefWith(routes.admin.auditLogs, {}, { q: user.name })} className="font-medium text-primary-soft-fg hover:underline">
                                            {t("adminBody.users.viewAudit")}
                                        </Link>
                                    </CardFooter>
                                </>
                            )}
                        </Card>
                    </div>

                    <Card className="min-w-0">
                        <CardHeader
                            title={t("adminBody.users.permissions")}
                            description={showPermissions ? plural(t, "adminBody.users.permCount", permissions.length, { role: ROLE_LABELS[user.role] }) : undefined}
                            icon={<KeyRound />}
                        />
                        <CardContent>
                            {showPermissions ? (
                                <PermissionList catalog={catalog} granted={permissions} />
                            ) : (
                                <FeatureUnavailable compact title={t("adminBody.users.permLater")} description={t("adminBody.users.permLaterText")} />
                            )}
                        </CardContent>
                        {showPermissions && (
                            <CardFooter>
                                <span className="text-fg-muted">{t("adminBody.users.permPerRole")}</span>
                                <Link href={routes.admin.roles} className="font-medium text-primary-soft-fg hover:underline">
                                    {t("adminBody.users.editRole")}
                                </Link>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

function StatusCallout({ user, now, t }: { user: User; now: string; t: Translator }) {
    const locale = t.locale === "en" ? "en" : "vi";
    if (user.status === "active") return null;
    return user.status === "invited" ? (
        <Callout tone="info" icon={Clock} title={t("adminBody.users.invitePendingTitle")} role="status">
            {t("adminBody.users.invitePendingText", { when: formatRelative(user.createdAt, now, locale), name: user.name })}
        </Callout>
    ) : (
        <Callout tone="danger" icon={Ban} title={t("adminBody.users.suspendedTitle")} role="status">
            {t("adminBody.users.suspendedText", { name: user.name })}
        </Callout>
    );
}

function LinkedProfile({
    user,
    profile,
    showCredentials,
    t,
}: {
    user: User;
    profile: Fighter | Coach | Doctor | null;
    /** False where the service keeps no certifications or experience: those rows are left out rather than shown as empty. */
    showCredentials: boolean;
    t: Translator;
}) {
    if (!profile) {
        return user.role === "admin" ? (
            <EmptyState compact title={t("adminBody.users.noProfile")} description={t("adminBody.users.noProfileText")} />
        ) : (
            <EmptyState
                compact
                title={t("adminBody.users.noLinked", { role: ROLE_LABELS[user.role] })}
                description={t("adminBody.users.noLinkedText", { name: user.name })}
            />
        );
    }

    if (user.role === "fighter" && "weightClass" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: t("adminBody.users.weight"), value: WEIGHT_CLASS_LABELS[profile.weightClass] },
                    { label: t("adminBody.users.discipline"), value: profile.primaryDiscipline ?? NOT_RECORDED },
                    { label: t("adminBody.users.level"), value: labelOf(TRAINING_LEVEL_LABELS, profile.level) ?? NOT_RECORDED },
                    { label: t("adminBody.users.stance"), value: labelOf(STANCE_LABELS, profile.stance) ?? NOT_RECORDED },
                    { label: t("adminBody.users.record"), value: profile.record ? `${profile.record.wins}–${profile.record.losses}–${profile.record.draws}` : NOT_RECORDED },
                    { label: t("adminBody.users.joined"), value: formatDate(profile.joinedAt) },
                ]}
            />
        );
    }

    if (user.role === "coach" && "yearsExperience" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: t("adminBody.users.specialty"), value: profile.specialty || <span className="font-normal text-fg-subtle">{NOT_RECORDED}</span> },
                    ...(showCredentials ? [{ label: t("adminBody.users.experience"), value: profile.yearsExperience === null ? NOT_RECORDED : plural(t, "adminBody.users.years", profile.yearsExperience) }] : []),
                    { label: t("adminBody.users.roster"), value: plural(t, "adminBody.users.fighters", profile.fighterIds.length) },
                    ...(showCredentials
                        ? [
                              {
                                  label: t("adminBody.users.certs"),
                                  wide: true,
                                  value: profile.certifications.length > 0 ? profile.certifications.join(" · ") : <span className="font-normal text-fg-subtle">{t("adminBody.users.noneRecorded")}</span>,
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
                    { label: t("adminBody.users.specialty"), value: profile.specialty },
                    {
                        label: t("adminBody.users.license"),
                        value: profile.licenseNumber ? <code className="font-mono text-[13px]">{profile.licenseNumber}</code> : <span className="font-normal text-fg-subtle">{NOT_RECORDED}</span>,
                    },
                    { label: t("adminBody.users.patients"), value: plural(t, "adminBody.users.fighters", profile.fighterIds.length) },
                ]}
            />
        );
    }

    return <EmptyState compact title={t("adminBody.users.profileUnavailable")} description={t("adminBody.users.profileUnavailableText")} />;
}
