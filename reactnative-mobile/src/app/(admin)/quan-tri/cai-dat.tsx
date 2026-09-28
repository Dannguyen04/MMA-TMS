import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminSettingsRoute() {
  return (
    <AdminPage title={blocked.settings} extra="Cài đặt hệ thống không có REST trên nestjs-api. Theme local nằm ở từng vai trò." onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
