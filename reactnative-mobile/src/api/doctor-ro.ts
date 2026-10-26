import { getFighterMedicalSummary } from "./fighters";
import {
  getFighterMedical,
  listDoctorFighters,
  listFighterDoctors,
  listFighterMedicalExaminations,
  listFighterMedicalHistory,
  listFighterReviewRequests,
} from "./medical";
import { mockDoctorRoApi } from "./doctor-ro.mock";
import { getJobHealthAlerts, listImpairmentJobs } from "./media";
import { getUnreadNotificationCount, listNotifications, markNotificationRead } from "./notifications";

/**
 * Các lệnh dành cho màn Doctor (Võ sĩ / chi tiết y tế / Thông báo). Chỉ dùng API đã có:
 * GET /doctors/:id/fighters, GET /fighters/:id/medical, GET /fighters/:id/medical-summary,
 * GET /fighters/:id/medical-examinations, /medical/history, /medical-review-requests, /doctors,
 * GET /jobs/impairments (máy chủ lọc theo võ sĩ bác sĩ đang phụ trách), GET /jobs/:id/health-alerts,
 * GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/read. Bác sĩ không có quyền GET /fighters/:id,
 * nên thông tin võ sĩ lấy từ danh sách phụ trách.
 * `EXPO_PUBLIC_DOCTOR_MOCK=true` chuyển sang dữ liệu giả lập để xem thử không cần máy chủ.
 */
export const USE_MOCK_DOCTOR = process.env.EXPO_PUBLIC_DOCTOR_MOCK === "true";

const realDoctorRoApi: typeof mockDoctorRoApi = {
  listRoster: (doctorId, q) => listDoctorFighters(doctorId, q),
  getMedical: (id) => getFighterMedical(id),
  getDossier: (id) => getFighterMedical(id),
  listExaminations: (id, q) => listFighterMedicalExaminations(id, q),
  listReviewRequests: (id, q) => listFighterReviewRequests(id, q),
  listHistory: (id, q) => listFighterMedicalHistory(id, q),
  listDoctors: (id, q) => listFighterDoctors(id, q),
  listImpairments: () => listImpairmentJobs(),
  getHealthAlerts: (jobId) => getJobHealthAlerts(jobId),
  getMedicalSummary: (id) => getFighterMedicalSummary(id),
  listNotifications: (q) => listNotifications(q),
  unreadCount: () => getUnreadNotificationCount(),
  markRead: async (id) => {
    await markNotificationRead(id);
  },
};

export const doctorRoApi: typeof mockDoctorRoApi = USE_MOCK_DOCTOR ? mockDoctorRoApi : realDoctorRoApi;
