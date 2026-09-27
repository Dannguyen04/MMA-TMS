import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { EvidenceReviewSketch } from "@/screens/parity/blocked-workspace";

export default function CoachVideoReviewRoute() {
  return (
    <CoachBlockedPage title={blocked.review} extra={blocked.relatedJobs}>
      <EvidenceReviewSketch />
    </CoachBlockedPage>
  );
}
