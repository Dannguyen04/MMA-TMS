import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { DisabledForm, EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminBroadcastRoute() {
  return (
    <AdminPage title={blocked.broadcast} extra={blocked.notifications} onBack>
      <EmptyBlockedList />
      <DisabledForm fields={[{ label: "Tiêu đề" }, { label: "Nội dung" }]} />
    </AdminPage>
  );
}
