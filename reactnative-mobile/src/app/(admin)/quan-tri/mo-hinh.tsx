import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminModelsRoute() {
  return (
    <AdminPage title={blocked.aiModels} extra="Quản lý mô hình AI chưa dùng được trên điện thoại." onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
