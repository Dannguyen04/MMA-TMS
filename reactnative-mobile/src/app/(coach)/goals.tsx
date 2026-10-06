import { blocked } from "@/i18n/blocked";
import { media } from "@/i18n/media";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachGoalsRoute() {
  return (
    <CoachBlockedPage title={blocked.goalsNav} extra={media.goalsMissing} inStack={false}>
      <CoachBanner message={media.goalsMissing} />
    </CoachBlockedPage>
  );
}
