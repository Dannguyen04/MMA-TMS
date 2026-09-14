import { CalendarClock, FilePen, Send } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ROLE_ORDER } from "@/components/admin/admin-format";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { BroadcastTable } from "@/components/admin/broadcast-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import type { NotificationBroadcast, Role } from "@/lib/domain/types";
import { APP_TIMEZONE, dayKey, formatNumber, formatRelative, formatTime, pluralize } from "@/lib/format";
import { listBroadcasts, listUsers } from "@/lib/services/admin";
import { sum } from "@/lib/utils";

export const metadata: Metadata = { title: "Broadcasts" };

const DAY_MS = 86_400_000;

export default async function AdminNotificationsPage() {
    await requireRole("admin");
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
                title="Broadcasts"
                description="Announcements sent to every account in chosen roles — schedule changes, gym news and platform updates."
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
                <section aria-label="Broadcast summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Scheduled"
                        value={formatNumber(scheduled.length)}
                        icon={<CalendarClock aria-hidden />}
                        hint={scheduled[0]?.scheduledFor ? `Next sends ${formatRelative(scheduled[0].scheduledFor, now)}` : "Nothing queued to send"}
                    />
                    <StatCard label="Drafts" value={formatNumber(drafts.length)} icon={<FilePen aria-hidden />} hint={drafts.length > 0 ? "Not visible to anyone yet" : "No drafts"} />
                    <StatCard
                        label="Sent · last 30 days"
                        value={formatNumber(sentLast30.length)}
                        icon={<Send aria-hidden />}
                        hint={`${pluralize(sum(sentLast30.map((b) => b.recipientCount)), "delivery", "deliveries")} in total`}
                    />
                </section>

                <BroadcastSection
                    title="Scheduled"
                    description="Sends automatically at the listed time"
                    icon={<CalendarClock />}
                    broadcasts={scheduled}
                    empty="Nothing is scheduled. Choose “Schedule for later” when creating a broadcast."
                    now={now}
                    creatorNames={creatorNames}
                />
                <BroadcastSection
                    title="Drafts"
                    description="Saved but not sent"
                    icon={<FilePen />}
                    broadcasts={drafts}
                    empty="No drafts right now."
                    now={now}
                    creatorNames={creatorNames}
                />
                <BroadcastSection
                    title="Sent"
                    description="Delivered broadcasts, newest first"
                    icon={<Send />}
                    broadcasts={sent}
                    empty="No broadcasts have been sent yet."
                    now={now}
                    creatorNames={creatorNames}
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
}: {
    title: string;
    description: string;
    icon: ReactNode;
    broadcasts: NotificationBroadcast[];
    empty: string;
    now: string;
    creatorNames: Record<string, string>;
}) {
    return (
        <Card className="overflow-hidden">
            <CardHeader title={`${title} · ${broadcasts.length}`} description={description} icon={icon} />
            {broadcasts.length === 0 ? (
                <CardContent>
                    <EmptyState compact title={`No ${title.toLowerCase()} broadcasts`} description={empty} />
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <BroadcastTable broadcasts={broadcasts} caption={`${title} broadcasts`} now={now} creatorNames={creatorNames} />
                </div>
            )}
        </Card>
    );
}
