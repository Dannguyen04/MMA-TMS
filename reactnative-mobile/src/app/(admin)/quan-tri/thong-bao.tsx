import { NotificationInbox } from "@/screens/notifications/inbox";
import { AdminPage } from "@/screens/admin/admin-page";

export default function AdminNotificationsRoute() {
  return (
    <AdminPage title="Thông báo" onBack blockedNotice={false}>
      <NotificationInbox title="Hộp thư" />
    </AdminPage>
  );
}
