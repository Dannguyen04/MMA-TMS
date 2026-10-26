import { ADMIN_FIGHTER_DOCTORS_ENABLED } from "@/screens/admin/readonly/admin-flags";
import { CoachFighterDetailScreen } from "@/screens/coach/readonly/coach-fighter-detail-screen";

/** A-4: dùng lại hồ sơ võ sĩ C-2 (chế độ Admin: không mở giáo án/buổi tập của Coach, có thêm Bác sĩ phụ trách). */
export default function AdminFighterDetailRoute() {
  return <CoachFighterDetailScreen admin doctorsPath={ADMIN_FIGHTER_DOCTORS_ENABLED ? "/(admin)/vo-si/bac-si" : undefined} />;
}
