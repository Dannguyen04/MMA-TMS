import { CoachFightersScreen } from "@/screens/coach/readonly/coach-fighters-screen";
import { adminRo } from "@/i18n/admin-ro";

/** A-4: dùng lại danh sách võ sĩ C-1, mở hồ sơ trong nhóm Admin. */
export default function AdminFightersIndexRoute() {
  return <CoachFightersScreen title={adminRo.fighters.title} detailPath="/(admin)/vo-si/chi-tiet" statusFilter />;
}
