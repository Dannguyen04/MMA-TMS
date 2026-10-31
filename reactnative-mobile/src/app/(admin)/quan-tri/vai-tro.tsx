import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminRolesRoute() {
  return (
    <AdminPage title={blocked.roles} extra={blocked.adminAuthz} onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
