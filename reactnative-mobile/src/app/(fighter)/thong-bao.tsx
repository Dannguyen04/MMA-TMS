import { NotificationInbox } from "@/screens/notifications/inbox";
import { FighterScreen } from "@/screens/fighter/screen";

export default function FighterNotificationsRoute() {
  return (
    <FighterScreen title="Thông báo" onBack>
      <NotificationInbox title="Hộp thư" />
    </FighterScreen>
  );
}
