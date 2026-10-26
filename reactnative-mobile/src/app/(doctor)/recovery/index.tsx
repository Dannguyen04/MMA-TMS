import { medical } from "@/i18n/medical";
import { DoctorDossierLines } from "@/screens/doctor/clinical-read";

export default function DoctorRecoveryRoute() {
  return <DoctorDossierLines title={medical.recoveryPlans} kind="recovery" />;
}
