import { AppearanceLink } from "@/components/appearance/appearance-link";
import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminSettingsRoute() {
  return (
    <AdminPage title={blocked.settings} extra="Cài đặt hệ thống chưa dùng được trên điện thoại." onBack>
      <AppearanceLink />
      <EmptyBlockedList />
    </AdminPage>
  );
}
