export { apiFetch } from "@/api/core/client";
export { API_BASE_URL } from "@/api/core/config";
export {
  ApiError,
  isApiError,
  MEDICAL_ELIGIBILITY_REASONS,
  MEDICAL_GATE_CODE,
  medicalGateReasons,
  type MedicalEligibilityReason,
} from "@/api/core/errors";
export { clearSession, loadStoredSession, persistSession } from "@/api/core/tokens";
export * from "./types";
export {
  forgotPassword,
  getMe,
  getUser,
  login,
  logout,
  refresh,
  register,
  requestAdmissionEmailCode,
  resetPassword,
  verifyAdmissionEmail,
} from "@/api/auth/auth";
export {
  activateAdmission,
  assignApplicationCoach,
  decideApplication,
  getApplication,
  getAssignedApplication,
  getOwnApplication,
  listApplications,
  listAssignedApplications,
  listOwnApplications,
  resendActivationEmail,
  submitApplication,
  submitAssessment,
} from "@/api/admissions/admissions";
export {
  assignFighterCoach,
  createFighterMeasurement,
  endFighterCoachAssignment,
  getFighter,
  getFighterMedicalSummary,
  listFighterCoaches,
  listFighterMeasurements,
  listFighterSessions,
  listFighters,
  supersedeFighterMeasurement,
  updateFighter,
} from "@/api/fighters/fighters";
export {
  assignFighterDoctor,
  createFighterExamination,
  createFighterInjury,
  createFighterRecoveryPlan,
  createFighterReviewRequest,
  getFighterMedical,
  issueFighterClearance,
  listDoctorFighters,
  listFighterDoctors,
  listFighterMedicalExaminations,
  listFighterMedicalHistory,
  listFighterReviewRequests,
} from "@/api/medical/medical";
export { getUnreadNotificationCount, listNotifications, markNotificationRead } from "@/api/notifications/notifications";
export {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type CoachProfileInput,
  type CreateUserInput,
  type DoctorProfileInput,
  type FighterProfileInput,
  type UpdateUserInput,
} from "@/api/auth/users";
export { getApiHello, getHealth } from "@/api/core/system";
export {
  addTrainingPlanExercise,
  createExercise,
  createTrainingPlan,
  createTrainingSession,
  getExercise,
  getTrainingPlan,
  getTrainingSession,
  listExercises,
  listTrainingPlanExercises,
  listTrainingPlans,
  listTrainingSessions,
  removeTrainingPlanExercise,
  updateExercise,
  updateTrainingPlan,
  updateTrainingPlanExercise,
  updateTrainingPlanStatus,
  updateTrainingSession,
  updateTrainingSessionStatus,
} from "@/api/training/training";
