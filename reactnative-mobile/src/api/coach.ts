import { mockCoachApi } from "./coach.mock";
import {
  getFighter,
  getFighterMedicalSummary,
  listFighterCoaches,
  listFighterMeasurements,
  listFighterSessions,
  listFighters,
} from "./fighters";
import { getFighterMedical } from "./medical";
import { getTrainingPlan, getTrainingSession, listExercises, listTrainingPlanExercises, listTrainingPlans, listTrainingSessions } from "./training";

/**
 * Các lệnh GET dành cho màn Coach chỉ đọc (C-1..C-7). Mặc định gọi API thật;
 * `EXPO_PUBLIC_COACH_MOCK=true` chuyển sang dữ liệu giả lập (`coach.mock.ts`) để xem thử không cần máy chủ.
 * Không dùng `GET /users/:id` (chỉ ADMIN).
 */
export const USE_MOCK_COACH =
  process.env.EXPO_PUBLIC_COACH_MOCK === "true" || process.env.EXPO_PUBLIC_ADMIN_MOCK === "true";

const realCoachApi: typeof mockCoachApi = {
  listFighters: (q) => listFighters(q),
  getFighter: (id) => getFighter(id),
  listMeasurements: (id, q) => listFighterMeasurements(id, q),
  listCoaches: (id) => listFighterCoaches(id),
  listFighterSessions: (id, q) => listFighterSessions(id, q),
  getMedical: (id) => getFighterMedical(id),
  getMedicalSummary: (id) => getFighterMedicalSummary(id),
  listPlans: (q) => listTrainingPlans(q),
  getPlan: (id) => getTrainingPlan(id),
  listPlanExercises: (id) => listTrainingPlanExercises(id),
  listSessions: (q) => listTrainingSessions(q),
  getSession: (id) => getTrainingSession(id),
  listExercises: (q) => listExercises(q),
};

export const coachApi: typeof mockCoachApi = USE_MOCK_COACH ? mockCoachApi : realCoachApi;
