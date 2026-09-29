import { isApiError } from "@/api";
import { fighter } from "@/i18n/fighter";
import { mapApiMessage } from "@/session/map-api-message";

export function isAccessLoss(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.status === 404);
}

export function mapFighterError(error: unknown): string {
  if (!isApiError(error)) {
    return fighter.common.generic;
  }
  if (error.status === 401 || error.code === "UNAUTHORIZED") {
    return fighter.common.unauthorized;
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return fighter.common.forbidden;
  }
  if (error.status === 404) {
    return fighter.common.notFound;
  }
  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return fighter.common.network;
  }
  if (error.status === 422 || error.code === "VALIDATION_ERROR") {
    return fighter.common.validation;
  }
  if (error.status === 400 || error.status === 409 || error.status === 429) {
    return mapApiMessage(error);
  }
  return fighter.common.generic;
}
