import type { Href } from "expo-router";

/**
 * Href theo role, luôn có prefix group khi path trùng giữa các group
 * (`/thong-bao`, `/clearance`, `/me`, `/`). Tránh expo-router resolve nhầm group
 * rồi bị `RoleLayoutGate` đẩy về home.
 */
export type StaffRole = "coach" | "doctor";

export const fighterHref = {
  home: "/" as Href,
  notifications: "/(fighter)/thong-bao" as Href,
  bouts: "/(fighter)/tran" as Href,
  boutWeighIn: "/(fighter)/tran/can-nang" as Href,
  boutGuide: "/(fighter)/tran/huong-dan" as Href,
} as const;

export const coachHref = {
  home: "/(coach)/fighters" as Href,
  me: "/(coach)/me" as Href,
  notifications: "/(coach)/thong-bao" as Href,
  clearance: "/(coach)/clearance" as Href,
  goals: "/(coach)/goals" as Href,
  performance: "/(coach)/performance" as Href,
  assessments: "/(coach)/danh-gia" as Href,
  videoAnalysis: "/(coach)/video-analysis" as Href,
} as const;

export const doctorHref = {
  home: "/(doctor)" as Href,
  me: "/(doctor)/me" as Href,
  medical: "/(doctor)/medical" as Href,
  notifications: "/(doctor)/thong-bao" as Href,
  clearance: "/(doctor)/clearance" as Href,
  injuries: "/(doctor)/injuries" as Href,
  recovery: "/(doctor)/recovery" as Href,
  examinations: "/(doctor)/examinations" as Href,
  records: "/(doctor)/records" as Href,
  aiAlerts: "/(doctor)/ai-alerts" as Href,
} as const;

export const adminHref = {
  home: "/(admin)" as Href,
  notifications: "/(admin)/thong-bao" as Href,
} as const;

/** Trang thông báo theo role; `null` khi role không có trang thông báo riêng. */
export function notificationsHrefFor(role: string): Href | null {
  switch (role) {
    case "fighter":
      return fighterHref.notifications;
    case "coach":
      return coachHref.notifications;
    case "doctor":
      return doctorHref.notifications;
    case "admin":
      return adminHref.notifications;
    default:
      return null;
  }
}
