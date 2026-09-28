import { blocked } from "@/i18n/blocked";
import { AdminPage } from "@/screens/admin/admin-page";
import { EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function AdminJobsRoute() {
  return (
    <AdminPage title={blocked.aiJobs} extra={blocked.relatedJobs} onBack>
      <EmptyBlockedList />
    </AdminPage>
  );
}
