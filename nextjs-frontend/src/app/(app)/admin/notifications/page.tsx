import { CalendarClock, FilePen, Send } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ROLE_ORDER } from "@/components/admin/admin-format";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { BroadcastTable } from "@/components/admin/broadcast-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { NotificationBroadcast, Role } from "@/lib/domain/types";
import { APP_TIMEZONE, dayKey, formatNumber, formatRelative, formatTime } from "@/lib/format";
import { plural, type Translator } from "@/lib/i18n/translate";
import { listBroadcasts, listUsers } from "@/lib/services/admin";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { sum } from "@/lib/utils";

export const metadata: Metadata = { title: "Broadcasts" };

const DAY_MS = 86_400_000;

export default async function AdminNotificationsPage() {
    const { t } = await getTranslator();
    await requireRole("admin");
    if (!platformFeatureAvailable("broadcasts")) {
        return (
            <>
                <PageHeader title={t("screens.misc.adminPages.broadcasts.title")} />
                <FeatureUnavailable service="notification" title={t("adminBody.broadcast.unavailable")} />
            </>
        );
    }
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const [broadcasts, users] = await Promise.all([listBroadcasts(), listUsers()]);
    const activeCounts = Object.fromEntries(
        ROLE_ORDER.map((role) => [role, users.filter((u) => u.role === role && u.status === "active").length]),
    ) as Record<Role, number>;
    const creatorNames = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const scheduled = broadcasts
        .filter((b) => b.status === "scheduled")
        .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
    const drafts = broadcasts.filter((b) => b.status === "draft");
    const sent = broadcasts.filter((b) => b.status === "sent").sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
    const sentLast30 = sent.filter((b) => b.sentAt && nowDate.getTime() - Date.parse(b.sentAt) <= 30 * DAY_MS);

    const tomorrow = new Date(nowDate.getTime() + DAY_MS);

    return (
        <>
            <PageHeader
                title={t("screens.misc.adminPages.broadcasts.title")}
                description={t("adminBody.broadcast.description")}
                actions={
                    <BroadcastComposer
                        activeCounts={activeCounts}
                        minSchedule={`${dayKey(nowDate)}T${formatTime(nowDate)}`}
                        defaultSchedule={`${dayKey(tomorrow)}T09:00`}
                        timezone={APP_TIMEZONE}
                    />
                }
            />

            <div className="flex flex-col gap-6">
                <section aria-label={t("adminBody.broadcast.summary")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label={t("adminBody.broadcast.scheduled")}
                        value={formatNumber(scheduled.length)}
                        icon={<CalendarClock aria-hidden />}
                        hint={scheduled[0]?.scheduledFor ? t("adminBody.broadcast.next", { when: formatRelative(scheduled[0].scheduledFor, now, t.locale === "en" ? "en" : "vi") }) : t("adminBody.broadcast.nothingQueued")}
                    />
                    <StatCard label={t("adminBody.broadcast.drafts")} value={formatNumber(drafts.length)} icon={<FilePen aria-hidden />} hint={drafts.length > 0 ? t("adminBody.broadcast.notVisible") : t("adminBody.broadcast.noDraftsHint")} />
                    <StatCard
                        label={t("adminBody.broadcast.sentWindow")}
                        value={formatNumber(sentLast30.length)}
                        icon={<Send aria-hidden />}
                        hint={plural(t, "adminBody.broadcast.deliveries", sum(sentLast30.map((b) => b.recipientCount)))}
                    />
                </section>

                <BroadcastSection
                    title={t("adminBody.broadcast.scheduled")}
                    description={t("adminBody.broadcast.scheduledDesc")}
                    icon={<CalendarClock />}
                    broadcasts={scheduled}
                    empty={t("adminBody.broadcast.scheduledEmpty")}
                    now={now}
                    creatorNames={creatorNames}
                    t={t}
                />
                <BroadcastSection
                    title={t("adminBody.broadcast.drafts")}
                    description={t("adminBody.broadcast.draftsDesc")}
                    icon={<FilePen />}
                    broadcasts={drafts}
                    empty={t("adminBody.broadcast.draftsEmpty")}
                    now={now}
                    creatorNames={creatorNames}
                    t={t}
                />
                <BroadcastSection
                    title={t("adminBody.broadcast.sent")}
                    description={t("adminBody.broadcast.sentDesc")}
                    icon={<Send />}
                    broadcasts={sent}
                    empty={t("adminBody.broadcast.sentEmpty")}
                    now={now}
                    creatorNames={creatorNames}
                    t={t}
                />
            </div>
        </>
    );
}

function BroadcastSection({
    title,
    description,
    icon,
    broadcasts,
    empty,
    now,
    creatorNames,
    t,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    broadcasts: NotificationBroadcast[];
    empty: string;
    now: string;
    creatorNames: Record<string, string>;
    t: Translator;
}) {
    return (
        <Card className="overflow-hidden">
            <CardHeader title={`${title} · ${broadcasts.length}`} description={description} icon={icon} />
            {broadcasts.length === 0 ? (
                <CardContent>
                    <EmptyState compact title={t("adminBody.broadcast.sectionEmpty", { title: title.toLocaleLowerCase() })} description={empty} />
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <BroadcastTable broadcasts={broadcasts} caption={title} now={now} creatorNames={creatorNames} />
                </div>
            )}
        </Card>
    );
}
