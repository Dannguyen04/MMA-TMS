import { apiFetch } from "./client";
import { withQuery } from "./query";
import type { UserListPage, UserRole } from "./types";

export function listUsers(query?: {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: "ACTIVE" | "INACTIVE";
  search?: string;
}) {
  return apiFetch<UserListPage>(withQuery("/users", query));
}
