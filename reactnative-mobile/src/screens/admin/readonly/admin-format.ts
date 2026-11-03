import type { PublicUser, UserListPage, Paginated } from "@/api/types";
import { isFighterProfile } from "@/api/types";
import { adminRo } from "@/i18n/admin-ro";
import type { ChipSpec } from "@/screens/coach/readonly/ro-format";

export const ACTIVE_CHIP: ChipSpec = { label: adminRo.active, tone: "success", icon: "success" };
export const INACTIVE_CHIP: ChipSpec = { label: adminRo.inactive, tone: "attention", icon: "ban" };

export function statusChip(user: Pick<PublicUser, "isActive">): ChipSpec {
  return user.isActive ? ACTIVE_CHIP : INACTIVE_CHIP;
}

/** Tên hiển thị: tên hồ sơ, nếu chưa có thì phần trước @ của email. */
export function userDisplayName(user: Pick<PublicUser, "email" | "profile">): string {
  const p = user.profile;
  const full = p ? `${p.firstName} ${p.lastName}`.trim() : "";
  if (full) return full;
  const local = user.email.split("@")[0]?.trim();
  return local || adminRo.users.noName;
}

export function roleLabel(role: string): string {
  return (adminRo.role as Record<string, string>)[role] ?? adminRo.users.noName;
}

/** Chuyển trang `/users` ({items,total,page,limit}) sang dạng phân trang chung. */
export function toPaginated(res: UserListPage): Paginated<PublicUser> {
  return { data: res.items, total: res.total, hasNextPage: res.page * res.limit < res.total };
}

/** Id hồ sơ võ sĩ của một tài khoản FIGHTER (để mở hồ sơ), nếu có. */
export function fighterIdOf(user: Pick<PublicUser, "role" | "profile">): string | null {
  if (user.role !== "FIGHTER" || !isFighterProfile(user.profile)) return null;
  return user.profile.id || null;
}

export type DoctorRow = { id: string; name: string; current: boolean; from: string; to: string | null };

/** Thông tin phân công bác sĩ: đang phụ trách trước, rồi mới nhất trước. `names` bù tên khi API chưa có `doctorName`. */
export function doctorRows(
  rows: readonly { id: string; doctorId: string; doctorName?: string; startsAt: string; endsAt: string | null }[],
  names: Record<string, string> = {},
): DoctorRow[] {
  return rows
    .map((r) => ({
      id: r.id,
      name: r.doctorName?.trim() || names[r.doctorId] || adminRo.doctors.unnamed,
      current: r.endsAt == null,
      from: r.startsAt,
      to: r.endsAt,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.from) - Date.parse(a.from));
}
