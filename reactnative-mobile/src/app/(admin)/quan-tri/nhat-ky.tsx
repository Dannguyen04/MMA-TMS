import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminAuditRoute() {
  return (
    <AdminPage title={blocked.audit} extra="Nhật ký hệ thống chưa xem được trên điện thoại." onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
