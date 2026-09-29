import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminModelsRoute() {
  return (
    <AdminPage title={blocked.aiModels} extra="Không có controller mô hình AI trên nestjs-api." onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
