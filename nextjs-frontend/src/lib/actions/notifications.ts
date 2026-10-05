"use server";

import { revalidatePath } from "next/cache";

import { getSessionAccount } from "@/lib/auth/session";
import { canMarkAllNotificationsRead, markAllNotificationsRead, markNotificationRead, readerOf, type NotificationReader } from "@/lib/services/notifications";
import { actionError, actionSuccess, type ActionState } from "./state";

const SIGNED_OUT = "Your session has expired. Sign in again.";

async function signedInReader(): Promise<NotificationReader | null> {
    const account = await getSessionAccount();
    return account && readerOf(account);
}

export async function markAllRead(): Promise<ActionState> {
    const reader = await signedInReader();
    if (!reader) return actionError(SIGNED_OUT);
    if (!canMarkAllNotificationsRead()) return actionError("Notifications can only be marked read one at a time for now.");
    const count = await markAllNotificationsRead(reader);
    revalidatePath("/", "layout");
    return actionSuccess(count === 0 ? "You're all caught up." : `Marked ${count} notification${count === 1 ? "" : "s"} as read.`);
}

export async function markRead(notificationId: string): Promise<ActionState> {
    const reader = await signedInReader();
    if (!reader) return actionError(SIGNED_OUT);
    if (!(await markNotificationRead(reader, notificationId))) return actionError("That notification no longer exists.");
    revalidatePath("/", "layout");
    return actionSuccess("Marked as read.");
}
