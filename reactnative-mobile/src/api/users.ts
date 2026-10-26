import { apiFetch } from "./client";
import { withQuery } from "./query";
import type { PublicUser, UserListPage, UserRole } from "./types";
import type { WeightClass } from "@/constants/weight-classes";

export function listUsers(query?: {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: "ACTIVE" | "INACTIVE";
  search?: string;
}) {
  return apiFetch<UserListPage>(withQuery("/users", query));
}

/** Khớp fighterProfileSchema (users.model.ts) — chỉ các trường màn quản lý dùng. */
export type FighterProfileInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
  nationality?: string | null;
  gym?: string | null;
};

export type CoachProfileInput = {
  firstName: string;
  lastName: string;
  isHeadCoach?: boolean;
  specialization?: string | null;
};

export type DoctorProfileInput = {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialization?: string | null;
};

/** createUserSchema: discriminated union theo role; GUEST không được tạo ở đây. */
export type CreateUserInput =
  | { email: string; password: string; role: "FIGHTER"; profile: FighterProfileInput }
  | { email: string; password: string; role: "COACH"; profile: CoachProfileInput }
  | { email: string; password: string; role: "DOCTOR"; profile: DoctorProfileInput }
  | { email: string; password: string; role: "ADMIN" };

/** updateUserSchema: chỉ FIGHTER/COACH/DOCTOR, profile là partial khác rỗng. */
export type UpdateUserInput =
  | { role: "FIGHTER"; profile: Partial<FighterProfileInput> }
  | { role: "COACH"; profile: Partial<CoachProfileInput> }
  | { role: "DOCTOR"; profile: Partial<DoctorProfileInput> };

/** POST /users (users.create). */
export function createUser(user: CreateUserInput) {
  return apiFetch<PublicUser>("/users", { method: "POST", body: JSON.stringify({ user }) });
}

/** PATCH /users/:id (users.update). */
export function updateUser(id: string, user: UpdateUserInput) {
  return apiFetch<PublicUser>(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ user }) });
}

/** DELETE /users/:id (users.delete) — xóa mềm, trả `{ id, deleted: true }`. */
export function deleteUser(id: string) {
  return apiFetch<{ id: string; deleted: true }>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}
