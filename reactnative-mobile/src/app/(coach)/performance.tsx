import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachPerformanceRoute() {
  return (
    <CoachBlockedPage title={blocked.performanceNav} extra={blocked.performance} inStack={false}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
