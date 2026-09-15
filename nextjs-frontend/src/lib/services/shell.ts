import "server-only";

import type { NavBadgeKey } from "@/components/layout/navigation";
import { accessibleFighterIds } from "@/lib/auth/access";
import type { User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import { getNotificationSummary } from "./notifications";

/** Counts shown as badges in the navigation. Cheap reads, computed once per layout render. */
export function getNavBadgeCounts(user: User): Partial<Record<NavBadgeKey, number>> {
    const store = db();
    const counts: Partial<Record<NavBadgeKey, number>> = {
        notifications: getNotificationSummary(user.id).unread,
    };
    const fighterIds = accessibleFighterIds(user);
    const inScope = (fighterId: string) => fighterIds === "all" || fighterIds.includes(fighterId);

    if (user.role === "coach") {
        // Completed analyses on assigned fighters that no coach has reviewed yet.
        counts.reviewQueue = store.aiAnalyses.filter((a) => inScope(a.fighterId) && a.coachReview === null).length;
    }
    if (user.role === "doctor") {
        counts.newAlerts = store.abnormalMovementAlerts.filter((a) => inScope(a.fighterId) && a.status === "new").length;
    }
    if (user.role === "admin") {
        counts.failedJobs = store.aiJobs.filter((j) => j.status === "failed").length;
    }
    return counts;
}
