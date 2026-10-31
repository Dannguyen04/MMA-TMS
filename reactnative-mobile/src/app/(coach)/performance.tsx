import { blocked } from "@/i18n/blocked";
import { media } from "@/i18n/media";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachPerformanceRoute() {
  return (
    <CoachBlockedPage title={blocked.performanceNav} extra={media.performanceMissing} inStack={false}>
      <CoachBanner message={media.performanceMissing} />
    </CoachBlockedPage>
  );
}
