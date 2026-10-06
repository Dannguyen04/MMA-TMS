export {
  getExercise,
  getMe,
  getTrainingPlan,
  getTrainingSession,
  listExercises,
  listTrainingPlanExercises,
  listTrainingPlans,
  logout,
  type Exercise,
  type PublicUser,
  type SessionStatus,
  type SessionType,
  type TrainingPlan,
  type TrainingPlanExercise,
  type TrainingPlanStatus,
  type TrainingSession,
} from "@/api";

import {
  listTrainingPlans,
  listTrainingSessions,
  type ListTrainingPlansQuery,
  type ListTrainingSessionsQuery,
} from "@/api";

/**
 * Fighter baseline has no `fighter.session:read`, so `/fighters/:id/sessions`
 * is 403. `/training-sessions` is self-scoped by the backend for a Fighter.
 */
export function listSessionsForFighter(
  query?: Omit<ListTrainingSessionsQuery, "fighterId" | "coachId">,
) {
  return listTrainingSessions(query);
}

export function listPlansForFighter(
  fighterId: string,
  query?: Omit<ListTrainingPlansQuery, "fighterId">,
) {
  return listTrainingPlans({ fighterId, ...query });
}
