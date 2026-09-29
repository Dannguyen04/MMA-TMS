import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachFighterGoalsRoute() {
  return (
    <CoachBlockedPage title={blocked.goalsNav} extra={blocked.goals}>
      <CoachBanner message={blocked.empty} />
    </CoachBlockedPage>
  );
}
