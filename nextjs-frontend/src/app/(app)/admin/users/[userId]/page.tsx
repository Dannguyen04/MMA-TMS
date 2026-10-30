import { Ban, Clock, IdCard, KeyRound, ScrollText, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AccountActions } from "@/components/admin/account-actions";
import { countLabel, roleParams } from "@/components/admin/admin-format";
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
import { CARE_ROLES } from "@/lib/domain/care-team";
import { stanceLabel, trainingLevelLabel, weightClassLabel } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, User } from "@/lib/domain/types";
import { dayKey, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
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
    await requireRole("admin");
    const { t } = await getTranslator();
    const { userId } = await params;
    const detail = await loadUserDetail(userId);
    return { title: detail ? t("screens.admin.meta.user", { name: detail.user.name }) : t("screens.admin.meta.userNotFound") };
}

export default async function AdminUserDetailPage({ params, searchParams }: PageProps<"/admin/users/[userId]">) {
    const admin = await requireRole("admin");
    const { t, locale } = await getTranslator();
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

    const role = roleParams(t, user.role, locale);
    const isSelf = user.id === admin.id;
    const roleLockReason = isSelf
        ? t("screens.admin.user.ownRole")
        : user.profileId !== null
          ? t("screens.admin.user.linkedRole", { name: user.name, ...role })
          : null;
    const subtle = (text: string) => <span className="font-normal text-fg-subtle">{text}</span>;

    // Fields the user service doesn't keep are left out rather than shown as empty.
    const accountItems: (DescriptionItem | false)[] = [
        { label: t("screens.admin.common.email"), value: user.email },
        adminFeatureAvailable("accountPhone") && { label: t("screens.admin.user.phone"), value: user.phone ?? subtle(t("screens.admin.user.notProvided")) },
        { label: t("screens.admin.common.jobTitle"), value: user.title || subtle(t("screens.admin.common.notSet")) },
        { label: t("screens.admin.common.role"), value: role.role },
        { label: t("screens.admin.users.created"), value: formatDate(user.createdAt, locale) },
        adminFeatureAvailable("lastActive") && {
            label: t("screens.admin.users.lastActive"),
            value: user.lastActiveAt ? (
                <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt, locale)}>
                    {formatRelative(user.lastActiveAt, now, locale)}
                </time>
            ) : (
                subtle(user.status === "invited" ? t("screens.admin.user.notSignedIn") : t("screens.admin.common.never"))
            ),
        },
        { label: t("screens.admin.user.accountId"), value: <code className="font-mono text-[13px]">{user.id}</code>, wide: true },
    ];

    // A new fighter can't train yet: the notice names the next step instead of ending at "can sign in".
    const missing = careTeam ? CARE_ROLES.filter((careRole) => careTeam[careRole]?.length === 0) : [];
    const nextStep = missing.includes("doctor")
        ? missing.includes("coach")
            ? t("screens.admin.user.next.both")
            : t("screens.admin.user.next.doctor")
        : missing.includes("coach")
          ? t("screens.admin.user.next.coach")
          : "";
    const withNextStep = (text: string) => (nextStep ? `${text} ${nextStep}` : text);
    const notices = {
        invited: { title: t("screens.admin.user.invitedTitle"), description: withNextStep(t("screens.admin.user.invitedDescription", { email: user.email })) },
        created: { title: t("screens.admin.user.createdTitle"), description: withNextStep(t("screens.admin.user.createdDescription", { name: user.name })) },
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
                back={{ href: routes.admin.users, label: t("screens.admin.common.users") }}
                eyebrow={t("screens.admin.user.eyebrow")}
                title={
                    <span className="flex items-center gap-4">
                        <Avatar name={user.name} size="lg" shape={user.role === "fighter" ? "octagon" : "circle"} />
                        <span className="min-w-0 break-words">{user.name}</span>
                    </span>
                }
                description={[user.title, user.email].filter(Boolean).join(" · ")}
                meta={
                    <>
                        <RoleBadge role={user.role} locale={locale} />
                        <UserStatusBadge status={user.status} locale={locale} />
                        {isSelf && <Badge tone="primary">{t("screens.admin.user.yourAccount")}</Badge>}
                    </>
                }
                actions={headerActions}
            />

            <div className="flex flex-col gap-6">
                <StatusCallout user={user} now={now} t={t} locale={locale} />

                {/* Where the fighter is on the way to training; the care team card below holds the assign actions. */}
                {journey && !journey.complete && <FighterJourney journey={journey} variant="compact" locale={locale} />}

                {/* A fighter's care team decides whether they can train, so it leads the page; an empty role is its next step. */}
                {fighterProfile && careTeam && assignableStaff && (
                    <CareTeamCard fighterId={fighterProfile.id} fighterName={user.name} team={careTeam} staff={assignableStaff} />
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title={t("screens.admin.user.account")} icon={<IdCard />} />
                            <CardContent>
                                <DescriptionList items={accountItems.filter((item) => item !== false)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("screens.admin.user.linkedProfile")}
                                description={profile ? t("screens.admin.user.linkedProfileDescription", role) : undefined}
                                icon={<UserRound />}
                            />
                            <CardContent>
                                <LinkedProfile user={user} profile={profile} showCredentials={adminFeatureAvailable("coachCredentials")} t={t} locale={locale} />
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title={t("screens.admin.user.recentActivity")}
                                description={
                                    showActivity
                                        ? recentAudit.length === 0
                                            ? t("screens.admin.user.nothingRecorded")
                                            : t("screens.admin.user.latestActions", { actions: countLabel(t, "screens.admin.count.actions", recentAudit.length), name: user.name })
                                        : undefined
                                }
                                icon={<ScrollText />}
                            />
                            {!showActivity ? (
                                <CardContent>
                                    <FeatureUnavailable
                                        compact
                                        title={t("screens.admin.user.activityUnavailableTitle")}
                                        description={t("screens.admin.user.activityUnavailableDescription")}
                                    />
                                </CardContent>
                            ) : recentAudit.length === 0 ? (
                                <CardContent>
                                    <EmptyState compact title={t("screens.admin.user.noActivityTitle")} description={t("screens.admin.user.noActivityDescription")} />
                                </CardContent>
                            ) : (
                                <>
                                    <AuditActivityList entries={recentAudit} now={now} showActor={false} locale={locale} className="border-t border-border" />
                                    <CardFooter>
                                        <span className="text-fg-muted">{t("screens.admin.user.latestEntries")}</span>
                                        <Link href={hrefWith(routes.admin.auditLogs, {}, { q: user.name })} className="font-medium text-primary-soft-fg hover:underline">
                                            {t("screens.admin.user.viewInAudit")}
                                        </Link>
                                    </CardFooter>
                                </>
                            )}
                        </Card>
                    </div>

                    <Card className="min-w-0">
                        <CardHeader
                            title={t("screens.admin.user.permissions")}
                            description={
                                showPermissions
                                    ? t("screens.admin.user.permissionsFrom", { permissions: countLabel(t, "screens.admin.count.permissions", permissions.length), ...role })
                                    : undefined
                            }
                            icon={<KeyRound />}
                        />
                        <CardContent>
                            {showPermissions ? (
                                <PermissionList catalog={catalog} granted={permissions} locale={locale} />
                            ) : (
                                <FeatureUnavailable
                                    compact
                                    title={t("screens.admin.user.permissionsUnavailableTitle")}
                                    description={t("screens.admin.user.permissionsUnavailableDescription")}
                                />
                            )}
                        </CardContent>
                        {showPermissions && (
                            <CardFooter>
                                <span className="text-fg-muted">{t("screens.admin.user.perRole")}</span>
                                <Link href={routes.admin.roles} className="font-medium text-primary-soft-fg hover:underline">
                                    {t("screens.admin.user.editRole")}
                                </Link>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

interface LocalisedProps {
    t: Translator;
    locale: Locale;
}

function StatusCallout({ user, now, t, locale }: { user: User; now: string } & LocalisedProps) {
    if (user.status === "active") return null;
    return user.status === "invited" ? (
        <Callout tone="info" icon={Clock} title={t("screens.admin.user.pendingTitle")} role="status">
            {t("screens.admin.user.pendingBody", { when: formatRelative(user.createdAt, now, locale), name: user.name })}
        </Callout>
    ) : (
        <Callout tone="danger" icon={Ban} title={t("screens.admin.user.suspendedTitle")} role="status">
            {t("screens.admin.user.suspendedBody", { name: user.name })}
        </Callout>
    );
}

function LinkedProfile({
    user,
    profile,
    showCredentials,
    t,
    locale,
}: {
    user: User;
    profile: Fighter | Coach | Doctor | null;
    /** False where the service keeps no certifications or experience: those rows are left out rather than shown as empty. */
    showCredentials: boolean;
} & LocalisedProps) {
    const notRecorded = t("screens.admin.common.notRecorded");
    const subtleNotRecorded = <span className="font-normal text-fg-subtle">{notRecorded}</span>;
    if (!profile) {
        return user.role === "admin" ? (
            <EmptyState compact title={t("screens.admin.user.noProfileTitle")} description={t("screens.admin.user.noProfileDescription")} />
        ) : (
            <EmptyState
                compact
                title={t("screens.admin.user.notLinkedTitle", roleParams(t, user.role, locale))}
                description={t("screens.admin.user.notLinkedDescription", { name: user.name })}
            />
        );
    }

    if (user.role === "fighter" && "weightClass" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: t("screens.admin.user.weightClass"), value: weightClassLabel(profile.weightClass, locale) },
                    { label: t("screens.admin.user.discipline"), value: profile.primaryDiscipline ?? notRecorded },
                    { label: t("screens.admin.user.level"), value: profile.level ? trainingLevelLabel(profile.level, locale) : notRecorded },
                    { label: t("screens.admin.user.stance"), value: profile.stance ? stanceLabel(profile.stance, locale) : notRecorded },
                    {
                        label: t("screens.admin.user.record"),
                        value: profile.record ? `${profile.record.wins}–${profile.record.losses}–${profile.record.draws}` : notRecorded,
                    },
                    { label: t("screens.admin.user.joined"), value: formatDate(profile.joinedAt, locale) },
                ]}
            />
        );
    }

    if (user.role === "coach" && "yearsExperience" in profile) {
        return (
            <DescriptionList
                columns={3}
                items={[
                    { label: t("screens.admin.user.specialty"), value: profile.specialty || subtleNotRecorded },
                    ...(showCredentials
                        ? [
                              {
                                  label: t("screens.admin.user.experience"),
                                  value: profile.yearsExperience === null ? notRecorded : countLabel(t, "screens.admin.count.years", profile.yearsExperience),
                              },
                          ]
                        : []),
                    { label: t("screens.admin.user.roster"), value: countLabel(t, "screens.admin.count.fighters", profile.fighterIds.length) },
                    ...(showCredentials
                        ? [
                              {
                                  label: t("screens.admin.user.certifications"),
                                  wide: true,
                                  value:
                                      profile.certifications.length > 0 ? (
                                          profile.certifications.join(" · ")
                                      ) : (
                                          <span className="font-normal text-fg-subtle">{t("screens.admin.user.noneRecorded")}</span>
                                      ),
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
                    { label: t("screens.admin.user.specialty"), value: profile.specialty },
                    {
                        label: t("screens.admin.user.license"),
                        value: profile.licenseNumber ? <code className="font-mono text-[13px]">{profile.licenseNumber}</code> : subtleNotRecorded,
                    },
                    { label: t("screens.admin.user.patients"), value: countLabel(t, "screens.admin.count.fighters", profile.fighterIds.length) },
                ]}
            />
        );
    }

    return <EmptyState compact title={t("screens.admin.user.profileUnavailableTitle")} description={t("screens.admin.user.profileUnavailableDescription")} />;
}
