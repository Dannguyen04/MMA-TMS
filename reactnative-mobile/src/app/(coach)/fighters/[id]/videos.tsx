import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachFighterVideosRoute() {
  return (
    <CoachBlockedPage title={blocked.videos} extra={blocked.relatedJobs}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
