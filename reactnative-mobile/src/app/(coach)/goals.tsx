import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function CoachGoalsRoute() {
  return <CoachBlockedPage title={blocked.goalsNav} extra={"Mục tiêu tập luyện của võ sĩ sẽ hiển thị tại đây."} inStack={false} />;
}
