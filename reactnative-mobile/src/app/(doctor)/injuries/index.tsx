import { doctor } from "@/i18n/doctor";
import { DoctorDossierLines } from "@/screens/doctor/clinical-read";

export default function DoctorInjuriesRoute() {
  return <DoctorDossierLines title={doctor.medical.injuries} kind="injuries" />;
}
