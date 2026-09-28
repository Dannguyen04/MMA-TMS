import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachNotificationsRoute() {
  return (
    <CoachBlockedPage title={blocked.notificationsNav} extra={blocked.notifications} inStack={false}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
