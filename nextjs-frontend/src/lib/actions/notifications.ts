"use server";

import { revalidatePath } from "next/cache";

import { getSessionAccount } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { canMarkAllNotificationsRead, markAllNotificationsRead, markNotificationRead, readerOf, type NotificationReader } from "@/lib/services/notifications";
import { actionError, actionSuccess, type ActionState } from "./state";

async function signedInReader(): Promise<NotificationReader | null> {
    const account = await getSessionAccount();
    return account && readerOf(account);
}

export async function markAllRead(): Promise<ActionState> {
    const [reader, { t }] = await Promise.all([signedInReader(), getTranslator()]);
    if (!reader) return actionError(t("notifications.error.sessionExpired"));
    if (!canMarkAllNotificationsRead()) return actionError(t("notifications.error.oneAtATime"));
    const count = await markAllNotificationsRead(reader);
    revalidatePath("/", "layout");
    return actionSuccess(
        count === 0
            ? t("notifications.allCaughtUp")
            : t(count === 1 ? "notifications.markedMultipleRead" : "notifications.markedMultipleRead.plural", { count }),
    );
}

export async function markRead(notificationId: string): Promise<ActionState> {
    const [reader, { t }] = await Promise.all([signedInReader(), getTranslator()]);
    if (!reader) return actionError(t("notifications.error.sessionExpired"));
    if (!(await markNotificationRead(reader, notificationId))) return actionError(t("notifications.error.notFound"));
    revalidatePath("/", "layout");
    return actionSuccess(t("notifications.markedRead"));
}
