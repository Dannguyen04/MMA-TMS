import "server-only";

import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/auth/session";
import type { Fighter, User } from "@/lib/domain/types";

/**
 * Quyền truy cập bản ghi do backend cấp qua phiên hiện tại.
 */
export function accessibleFighterIds(user: User): string[] | "all" {
    if (!hasPermission(user, "fighters:read")) return [];

    switch (user.role) {
        case "fighter":
            return user.profileId ? [user.profileId] : [];
        case "coach":
        case "doctor":
            return user.assignmentScope?.fighterIds ?? [];
        case "admin":
            return "all";
    }
}

export function canAccessFighter(user: User, fighterId: string): boolean {
    const ids = accessibleFighterIds(user);
    return ids === "all" || ids.includes(fighterId);
}

/** Chỉ bác sĩ có quyền y tế và được phân công mới được xem hồ sơ lâm sàng. */
export function canAccessFighterClinically(user: User, fighterId: string): boolean {
    if (user.role !== "doctor" || !hasPermission(user, "medical:read")) return false;
    return user.assignmentScope?.fighterIds.includes(fighterId) ?? false;
}

/** Tải võ sĩ sau khi kiểm tra phạm vi; không tự suy diễn quyền từ dữ liệu demo. */
export async function requireFighterAccess(user: User, fighterId: string): Promise<Fighter> {
    if (!canAccessFighter(user, fighterId)) notFound();

    const { getFighter } = await import("@/lib/services/people");
    const fighter = await getFighter(fighterId);
    if (!fighter) notFound();
    return fighter;
}
