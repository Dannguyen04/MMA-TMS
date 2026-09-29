import { ApplicantListScreen } from "@/screens/admissions/applicant-list";

export default function GuestHome() {
  return <ApplicantListScreen showSubmit detailHref={(id) => `/ho-so/${id}`} />;
}
