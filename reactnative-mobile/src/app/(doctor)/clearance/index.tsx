import { medical } from "@/i18n/medical";
import { DoctorDossierLines } from "@/screens/doctor/clinical-read";

export default function DoctorClearanceRoute() {
  return <DoctorDossierLines title={medical.clearances} kind="clearance" />;
}
