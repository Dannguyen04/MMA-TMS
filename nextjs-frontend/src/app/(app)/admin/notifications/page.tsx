import { CalendarClock, FilePen, Send } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { countLabel, ROLE_ORDER } from "@/components/admin/admin-format";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { BroadcastTable } from "@/components/admin/broadcast-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import type { NotificationBroadcast, Role } from "@/lib/domain/types";
import { APP_TIMEZONE, dayKey, formatNumber, formatRelative, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { listBroadcasts, listUsers } from "@/lib/services/admin";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { sum } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.broadcasts") };
}

const DAY_MS = 86_400_000;

export default async function AdminNotificationsPage() {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("broadcasts")) {
        return (
            <>
                <PageHeader title={t("screens.admin.meta.broadcasts")} />
                <FeatureUnavailable
                    service="notification"
                    title={t("screens.admin.broadcasts.unavailable")}
                    description={t("screens.admin.common.unavailable.notification")}
                />
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
    const section = { now, creatorNames, t, locale };

    return (
        <>
            <PageHeader
                title={t("screens.admin.meta.broadcasts")}
                description={t("screens.admin.broadcasts.description")}
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
                <section aria-label={t("screens.admin.broadcasts.summary")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label={t("screens.admin.broadcasts.scheduled")}
                        value={formatNumber(scheduled.length)}
                        icon={<CalendarClock aria-hidden />}
                        hint={
                            scheduled[0]?.scheduledFor
                                ? t("screens.admin.broadcasts.nextSends", { when: formatRelative(scheduled[0].scheduledFor, now, locale) })
                                : t("screens.admin.broadcasts.nothingQueued")
                        }
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.admin.broadcasts.drafts")}
                        value={formatNumber(drafts.length)}
                        icon={<FilePen aria-hidden />}
                        hint={drafts.length > 0 ? t("screens.admin.broadcasts.draftsHint") : t("screens.admin.broadcasts.noDrafts")}
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.admin.broadcasts.sentLast30")}
                        value={formatNumber(sentLast30.length)}
                        icon={<Send aria-hidden />}
                        hint={t("screens.admin.broadcasts.deliveries", {
                            deliveries: countLabel(t, "screens.admin.count.deliveries", sum(sentLast30.map((b) => b.recipientCount))),
                        })}
                        locale={locale}
                    />
                </section>

                <BroadcastSection id="scheduled" icon={<CalendarClock />} broadcasts={scheduled} {...section} />
                <BroadcastSection id="drafts" icon={<FilePen />} broadcasts={drafts} {...section} />
                <BroadcastSection id="sent" icon={<Send />} broadcasts={sent} {...section} />
            </div>
        </>
    );
}

/** One table of broadcasts; its wording comes from `screens.admin.broadcasts.section.<id>.*`. */
function BroadcastSection({
    id,
    icon,
    broadcasts,
    now,
    creatorNames,
    t,
    locale,
}: {
    id: "scheduled" | "drafts" | "sent";
    icon: ReactNode;
    broadcasts: NotificationBroadcast[];
    now: string;
    creatorNames: Record<string, string>;
    t: Translator;
    locale: Locale;
}) {
    const text = (part: "title" | "description" | "empty" | "emptyTitle" | "caption") => t(`screens.admin.broadcasts.section.${id}.${part}` as MessageKey);
    return (
        <Card className="overflow-hidden">
            <CardHeader title={t("screens.admin.broadcasts.sectionTitle", { title: text("title"), n: broadcasts.length })} description={text("description")} icon={icon} />
            {broadcasts.length === 0 ? (
                <CardContent>
                    <EmptyState compact title={text("emptyTitle")} description={text("empty")} />
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <BroadcastTable broadcasts={broadcasts} caption={text("caption")} now={now} creatorNames={creatorNames} locale={locale} />
                </div>
            )}
        </Card>
    );
}
