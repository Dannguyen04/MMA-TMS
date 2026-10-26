import { Redirect, type Href } from "expo-router";

import { ADMIN_FIGHTER_DOCTORS_ENABLED } from "@/screens/admin/readonly/admin-flags";
import { AdminFighterDoctorsScreen } from "@/screens/admin/readonly/admin-fighter-doctors-screen";

/**
 * Bác sĩ phụ trách: bac-si?id=<mã võ sĩ>.
 * Phụ thuộc endpoint ĐÓNG BĂNG GET /fighters/:id/doctors; tắt bằng ADMIN_FIGHTER_DOCTORS_ENABLED (admin-flags.ts).
 */
export default function AdminFighterDoctorsRoute() {
  if (!ADMIN_FIGHTER_DOCTORS_ENABLED) return <Redirect href={"/(admin)/vo-si" as Href} />;
  return <AdminFighterDoctorsScreen />;
}
