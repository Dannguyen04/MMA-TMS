import { isApiError, type PublicUser } from "@/api";
import { coach } from "@/i18n/coach";
import { mapApiMessage } from "@/session/map-api-message";
import type { Href } from "expo-router";

export function coachHref(path: string): Href {
  return path as Href;
}

export function coachErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 403) {
    return coach.forbidden;
  }
  return mapApiMessage(error);
}

export function coachProfileId(user: PublicUser | null): string | null {
  if (!user || user.role !== "COACH" || !user.profile?.id) return null;
  return user.profile.id;
}

export function fighterDisplayName(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return date.toLocaleString("vi-VN");
}

export function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nowTimeHm() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function localIsoFromDateTime(dateOnly: string, timeHm: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeHm);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const stamp = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(stamp.valueOf())) return null;
  return stamp.toISOString();
}

export function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
