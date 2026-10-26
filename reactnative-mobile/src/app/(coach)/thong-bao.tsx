import { NotificationInbox } from "@/screens/notifications/inbox";
import { CoachScaffold } from "@/screens/coach/coach-ui";

export default function CoachNotificationsRoute() {
  return (
    <CoachScaffold title="Thông báo" inStack={false}>
      <NotificationInbox title="Hộp thư" />
    </CoachScaffold>
  );
}
