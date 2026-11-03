import { isApiError } from "@/api";
import { ResultShapeError } from "@/api/evidence";
import { ev } from "@/i18n/video-evidence";

/** Vietnamese message for evidence calls: 403 not assigned, 409 not finished, network. */
export function evidenceError(cause: unknown): string {
  if (cause instanceof ResultShapeError) return ev.errors.shape;
  if (!isApiError(cause)) return ev.errors.generic;
  if (cause.status === 0 || cause.code === "NETWORK_ERROR") return ev.errors.network;
  if (cause.status === 403) return ev.errors.notAssigned;
  if (cause.status === 409) return cause.code === "JOB_NOT_COMPLETE" ? ev.errors.notDone : ev.errors.conflict;
  if (cause.status === 404) return ev.errors.notFound;
  return ev.errors.generic;
}
