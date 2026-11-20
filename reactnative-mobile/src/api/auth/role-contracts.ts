/**
 * Role baselines taken from the applied permission migrations.
 * These are not a live permission lookup. Screens use them to avoid calling
 * an endpoint the role was never granted.
 *
 * fighter.measurement:read — ADMIN (007), COACH (010). Not FIGHTER, not DOCTOR.
 * fighter.measurement:write — ADMIN (007), FIGHTER own SELF_REPORTED (024).
 * training.session:get_all — ADMIN (006), FIGHTER (008), COACH (010). Not DOCTOR.
 */
export const MEASUREMENT_READ_ROLES = ["COACH", "ADMIN"] as const;
export const MEASUREMENT_WRITE_ROLES = ["ADMIN", "FIGHTER"] as const;
export const SESSION_LIST_ROLES = ["FIGHTER", "COACH", "ADMIN"] as const;

export const MEASUREMENT_READ_PERMISSION = "fighter.measurement:read";
export const SESSION_LIST_PERMISSION = "training.session:get_all";

export function roleMayReadMeasurements(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

export function roleMayWriteMeasurements(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "FIGHTER";
}

export function roleMayListTrainingSessions(role: string | null | undefined): boolean {
  return role === "FIGHTER" || role === "COACH" || role === "ADMIN";
}
