import { medical } from "@/i18n/medical";
import { MedicalHistoryContent } from "@/screens/medical/medical-history-screen";
import { EmptyCopy, FighterScreen } from "@/screens/fighter/screen";
import { fighter } from "@/i18n/fighter";
import { useFighterId } from "@/screens/fighter/use-fighter-id";

export default function HealthHistoryRoute() {
  const { fighterId, canFetch, isDemo } = useFighterId();
  return (
    <FighterScreen title={medical.history} onBack>
      {isDemo || !canFetch || !fighterId ? (
        <EmptyCopy text={fighter.common.demoHint} />
      ) : (
        <MedicalHistoryContent fighterId={fighterId} enabled={canFetch} />
      )}
    </FighterScreen>
  );
}
