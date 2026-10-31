import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { DisabledForm, EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminUsersRoute() {
  return (
    <AdminPage title={blocked.users} extra={blocked.adminUsers} onBack>
      <EmptyBlockedList />
      <DisabledForm fields={[{ label: "Email" }, { label: "Vai trò" }]} />
    </AdminPage>
  );
}
