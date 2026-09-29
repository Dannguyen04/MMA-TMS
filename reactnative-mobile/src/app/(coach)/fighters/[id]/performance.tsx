import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachFighterPerformanceRoute() {
  return (
    <CoachBlockedPage title={blocked.performanceNav} extra={blocked.performance}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
