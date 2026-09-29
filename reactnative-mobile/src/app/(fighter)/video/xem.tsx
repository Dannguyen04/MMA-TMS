import { blocked } from "@/i18n/blocked";
import { BlockedFighterPage, EvidenceReviewSketch } from "@/screens/parity/blocked-workspace";

export default function FighterVideoReviewRoute() {
  return (
    <BlockedFighterPage title={blocked.review} extra={blocked.relatedJobs}>
      <EvidenceReviewSketch />
    </BlockedFighterPage>
  );
}
