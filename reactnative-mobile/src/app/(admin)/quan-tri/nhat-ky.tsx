import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminAuditRoute() {
  return (
    <AdminPage title={blocked.audit} extra="Không có GET audit-log trên nestjs-api." onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
