import { blocked } from "@/i18n/blocked";
import { BlockedFighterPage, EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function FighterNotificationsRoute() {
  return (
    <BlockedFighterPage title={blocked.notificationsNav} extra={blocked.notifications}>
      <EmptyBlockedList />
    </BlockedFighterPage>
  );
}
