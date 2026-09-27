import { fighter } from "@/i18n/fighter";
import { vi } from "@/i18n/vi";
import type { SessionStatus, SessionType, TrainingPlanStatus } from "@/api";

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string): string {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("vi-VN");
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} phút`;
}

export function sessionStatusLabel(status: string): string {
  return fighter.sessionStatus[status as SessionStatus] ?? status;
}

export function sessionTypeLabel(value: string): string {
  return fighter.sessionType[value as SessionType] ?? value;
}

export function planStatusLabel(status: string): string {
  return fighter.planStatus[status as TrainingPlanStatus] ?? status;
}

export function weightClassLabel(value: string): string {
  return vi.weightClass[value as keyof typeof vi.weightClass] ?? value;
}

export function stanceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return vi.stance[value as keyof typeof vi.stance] ?? value;
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}
