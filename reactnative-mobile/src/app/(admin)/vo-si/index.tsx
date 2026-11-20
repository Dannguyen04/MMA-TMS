import { CoachFightersScreen } from "@/screens/coach/fighters/fighters-list";
import { adminRo } from "@/i18n/admin/admin-ro";

/** A-4: dùng lại danh sách võ sĩ C-1, mở hồ sơ trong nhóm Admin. */
export default function AdminFightersIndexRoute() {
  return <CoachFightersScreen title={adminRo.fighters.title} detailPath="/(admin)/vo-si/chi-tiet" statusFilter />;
}
