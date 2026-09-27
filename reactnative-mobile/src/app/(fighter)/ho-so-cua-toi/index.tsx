import { ApplicantListScreen } from "@/screens/admissions/applicant-list";

export default function FighterAdmissions() {
  return <ApplicantListScreen detailHref={(id) => `/ho-so-cua-toi/${id}`} />;
}
