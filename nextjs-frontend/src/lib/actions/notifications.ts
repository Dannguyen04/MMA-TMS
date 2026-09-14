"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notifications";
import { actionError, actionSuccess, type ActionState } from "./state";

export async function markAllRead(): Promise<ActionState> {
    const user = await getCurrentUser();
    if (!user) return actionError("Your session has expired. Sign in again.");
    const count = markAllNotificationsRead(user.id);
    revalidatePath("/", "layout");
    return actionSuccess(count === 0 ? "You're all caught up." : `Marked ${count} notification${count === 1 ? "" : "s"} as read.`);
}

export async function markRead(notificationId: string): Promise<ActionState> {
    const user = await getCurrentUser();
    if (!user) return actionError("Your session has expired. Sign in again.");
    if (!markNotificationRead(user.id, notificationId)) return actionError("That notification no longer exists.");
    revalidatePath("/", "layout");
    return actionSuccess("Marked as read.");
}
