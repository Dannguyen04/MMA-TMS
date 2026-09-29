import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachGoalsRoute() {
  return (
    <CoachBlockedPage title={blocked.goalsNav} extra={blocked.goals} inStack={false}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
