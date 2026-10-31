import { NotificationInbox } from "@/screens/notifications/inbox";
import { DoctorChrome } from "@/screens/doctor/doctor-chrome";

export default function DoctorNotificationsRoute() {
  return (
    <DoctorChrome title="Thông báo">
      <NotificationInbox title="Hộp thư" />
    </DoctorChrome>
  );
}
