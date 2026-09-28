import { usePostIntroRedirect } from "@/session/role-gate";

/**
 * Legacy `/dashboard` path — no public landing. Redirect to login or role home
 * after splash unlock + session restore.
 */
export default function DashboardRoute() {
  usePostIntroRedirect({ forceLeaveIndex: true });
  return null;
}
