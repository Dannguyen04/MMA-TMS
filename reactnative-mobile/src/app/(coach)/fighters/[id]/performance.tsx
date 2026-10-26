import { blocked } from "@/i18n/blocked";
import { media } from "@/i18n/media";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachFighterPerformanceRoute() {
  return (
    <CoachBlockedPage title={blocked.performanceNav} extra={media.performanceMissing}>
      <CoachBanner message={media.performanceMissing} />
    </CoachBlockedPage>
  );
}
