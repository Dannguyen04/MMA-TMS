import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage, CoachNavLink } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachVideoLibraryRoute() {
  return (
    <CoachBlockedPage title={blocked.videos} extra={blocked.relatedJobs} inStack>
      <CoachNavLink href="/video-analysis/upload" label={blocked.upload} />
      <CoachNavLink href="/video-analysis/review" label={blocked.review} />
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
